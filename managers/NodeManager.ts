import { MessagePort } from "worker_threads"
import Channel from "../logger/Channel";
import express from "express"
import { IConfig, NodeCondition, NodeEvent } from "../types/Type";
import ConfigManager from "../config/ConfigManager";
import { logger } from '../logger/Logger'
import equal from 'deep-equal'

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
type NodeEventReasons = "CordonFailed" | "DrainScheduled" | "DrainSchedulingFailed" | "DrainSucceeded" | "DrainFailed"

const startTime: Date = new Date()
class NodeManager {
    private application: express.Application;
    private static nodes = new Map<string, NodeConditionCache>()
    private configManager: ConfigManager;

    constructor(private configFile: string, private dryRun:boolean) {
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
                Channel.sendMessageEventToES({node:nodeName, message:`Monitoring node '${nodeName}' started.`})
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
    
                    this.eventHandlerOfEvent[event.reason as NodeEventReasons](nodeName, nodes, configManager)
                } else {
                    logger.info(`Event raised at ${raisedTime}. Ignore old event.${startTime}`)
                }
            }
        },
        PrintNode: (nodes: Map<string, NodeConditionCache>) => {
            const arr = new Array<Object>()
            nodes.forEach((node, key) => {
                arr.push({ name: key, ipAddress: node.ipAddress, lastUpdateTime: node.lastUpdateTime, status: node.status })
            })
            console.table(arr);
        },
        DeleteNode: (event: any, nodes: Map<string, NodeConditionCache>) => {
            logger.info(`Node '${event.nodeName} removed from moritoring list. delete it.`)
            Channel.sendMessageEventToES({node:event.nodeName, message:`Node '${event.nodeName} removed from moritoring list.`})

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
        // CordonStarting: () => {},
        // CordonSucceeded: () => {},
        CordonFailed: this.reboot,
        // UncordonStarting: () => {},
        // UncordonSucceeded: () => {},
        // UncordonFailed: () => {},
        DrainScheduled: this.setTimerForReboot,
        DrainSchedulingFailed: this.reboot,
        // DrainStarting: () => {},
        DrainSucceeded: this.reboot,
        DrainFailed: this.reboot,
    }

    private reboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
        if( this.dryRun !== true) {
            logger.info(`DryRun is not true reboot enabled.`)
            logger.info(`Reboot ${nodeName} started.`)
        // const node = nodes.get(nodeName)
    
        // if (node !== undefined) {
        //     if (node.timer !== undefined) {
        //         clearTimeout(node.timer)
        //     }
        //     try {
        //         const rebooter: Rebooter = new Rebooter(configManager)
        //         rebooter.run(nodeName)
        //         node.lastRebootedTime = new Date()
        //     } catch (err) {
        //         console.error(err)
        //     }
        // }

        }
    }
    
    private setTimerForReboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
        const timeout = 100 * 1000;
        const node = nodes.get(nodeName)
    
        const timer = setTimeout(() => {
            if (node !== undefined) {
                node.timer = undefined
            }
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

        const ipAddress: string[] = ["10.0.0.13"]

        // const ssh:SSHReboot = new SSHReboot(this.configManager)
        // ssh.run(ipAddress)

        // const aws:AWSReboot = new AWSReboot(this.configManager)
        // aws.run(ipAddress)

        //aws.run()
        //Channel.sendMessageEventToES({message:"messsage from nodemanager"})
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
process.on('SIGTERM', function onSigterm() {
    logger.info('NodeManager - Got SIGTERM.')
})

nodeManager.run()