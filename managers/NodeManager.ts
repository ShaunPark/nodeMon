import Channel from "../logger/Channel";
import ConfigManager from "../config/ConfigManager";
import IConfig from "../types/ConfigType"

import { MessagePort } from "worker_threads"
import { NodeCondition } from "../types/Type";
import Log from '../logger/Logger'
import equal from 'deep-equal'
import Rebooter from "../reboot/Rebooter";
import K8SUtil from "../kubernetes/K8SUtil"
import * as util from "../util/Util";

const { parentPort } = require('worker_threads');
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

export interface NodeConditionCache {
    readonly ipAddress: string
    readonly conditions: Map<string, NodeCondition>
    readonly lastUpdateTime: Date
    readonly status: string,
    readonly timer?: NodeJS.Timeout,
    readonly lastRebootedTime?: Date,
    readonly nodeName: string,
    readonly UUID: string
}

type EventTypes = "NodeCondition" | "NodeEvent" | "DeleteNode"
type NodeEventReason = "CordonFailed" | "DrainScheduled" | "DrainSchedulingFailed" | "DrainSucceeded" | "DrainFailed" | "Rebooted" | "NodeNotReady" | "NodeReady"

const NodeEventReasonArray = ["CordonFailed", "DrainScheduled", "DrainSchedulingFailed", "DrainSucceeded", "DrainFailed", "Rebooted", "NodeNotReady", "NodeReady"]
const startTime: Date = new Date()
export default class NodeManager {
    private static _nodes = new Map<string, NodeConditionCache>()
    private cmg: ConfigManager;
    private k8sUtil: K8SUtil

    constructor(private configFile: string, private dryRun: boolean) {
        if (parentPort) {
            parentPort.addEventListener("message", this.initMessageHandler)
        }

        this.cmg = new ConfigManager(this.configFile);
        this.k8sUtil = new K8SUtil(this.cmg.config)
    }

    // 스레드간 채널 연결 초기화
    private initMessageHandler = (event: MessageEvent) => {
        const ePort: MessagePort = event.data.port;

        if (event.data.type === "parent") {
            ePort.addListener("message", this.onEvent);
        } else if (event.data.type === "shutdown") {
            Log.info(`Shutdown NodeManager`)
        } else {
            Channel.initLoggerForNodeManager(ePort);
        }
    }

    // Kubernetes 모니터에서 전달된 이벤트 처리
    private onEvent = (event: any) => {
        //수신한 이벤트를 처리
        this.eventHandlers[event.kind as EventTypes](event, NodeManager._nodes, this.cmg);
    }

    public static setNode(node: NodeConditionCache, obj: Object) {
        const newNode = { ...node, ...obj }
        Channel.sendNodeStatusToES(newNode);
        this._nodes.set(newNode.nodeName, newNode)
    }

