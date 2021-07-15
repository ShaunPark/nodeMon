import { MessagePort } from "worker_threads"
import Channel from "../logger/Channel";
import express from "express"
import { IConfig, NodeCondition, NodeEvent } from "../types/Type";
import ConfigManager from "../config/ConfigManager";
import { logger } from '../logger/Logger'
import equal from 'deep-equal'
import { integer } from "@elastic/elasticsearch/api/types";

export interface NodeInfo {
    nodeName: string
    nodeIp: string
    nodeUnscheduleable: boolean
}

export interface NodeConditionEvent extends NodeInfo {
    kind: string,
    status: string,
    conditions: Array<NodeCondition>
}

export interface NodeEventsEvent extends NodeInfo {
    kind: string,
    conditions: Array<NodeEvent>
}

export type NodeConditionCache = {
    ipAddress: string
    conditions: Map<string, NodeCondition>
    lastUpdateTime: Date
    status: string,
    timer?: NodeJS.Timeout,
    lastRebootedTime?: Date
}

const { workerData, parentPort } = require('worker_threads');

export type NodeStatus = "Ready" | "Cordoned" | "DrainScheduled" | "DrainStarted" | "Drained" | "DrainTimeout" | "DrainFailed" | "RebootScheduled" | "NotReady"
type EventTypes = "NodeCondition" | "NodeEvent" | "DeleteNode"

const NodeEventReasonArray = ["CordonFailed", "DrainScheduled", "DrainSchedulingFailed", "DrainSucceeded", "DrainFailed", "Starting"]
type NodeEventReason = "CordonFailed" | "DrainScheduled" | "DrainSchedulingFailed" | "DrainSucceeded" | "DrainFailed" | "Starting"

const startTime: Date = new Date()
class NodeManager {
    private application: express.Application;
    private static nodes = new Map<string, NodeConditionCache>()
    private configManager: ConfigManager;

    constructor(private configFile: string, private dryRun: boolean) {
        if (parentPort)
            parentPort.addEventListener("message", this.initMessageHandler)
        this.application = express();
        this.configManager = new ConfigManager(this.configFile);
    }

    // 스레드간 채널 연결 초기화
    private initMessageHandler = (event: MessageEvent) => {
        const ePort: MessagePort = event.data.port;

        if (event.data.type === "parent") {
            ePort.addListener("message", this.onEvent);
        } else if (event.data.type === "shutdown") {
            logger.info(`Shutdown NodeManager`)
        } else {
            Channel.initLoggerForNodeManager(ePort);
        }
    }

    // Kubernetes 모니터에서 전달된 이벤트 처리
    private onEvent = (event: any) => {
        //수신한 이벤트를 처리
        this.eventHandlers[event.kind as EventTypes](event, NodeManager.nodes, this.configManager);
    }

    public eventHandlers = {
        NodeCondition: (event: any, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            const nodeName = event.nodeName;
            const nodeCondition = event as NodeConditionEvent
            const node = nodes.get(nodeCondition.nodeName)
            logger.info(`receive node condition : ${nodeName}`)

            const status = nodeCondition.status + (nodeCondition.nodeUnscheduleable ? "/Unschedulable" : "")

            if (node) {
                nodeCondition.conditions.filter((condition) => {
                    const tempCondition = node.conditions.get(condition.type)
                    if (tempCondition && equal(tempCondition, condition)) {
                        return false;
                    }
                    return true;
                }).map(condition => node.conditions.set(condition.type, condition))
                node.ipAddress = nodeCondition.nodeIp
                node.lastUpdateTime = new Date()
                node.status = status
            } else {
                Channel.sendMessageEventToES({ node: nodeName, message: `Monitoring node '${nodeName}' started.` })
                const newMap = new Map<string, NodeCondition>();
                const node: NodeConditionCache = { ipAddress: nodeCondition.nodeIp, conditions: newMap, lastUpdateTime: new Date(), status: status };
                nodeCondition.conditions.map(condition => newMap.set(condition.type, condition))
                nodes.set(nodeName, node)
            }
        },
        NodeEvent: (event: any, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            const nodeName = event.nodeName;
            logger.info(`receive events : ${nodeName}`)
            const node = nodes.get(nodeName)
            if (node == undefined) {
                logger.info(`Node ${nodeName} does not exist in list. Ignore`)
            } else {
                // 모니터 시작전 발생한 old 이벤트는 무시
                const eventDate = Date.parse(event.lastTimestamp)
                const raisedTime = new Date(eventDate)

                if (startTime.getTime() < eventDate) {
                    node.status = event.reason;
                    node.lastUpdateTime = raisedTime
                    if (NodeEventReasonArray.includes(event.reason)) {
                        logger.info(`event.reason '${event.reason}'is NodeEventReasons`)
                        this.eventHandlerOfEvent[event.reason as NodeEventReason](nodeName, nodes, configManager)
                    }
                } else {
                    logger.info(`Event raised at ${raisedTime}. Ignore old event.${startTime}`)
                }
            }
        },
        PrintNode: (nodes: Map<string, NodeConditionCache>) => {
            const arr = new Array<Object>()
            nodes.forEach((node, key) => {
                arr.push({ name: key, ipAddress: node.ipAddress, lastUpdateTime: node.lastUpdateTime, status: node.status, lastRebootedTime: node.lastRebootedTime })
            })
            console.table(arr);
        },
        DeleteNode: (event: any, nodes: Map<string, NodeConditionCache>) => {
            logger.info(`Node '${event.nodeName} removed from moritoring list. delete it.`)
            Channel.sendMessageEventToES({ node: event.nodeName, message: `Node '${event.nodeName} removed from moritoring list.` })

            nodes.delete(event.nodeName)
        },
        CleanNode: (nodes: Map<string, NodeConditionCache>) => {

            // 1분동안 node update정보가 없으면 관리목록에서 제거 
            const now = Date.now()
            nodes.forEach((node, key) => {
                const diffMs = node.lastUpdateTime.getTime() - now; // milliseconds between now & Christmas
                const diffMin = diffMs / 60000; // hours

                if (diffMin > 1) {
                    nodes.delete(key)
                }
            })
        }
    }

