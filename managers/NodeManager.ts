import { MessagePort } from "worker_threads"
import Channel from "../logger/Channel";
import express from "express"
import { IConfig } from "../types/ConfigType"
import { NodeCondition, NodeEvent } from "../types/Type";
import ConfigManager from "../config/ConfigManager";
import { logger } from '../logger/Logger'
import equal from 'deep-equal'
import { integer } from "@elastic/elasticsearch/api/types";
import { Rebooter } from "../utils/Rebooter";
import NodeConditionChanger from "./NodeConditionMgr"
import { V1NodeCondition, V1NodeDaemonEndpoints } from "@kubernetes/client-node";
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

export interface NodeConditionCache {
    readonly ipAddress: string
    readonly conditions: Map<string, NodeCondition>
    readonly lastUpdateTime: Date
    readonly status: string,
    readonly timer?: NodeJS.Timeout,
    readonly lastRebootedTime?: Date,
    readonly nodeName:string,
    readonly UUID:string
}

const { workerData, parentPort } = require('worker_threads');

export type NodeStatus = "Ready" | "Cordoned" | "DrainScheduled" | "DrainStarted" | "Drained" | "DrainTimeout" | "DrainFailed" | "RebootScheduled" | "NotReady"
type EventTypes = "NodeCondition" | "NodeEvent" | "DeleteNode"

const NodeEventReasonArray = ["CordonFailed", "DrainScheduled", "DrainSchedulingFailed", "DrainSucceeded", "DrainFailed", "Rebooted", "NodeNotReady", "NodeReady"]
type NodeEventReason = "CordonFailed" | "DrainScheduled" | "DrainSchedulingFailed" | "DrainSucceeded" | "DrainFailed" | "Rebooted" | "NodeNotReady" | "NodeReady"