    private eventHandlers = {
        NodeCondition: (event: any, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            const nodeName = event.nodeName;
            const nodeCondition = event as NodeConditionEvent
            const node = nodes.get(nodeCondition.nodeName)
            Log.info(`receive node condition : ${nodeName}`)

            const status = nodeCondition.status + (nodeCondition.nodeUnscheduleable ? "/Unschedulable" : "")

            if (node) {
                nodeCondition.conditions.filter((condition) => {
                    const tempCondition = node.conditions.get(condition.type)
                    if (tempCondition && equal(tempCondition, condition)) {
                        return false;
                    }
                    return true;
                }).map(condition => node.conditions.set(condition.type, condition))
                NodeManager.setNode(node, { ipAddress: nodeCondition.nodeIp, lastUpdateTime: new Date(), status: status })
            } else {
                Channel.sendMessageEventToES({ node: nodeName, message: `Monitoring node '${nodeName}' started.` })
                const newMap = new Map<string, NodeCondition>();
                const node: NodeConditionCache = { nodeName: nodeName, ipAddress: nodeCondition.nodeIp, conditions: newMap, lastUpdateTime: new Date(), status: status, UUID: btoa(nodeName) };

                // 노드를 처음으로 모니터링 하기 시작 했으면 kubelet ready시간을 reboot 시간으로 설정
                nodeCondition.conditions.filter(condition => {
                    if (condition.type === "Ready" && condition.reason === "KubeletReady") {
                        NodeManager.setNode(node, { lastRebootedTime: condition.lastTransitionTime })
                    }
                })

                nodeCondition.conditions.map(condition => newMap.set(condition.type, condition))
                nodes.set(nodeName, node)
            }
        },
        NodeEvent: (event: any, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            const nodeName = event.nodeName;
            Log.info(`receive events : ${nodeName}`)
            const node = nodes.get(nodeName)
            if (node == undefined) {
                Log.info(`Node ${nodeName} does not exist in list. Ignore`)
            } else {
                // 모니터 시작전 발생한 old 이벤트는 무시
                const eventDate = Date.parse(event.lastTimestamp)
                const raisedTime = new Date(eventDate)

                if (startTime.getTime() < eventDate) {
                    NodeManager.setNode(node, { status: event.reason, lastUpdateTime: raisedTime })

                    if (NodeEventReasonArray.includes(event.reason)) {
                        Log.info(`event.reason '${event.reason}'is NodeEventReasons`)
                        this.eventHandlerOfEvent[event.reason as NodeEventReason](nodeName, nodes, cmg)
                    }
                } else {
                    Log.info(`Event raised at ${raisedTime}. Ignore old event.${startTime}`)
                }
            }
        },
        PrintNode: () => {
            const arr = new Array<Object>()
            NodeManager._nodes.forEach((node, key) => {
                let rebootNode: { nodeName: string, rebootTime: string } = { nodeName: node.nodeName, rebootTime: "NO" }
                this.rebootList.forEach(rb => {
                    if (rb == node.nodeName) {
                        rebootNode = { nodeName: rb, rebootTime: "YES" }
                    }
                })
                arr.push({ name: key, ipAddress: node.ipAddress, lastUpdateTime: node.lastUpdateTime, status: node.status, lastRebootedTime: node.lastRebootedTime, rebootSchedule: rebootNode.rebootTime })
            })
            console.table(arr);
        },
        DeleteNode: (event: any, nodes: Map<string, NodeConditionCache>) => {
            Log.info(`Node '${event.nodeName} removed from moritoring list. delete it.`)
            Channel.sendMessageEventToES({ node: event.nodeName, message: `Node '${event.nodeName} removed from moritoring list.` })

            nodes.delete(event.nodeName)
        }
    }