    private eventHandlerOfEvent = {
        CordonStarting: () => { },
        CordonSucceeded: () => { },
        CordonFailed: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} failed to cordon and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, configManager)
        },
        UncordonStarting: () => { },
        UncordonSucceeded: () => { },
        UncordonFailed: () => { },
        DrainScheduled: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} draining is scheduled.` })
            this.setTimerForReboot(nodeName, nodes, configManager)
        },
        DrainSchedulingFailed: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} failed to schedule for draining and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, configManager)
        },
        DrainStarting: () => { },
        DrainSucceeded: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} drained and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, configManager)
        },
        DrainFailed: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} drain failed and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, configManager)
        },
        Starting: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} started` })
        }
    }

    private reboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
        const node = nodes.get(nodeName)
        if (node !== undefined) {
            if (node.timer !== undefined) {
                clearTimeout(node.timer)
            }

            setTimeout(() => {
                logger.info(`Reboot ${nodeName} started.`)
                Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} reboot now.` })
                if (this.dryRun !== true) {

                    logger.info(`DryRun is not true reboot enabled.`)

                    // try {
                    //     const rebooter: Rebooter = new Rebooter(configManager)
                    //     rebooter.run(nodeName)
                    //     node.lastRebootedTime = new Date()
                    // } catch (err) {
                    //     console.error(err)
                    // }
                }
            }, 60 * 1000)
        }
    }

    private setTimerForReboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
        const timeout = 5 * 60 * 1000;
        const node = nodes.get(nodeName)

        const timer = setTimeout(() => {
            if (node !== undefined) {
                node.timer = undefined
            }
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} draining failed for 5 minutes and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, configManager)
        }, timeout)

        if (node !== undefined) {
            node.timer = timer
        }
    }

    public run() {
        const config: IConfig = this.configManager.config;

        let interval: number = 10000;
        if (config.nodeManager && config.nodeManager.interval) {
            interval = config.nodeManager.interval
        }
        //setInterval(this.checkNodeStatus, interval)

        setTimeout(this.checkNodeStatus, interval);

        // this.application.get('/', (request, response) => {
        //     response.send(NodeManager.nodes)
        // })

        // this.application.listen(8880, () => {
        //     logger.info("express started")
        // })

        setInterval(() => {
            this.eventHandlers['PrintNode'](NodeManager.nodes)
            //eventHandlers['CleanNode'](NodeManager.nodes)
        }, interval)
    }

    private checkNodeStatus = () => {
        // logger.info("Node status !!! ") 
        // this.nodes.forEach( (node, nodeName) => {
        //     logger.info(`${nodeName}`)
        //     node.forEach( (condition, type) => {
        //         logger.info(`${type} : ${condition.status} : ${condition.reason}`)
        //     })
        // })

        // run routine 

        // run daily routine


        //this.rebootTimer = setInterval(this.rebootNodeEveryTwoWeek, 10 * 60 * 1000)
    }

    private async rebootNode(): Promise<void> {

    }

    private rebootTimer: number | undefined

    private fromHourForMaintainous: integer = 2
    private toHourForMaintainous: integer = 2
    private percentOfReboot: integer = 30
    private numberOfReboot: integer = 0

    private rebootNodeEveryTwoWeek(twoWeeksAgo: number) {
        this.numberOfReboot = NodeManager.nodes.size * (this.percentOfReboot / 100) + 1
        const now = new Date()
        const hour = now.getHours()
        if (hour > this.fromHourForMaintainous && hour < this.toHourForMaintainous && this.numberOfReboot > 0) {
            // const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
            const rebootNode = this.findRebootNode(twoWeeksAgo)

            if (rebootNode !== undefined) {
                NodeManager.rebootNode = rebootNode.ipAddress
                this.rebootNode().then(() => {
                    setTimeout((twoWeeksAgo) => this.rebootNodeEveryTwoWeek(twoWeeksAgo), 5 * 60 * 1000)
                })
            } else {
                NodeManager.rebootNode = undefined
            }
        }
    }

    private static rebootNode: string | undefined

    private findRebootNode(twoWeeksAgo: number): NodeConditionCache | undefined {
        NodeManager.nodes.forEach(node => {
            if (node.lastRebootedTime === undefined) {
                node.lastRebootedTime = new Date();
            } else {
                if (node.lastRebootedTime.getTime() < twoWeeksAgo) {
                    return node;
                }
            }
        })
        return undefined
    }
    private dayCheckStartTime: Date = new Date();
    private lastDay: Date = new Date();

    private dailyRoutine() {
        if (this.isFirstTimeOfDay()) {
            this.lastDay = new Date();
        }
    }

    private isFirstTimeOfDay(): boolean {
        return false;
    }
}

const nodeManager = new NodeManager(workerData?.config, workerData?.dryRun)
nodeManager.run()