const startTime: Date = new Date()
class NodeManager {
    private application: express.Application;
    private static _nodes = new Map<string, NodeConditionCache>()
    private configManager: ConfigManager;
    private conditionManager?:NodeConditionChanger

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
        this.eventHandlers[event.kind as EventTypes](event, NodeManager._nodes, this.configManager);
    }

    private static getNode(nodeName:string):NodeConditionCache|undefined {
        return this._nodes.get(nodeName)
    }

    private static setNode(node:NodeConditionCache) {
        Channel.sendNodeStatusToES(node);
        this._nodes.set(node.nodeName, node)
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
                NodeManager.setNode({    
                     ipAddress: nodeCondition.nodeIp,
                     lastUpdateTime: new Date(),
                     status: status,

                     conditions: node.conditions,
                     timer: node.timer,
                     lastRebootedTime: node.lastRebootedTime,
                     nodeName: node.nodeName,
                     UUID: node.UUID
                })
            } else {
                Channel.sendMessageEventToES({ node: nodeName, message: `Monitoring node '${nodeName}' started.` })
                const newMap = new Map<string, NodeCondition>();
                const node: NodeConditionCache = { nodeName:nodeName, ipAddress: nodeCondition.nodeIp, conditions: newMap, lastUpdateTime: new Date(), status: status, UUID:btoa(nodeName) };

                // 노드를 처음으로 모니터링 하기 시작 했으면 kubelet ready시간을 reboot 시간으로 설정
                nodeCondition.conditions.filter( condition => {
                    if( condition.type === "Ready" && condition.reason === "KubeletReady" ) {
                        NodeManager.setNode({    
                            lastRebootedTime: condition.lastTransitionTime,

                            ipAddress: node.ipAddress,
                            lastUpdateTime: node.lastUpdateTime,
                            status: node.status,
                            conditions: node.conditions,
                            timer: node.timer,
                            nodeName: node.nodeName,
                            UUID: node.UUID
                       })       
                    }
                })

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
                    NodeManager.setNode({    
                        status: event.reason,
                        lastUpdateTime: raisedTime,

                        lastRebootedTime: node.lastRebootedTime,
                        ipAddress: node.ipAddress,
                        conditions: node.conditions,
                        timer: node.timer,
                        nodeName: node.nodeName,
                        UUID: node.UUID
                   })       

                    if (NodeEventReasonArray.includes(event.reason)) {
                        logger.info(`event.reason '${event.reason}'is NodeEventReasons`)
                        this.eventHandlerOfEvent[event.reason as NodeEventReason](nodeName, nodes, configManager)
                    }
                } else {
                    logger.info(`Event raised at ${raisedTime}. Ignore old event.${startTime}`)
                }
            }
        },
        PrintNode: () => {
            const arr = new Array<Object>()
            NodeManager._nodes.forEach((node, key) => {
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
        Rebooted: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} rebooted` })
            this.setNodeRebootTime(nodeName, nodes)
        },
        NodeNotReady: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node status of '${nodeName} is changed to 'NotReady` })
            this.setNodeRebootTime(nodeName, nodes)
        },
        NodeReady: (nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node status of '${nodeName} is changed to 'NotReady` })
            this.setNodeRebootTime(nodeName, nodes)
        },
    }

    private setNodeRebootTime(nodeName: string, nodes: Map<string, NodeConditionCache>) {
        const node = nodes.get(nodeName)
        if (node) {
            NodeManager.setNode({    
                lastRebootedTime: new Date(),

                status: node.status,
                lastUpdateTime: node.lastUpdateTime,
                ipAddress: node.ipAddress,
                conditions: node.conditions,
                timer: node.timer,
                nodeName: node.nodeName,
                UUID: node.UUID
           })  
        }
    }

    private static lastRebootTime:Date|undefined

    private reboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
        const config = configManager.config;
        const node = nodes.get(nodeName)
        if (node !== undefined) {
            if (node.timer !== undefined) {
                clearTimeout(node.timer)
            }

            let delay = config.rebootDelay * 1000
            if (config.rebootDelay <= 0) {
                delay = 0
            }

            const now = Date.now()
            const rebootBuffer = 3

            if(NodeManager.lastRebootTime !== undefined) {
                const nextRebootAvailable = NodeManager.lastRebootTime.getTime() + (60 * 1000 * rebootBuffer)

                if( nextRebootAvailable > now + delay ) {
                    delay = nextRebootAvailable - now
                } else {
                    delay = delay
                }
            }

            const rebootTime = new Date(now + delay)
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} reboot scheduled at ${rebootTime}.` })

            setTimeout(() => {
                logger.info(`Reboot ${nodeName} started.`)
                Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} reboot now.` })
                NodeManager.lastRebootTime = new Date()

                if (this.dryRun !== true) {

                    logger.info(`DryRun is not true reboot enabled.`)

                    try {
                        const rebooter: Rebooter = new Rebooter(configManager)
                        rebooter.run(node.nodeName)

                        NodeManager.setNode({    
                            lastRebootedTime: new Date(),
            
                            status: node.status,
                            lastUpdateTime: node.lastUpdateTime,
                            ipAddress: node.ipAddress,
                            conditions: node.conditions,
                            timer: node.timer,
                            nodeName: node.nodeName,
                            UUID: node.UUID
                       })              
                    } catch (err) {
                        console.error(err)
                    }
                }
            }, delay)
        }
    }

    private setTimerForReboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
        const drainBuffer = 10
        const timeout = drainBuffer * 60 * 1000;
        const node = nodes.get(nodeName)

        const timer = setTimeout(() => {
            if (node !== undefined) {
                NodeManager.setNode({    
                    timer: undefined,

                    lastRebootedTime: node.lastRebootedTime,
                    status: node.status,
                    lastUpdateTime: node.lastUpdateTime,
                    ipAddress: node.ipAddress,
                    conditions: node.conditions,
                    nodeName: node.nodeName,
                    UUID: node.UUID
               })              
            }
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} draining failed for ${drainBuffer} minutes and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, configManager)
        }, timeout)

        if (node !== undefined) {
            NodeManager.setNode({    
                timer: timer,

                lastRebootedTime: node.lastRebootedTime,
                status: node.status,
                lastUpdateTime: node.lastUpdateTime,
                ipAddress: node.ipAddress,
                conditions: node.conditions,
                nodeName: node.nodeName,
                UUID: node.UUID
           })
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
            this.eventHandlers['PrintNode']()
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
        this.numberOfReboot = NodeManager._nodes.size * (this.percentOfReboot / 100) + 1
        const now = new Date()
        const hour = now.getHours()
        if (hour > this.fromHourForMaintainous && hour < this.toHourForMaintainous && this.numberOfReboot > 0) {
            // const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
            const rebootNode = this.findRebootNode(twoWeeksAgo)

            if (rebootNode !== undefined) {
                NodeManager.rebootNode = rebootNode.ipAddress
                this.setNodeConditionToReboot(rebootNode.nodeName)
            } else {
                NodeManager.rebootNode = undefined
            }
        }
    }

    private setNodeConditionToReboot = (nodeName:string) => {
        if( this.conditionManager === undefined ) {
            this.conditionManager = new NodeConditionChanger()
        }
    
        const condition:V1NodeCondition = {
            status:"True", 
            type:"Warning", 
            lastHeartbeatTime: new Date(), 
            lastTransitionTime: new Date(), 
            message:"Reboot requested by nodeMon",
            reason:"RebootRequested"
        }

        this.conditionManager.changeNodeCondition(nodeName, condition )
    }

    private static rebootNode: string | undefined

    private findRebootNode(twoWeeksAgo: number): NodeConditionCache | undefined {
        NodeManager._nodes.forEach(node => {
            if (node.lastRebootedTime === undefined) {
                NodeManager.setNode({   
                    lastRebootedTime: new Date(),

                    timer: node.timer,
                    status: node.status,
                    lastUpdateTime: node.lastUpdateTime,
                    ipAddress: node.ipAddress,
                    conditions: node.conditions,
                    nodeName: node.nodeName,
                    UUID: node.UUID
               })
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