    private eventHandlerOfEvent = {
        CordonStarting: () => { },
        CordonSucceeded: () => { },
        CordonFailed: (nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} failed to cordon and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, cmg)
        },
        UncordonStarting: () => { },
        UncordonSucceeded: () => { },
        UncordonFailed: () => { },
        DrainScheduled: (nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} draining is scheduled.` })
            this.setTimerForReboot(nodeName, nodes, cmg)
        },
        DrainSchedulingFailed: (nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} failed to schedule for draining and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, cmg)
        },
        DrainStarting: () => { },
        DrainSucceeded: (nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} drained and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, cmg)
        },
        DrainFailed: (nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} drain failed and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, cmg)
        },
        Rebooted: (nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} rebooted` })
            this.setNodeRebootTime(nodeName, nodes)
        },
        NodeNotReady: (nodeName: string, nodes: Map<string, NodeConditionCache>) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node status of '${nodeName} is changed to 'NotReady` })
            this.setNodeRebootTime(nodeName, nodes)
        },
        NodeReady: (nodeName: string, nodes: Map<string, NodeConditionCache>) => {
            Channel.sendMessageEventToES({ node: nodeName, message: `Node status of '${nodeName} is changed to 'NotReady` })
            this.setNodeRebootTime(nodeName, nodes)
        },
    }

    private setNodeRebootTime(nodeName: string, nodes: Map<string, NodeConditionCache>) {
        const node = nodes.get(nodeName)
        if (node) {
            NodeManager.setNode(node, { lastRebootedTime: new Date() })
        }
    }

    private static lastRebootTime: Date | undefined

    private reboot(nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) {
        const config = cmg.config;
        const node = nodes.get(nodeName)
        const isReboot: boolean = config.rebootThroughSSH === undefined || config.rebootThroughSSH === true
        const rebootStr = (isReboot) ? "Reboot" : "Termination"

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

            if (NodeManager.lastRebootTime !== undefined) {
                const nextRebootAvailable = NodeManager.lastRebootTime.getTime() + (60 * 1000 * rebootBuffer)

                if (nextRebootAvailable > now + delay) {
                    delay = nextRebootAvailable - now
                } else {
                    delay = delay
                }
            }

            const rebootTime = new Date(now + delay)
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} ${rebootStr} is scheduled at ${rebootTime}.` })

            setTimeout(() => {
                Log.info(`${(isReboot) ? "Reboot" : "Termination"} ${nodeName} started.`)
                Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} ${rebootStr} now.` })
                NodeManager.lastRebootTime = new Date()

                if (this.dryRun !== true) {

                    Log.info(`DryRun is not true. ${rebootStr} is enabled.`)

                    try {
                        const rebooter: Rebooter = new Rebooter(cmg)
                        rebooter.run(node.nodeName)

                        NodeManager.setNode(node, { lastRebootedTime: new Date() })
                    } catch (err) {
                        console.error(err)
                    }
                }
            }, delay)
        }
    }

    private setTimerForReboot(nodeName: string, nodes: Map<string, NodeConditionCache>, cmg: ConfigManager) {
        const drainBuffer = 10
        const timeout = drainBuffer * 60 * 1000;
        const node = nodes.get(nodeName)

        const timer = setTimeout(() => {
            if (node !== undefined) {
                NodeManager.setNode(node, { timer: undefined })
            }
            Channel.sendMessageEventToES({ node: nodeName, message: `Node '${nodeName} draining failed for ${drainBuffer} minutes and will reboot in 1 minute.` })
            this.reboot(nodeName, nodes, cmg)
        }, timeout)

        if (node !== undefined) {
            NodeManager.setNode(node, { timer: timer })
        }
    }

    run() {
        const config: IConfig = this.cmg.config;

        let interval: number = 10000;
        if (config.nodeManager && config.nodeManager.interval) {
            interval = config.nodeManager.interval
        }

        // setTimeout(this.checkNodeStatus, interval);
        setInterval(() => {
            this.checkNodeStatus()
            this.eventHandlers['PrintNode']()
            //eventHandlers['CleanNode'](NodeManager.nodes)
        }, interval)
    }

    private isCordonTime = (now: Date): boolean => {
        const ret = util.betweenTimes(now, this.cordonStartHour, this.cordonEndHour)
        Log.debug(`isCordonTime : ${ret}`)
        return ret
    }

    private isRebootTime = (now: Date): boolean => {
        const ret = util.betweenTimes(now, this.rebootStartHour, this.rebootEndHoure)
        Log.debug(`isRebootTime : ${ret}`)
        return ret
    }

    private cordonStartHour: Date = new Date('Thu, 01 Jan 1970 20:00:00+09:00')
    private cordonEndHour: Date = new Date('Thu, 01 Jan 1970 21:00:00+09:00')
    private rebootStartHour: Date = new Date('Thu, 01 Jan 1970 03:00:00+09:00')
    private rebootEndHoure: Date = new Date('Thu, 01 Jan 1970 05:00:00+09:00')

    private cordoned = false
    private rebootScheduled = false

    private percentOfReboot = 30
    private rebootList: Array<string> = []
    private maxLivenessDays = 10
    private delay = 15

    private reloadConfigValues = () => {
        const maint = this.cmg.config.maintenance
        if (maint !== undefined) {
            if( maint.testMode === true ){
                Log.info("TEST Mode !!!!!!!!!!!!!")
                this.cordonStartHour = util.timeStrToDate(maint.cordonStartHour, "20:00+09:00")
                this.cordonEndHour = new Date(this.cordonStartHour.getTime() + (30 * 1000))
                this.rebootStartHour = new Date(this.cordonStartHour.getTime() + (60 * 1000))
                this.rebootEndHoure = new Date(this.cordonStartHour.getTime() + (90 * 1000))
            } else {
                this.cordonStartHour = util.timeStrToDate(maint.cordonStartHour, "20:00+09:00")
                this.cordonEndHour = util.timeStrToDate(maint.cordonEndHour, "21:00+09:00")
    
                if (this.cordonStartHour.getTime() > this.cordonEndHour.getTime()) {
                    this.cordonEndHour.setHours(this.cordonStartHour.getHours() + 1)
                }
    
                this.rebootStartHour = util.timeStrToDate(maint.startHour, "03:00+09:00")
                this.rebootEndHoure = util.timeStrToDate(maint.endHour, "04:00+09:00")
    
                if (this.rebootStartHour.getTime() > this.rebootEndHoure.getTime()) {
                    this.rebootEndHoure.setHours(this.rebootStartHour.getHours() + 1)
                }
            }

            this.percentOfReboot = maint.ratio
            if (this.percentOfReboot < 10 || this.percentOfReboot > 50) {
                this.percentOfReboot = 20
            }

            this.maxLivenessDays = maint.maxLivenessDays
            if (this.maxLivenessDays < 7 || this.maxLivenessDays > 28) {
                this.maxLivenessDays = 14
            }
        }
    }

    private checkNodeStatus = async () => {
        const maint = this.cmg.config.maintenance

        if (maint && maint.runMaintenance) {
            if (!this.cordoned && !this.rebootScheduled) {
                this.reloadConfigValues()
            }
            const now = new Date()

            if (this.isCordonTime(now)) {
                if (this.cordoned === false) {
                    Log.info("Time to cordon check")

                    this.rebootList = new Array<string>();
                    const arr = this.findOldNodes(now)

                    Log.info(`Reboot Schedule nodes : ${JSON.stringify(arr)}`)

                    arr.forEach((node: string, index: number) => {
                        this.cordonNode(node)
                        this.rebootList.push(node)
                    })
                    this.cordoned = true
                } else {
                    Log.info("Time to cordon check but already done")
                }
            } else {
                if (this.cordoned == true) {
                    Log.info("End ofcordon check")
                }
                this.cordoned = false;
            }

            if (this.isRebootTime(now)) {
                if (this.rebootScheduled === false) {
                    Log.info("Time to reboot check")
                    Log.info(`nubmer of reboot by max liveness : ${this.rebootList.length}`)
                    const numberOfReboot = Math.ceil(NodeManager._nodes.size * (this.percentOfReboot / 100))
                    Log.info(`nubmer of reboot : ${numberOfReboot}`)


                    if (numberOfReboot > this.rebootList.length) {
                        const nodeList = await this.filterRebootNode()
                        this.rebootList = [...this.rebootList, ...nodeList]
                    }

                    this.rebootList = this.rebootList.slice(0, numberOfReboot)

                    this.scheduleRebootNodes(this.rebootList)
                    this.rebootScheduled = true
                } else {
                    Log.info("Time to reboot check but already done")
                }
            } else {
                // reboot 시간이 끝나면 reboot 대상 노드들을 uncordon
                if (this.rebootScheduled === true) {
                    Log.info("End of reboot check")

                    this.rebootList.forEach(item => {
                        this.uncordonNode(item)
                        this.removeRebootCondition(item)
                    })
                    this.rebootList = new Array<string>()
                }
                this.rebootScheduled = false
            }
        }
    }

    private async filterRebootNode(): Promise<string[]> {
        const nodesHasWorker = await this.getNodeHasWorker()
        Log.debug(`Node has workder ${JSON.stringify(nodesHasWorker)}`)
        const filteredNodes = Array.from(NodeManager._nodes)
            .map(([_, node]) => node)
            .filter((node) => !nodesHasWorker.includes(node.nodeName))
            .sort((node1, node2) => {
                const time1 = (node1.lastRebootedTime) ? node1.lastRebootedTime.getTime() : 0
                const time2 = (node2.lastRebootedTime) ? node2.lastRebootedTime.getTime() : 0
                return time2 - time1
            })
            .map(node => node.nodeName)

        Log.debug(`Filtered nodes ${JSON.stringify(filteredNodes)}`)
        return Promise.resolve(filteredNodes)
    }

    private async getNodeHasWorker(): Promise<string[]> {
        const fieldSelector = this.cmg.config.kubernetes?.podFieldSelector
        const labelSelector = this.cmg.config.kubernetes?.podLabelSelector
        return this.k8sUtil.getNodeListOfPods(fieldSelector, labelSelector)
    }

    private scheduleRebootNodes(list: string[]) {
        list.forEach((nodeName, index) => {
            const delay = index * (15 * 60) * 1000 + 1000
            Log.debug(`Set timer for reboot '${nodeName} ${delay}`)
            const scheduledTime = new Date(Date.now() + delay)
            Channel.sendMessageEventToES({ node: nodeName, message: `Node reboot is scheduled at ${scheduledTime}` })
            setTimeout(() => this.setNodeConditionToReboot(nodeName), (delay < 0) ? 0 : delay)
        })
    }

    private findOldNodes = (now: Date): Array<string> => {
        const arr: Array<string> = []
        const rebootTime = now.getTime() - (this.maxLivenessDays * 24 * 60 * 60 * 1000)

        NodeManager._nodes.forEach(node => {
            if (node.lastRebootedTime === undefined) {
                NodeManager.setNode(node, { lastRebootedTime: new Date() })
            } else {
                if (node.lastRebootedTime.getTime() < rebootTime) {
                    arr.push(node.nodeName)
                }
            }
        })
        return arr;
    }

    private cordonNode(nodeName: string) {
        Log.debug(`Node ${nodeName} cordoned`)

        if (!this.cmg.config.dryRun) {
            this.k8sUtil.cordonNode(nodeName)
        }
        Channel.sendMessageEventToES({ node: nodeName, message: `Node cordoned` })
    }

    private uncordonNode(nodeName: string) {
        Log.info(`Node ${nodeName} unCordoned`)

        if (!this.cmg.config.dryRun) {
            this.k8sUtil.uncordonNode(nodeName)
        }
        Channel.sendMessageEventToES({ node: nodeName, message: `Node unCordoned` })
    }

    private removeRebootCondition = (nodeName: string) => {
        Log.debug(`Node ${nodeName} RebootRequested`)

        if (!this.cmg.config.dryRun) {
            this.k8sUtil.removeNodeCondition(nodeName, "RebootRequested")
        }
    }

    private setNodeConditionToReboot = (nodeName: string) => {
        Log.debug(`Node ${nodeName} is scheduled for reboot`)

        if (!this.cmg.config.dryRun) {
            this.k8sUtil.changeNodeCondition(nodeName, "RebootRequested")
        }
        Channel.sendMessageEventToES({ node: nodeName, message: `Node ${nodeName} reboot starting.` })
    }

    //// Test fundtions
    public getIscordonTime(): (now: Date) => boolean {
        return this.isCordonTime
    }

    public getIsRebootTime(): (now: Date) => boolean {
        return this.isRebootTime
    }

    // public getFindRebootNodes(): (now: Date, getList: () => Array<{ nodeName: string, memory: string }>) => Array<string> {
    //     return this.findRebootNodes
    // }

    public getReloadConfigValues(): () => void {
        return this.reloadConfigValues.bind(this)
    }
}