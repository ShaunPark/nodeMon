import Channel from "../logger/Channel";
import ConfigManager from "../config/ConfigManager";
import { MessagePort } from "worker_threads"
import { BaseEvent, NodeConditionCache, NodeEvent, NodeInfo } from "../types/Type";
import Log from '../logger/Logger'
import Rebooter from "../reboot/Rebooter";
import K8SUtil from "../kubernetes/K8SUtil"
import * as util from "../util/Util";
import { NodeStatus } from "./NodeStatus";
const { parentPort } = require('worker_threads');


type EventTypes = "NodeCondition" | "NodeEvent" | "DeleteNode"
type NodeEventReason = "CordonFailed" | "DrainScheduled" | "DrainSchedulingFailed" | "DrainSucceeded" | "DrainFailed" | "Rebooted" | "NodeNotReady" | "NodeReady"

const NodeEventReasonArray = ["CordonFailed", "DrainScheduled", "DrainSchedulingFailed", "DrainSucceeded", "DrainFailed", "Rebooted", "NodeNotReady", "NodeReady"]
const startTime: Date = new Date()
const REBOOT_REQUESTED = "RebootRequested"
const NODE_CORDONED = "RebootScheduled"
const ONEDAYMILLISECOND = 86400000
const ONEMINUTEMILLISECOND = 60000

export default class NodeManager {
    private cmg: ConfigManager;
    private k8sUtil: K8SUtil
    private static lastRebootTime: Date | undefined
    private mainLoop?: NodeJS.Timeout

    /**
     * 생성자
     * @param configFile 설정파일 경로
     * @param dryRun 실제 실행 여부
     */
    constructor(private configFile: string, private dryRun: boolean) {
        // 부모 스레드가 있으면 부모스레드로 부터 전달되는 이벤트 핸들러 등록 
        if (parentPort) {
            parentPort.addEventListener("message", this.initMessageHandler)
        }
        // 속성 초기화
        this.cmg = new ConfigManager(this.configFile);
        this.k8sUtil = new K8SUtil(this.cmg.config)
    }

    /**
     * 노드매니저 종료
     */
    public close() {
        if (this.mainLoop !== undefined) {
            clearTimeout(this.mainLoop)
        }
    }

    /**
     * 스레드간 채널 연결 초기화
     * @param event 부모 스레드에서 받은 이벤트
     */
    private initMessageHandler = (event: MessageEvent) => {
        const ePort: MessagePort = event.data.port;

        if (event.data.type === "parent") {
            // 각 informer에서 이벤트를 받은 경우 
            // 이벤트 핸들러를 호출 하도록 함.
            ePort.addListener("message", this.onEvent);
        } else if (event.data.type === "shutdown") {
            // pod shutdown 시 처리 
            Log.info(`[NodeManager.initMessageHandler] Shutdown NodeManager`)
            this.close()
        } else {
            // Elastic Search exporter를 위한 포트를 받은 경우
            // Channel을 초기화 함 
            Channel.initLoggerForNodeManager(ePort);
        }
    }

    /**
     * Kubernetes 모니터에서 전달된 이벤트 처리
     */
    private onEvent = (event: any) => {
        Log.info(`[NodeManager.onEvent] ${event.nodeName}`)
        this.eventHandlers[event.kind as EventTypes](event);
    }
    /**
     * Informer들에서 전달된 이벤트들에 대한 핸들러들
     */
    private eventHandlers = {
        // 노드 상태 관련 이벤트 수신 시
        NodeCondition: (event: NodeInfo) => {
            const nodeName = event.nodeName;
            const nodeCondition = event as NodeInfo
            const node = NodeStatus.getNode(nodeCondition.nodeName)
            Log.info(`[NodeManager.eventHandlers] receive node condition : ${nodeName}`)
            Log.info(JSON.stringify(event))

            const status = nodeCondition.status + (nodeCondition.nodeUnscheduleable ? "/Unschedulable" : "")
            let rebootedTimeFromCondition: number = 0
            let hasRebootRequest = false
            let hasScheduled = false
            let scheduledTimeDt: Date = new Date(0)
            let rebootRequestedTimeDt: Date = new Date(0)

            nodeCondition.conditions.map(condition => {
                Log.info(condition.lastTransitionTime)
                if (condition.lastTransitionTime !== undefined) {
                    if (condition.type == "Ready" && condition.reason == "KubeletReady") {
                        rebootedTimeFromCondition = condition.lastTransitionTime.getTime()
                    }
                    if (condition.type == REBOOT_REQUESTED && condition.status == "True") {
                        hasRebootRequest = true
                        scheduledTimeDt = condition.lastTransitionTime
                    }
                    if (condition.type == NODE_CORDONED && condition.status == "True") {
                        hasScheduled = true
                        rebootRequestedTimeDt = condition.lastTransitionTime
                    }
                }
            })

            if (node !== undefined) { // 처음 수신한 노드 정보가 아닌경우 
                // 마지막 리부트 시간이 없는 경우 kubelet이 Ready가 된 시점으로 리부트 시간을 설정함
                const obj: { [key: string]: string | number | boolean } = {
                    ipAddress: nodeCondition.nodeIp,
                    lastUpdateTime: Date.now(),
                    status: status,
                    lastRebootedTime: (node.lastRebootedTime === 0) ? rebootedTimeFromCondition : node.lastRebootedTime,
                    hasScheduled: hasScheduled,
                    hasReboodRequest: hasRebootRequest,
                    scheduledTime: scheduledTimeDt.getTime(),
                    rebootRequestedTime: rebootRequestedTimeDt.getTime()
                }
                NodeStatus.setNode(node, obj)
            } else { // 처음 수신한 노드인 경우
                Channel.info(nodeName, 'Node added to monitoring list.')
                // 노드 정보를 생성하여 노드 목록에 추가
                const newNode: NodeConditionCache = {
                    UUID: btoa(nodeName),
                    nodeName: nodeName,
                    ipAddress: nodeCondition.nodeIp,
                    lastUpdateTime: Date.now(),
                    status: status,
                    lastRebootedTime: rebootedTimeFromCondition,
                    hasScheduled: hasScheduled,
                    hasReboodRequest: hasRebootRequest,
                    scheduledTime: scheduledTimeDt.getTime(),
                    rebootRequestedTime: rebootRequestedTimeDt.getTime()
                };
                NodeStatus.setNode(newNode)
            }
        },
        // 쿠버네트스 이벤트 수신 이벤트를 수신했을때의 처리
        NodeEvent: (event: NodeEvent) => {
            const nodeName = event.nodeName;
            Log.info(`[NodeManager.eventHandlers] receive events : ${nodeName}`)
            const node = NodeStatus.getNode(nodeName)
            // 이벤트 관련 노드가 관리 대상이 아닌경우 무시
            if (node == undefined) {
                Log.info(`[NodeManager.eventHandlers] Node ${nodeName} does not exist in list. Ignore`)
            } else {
                // 모니터 시작전 발생한 old 이벤트는 무시
                const raisedTime = event.lastTimestamp
                if (startTime.getTime() < raisedTime.getTime()) {
                    // 노드 정보 변경 시간 업데이트 
                    NodeStatus.setNode(node, { status: event.reason, lastUpdateTime: raisedTime })
                    // 이벤트가 원인이 모니터링 대상에 포함된 경우만 처리
                    if (NodeEventReasonArray.includes(event.reason)) {
                        Log.info(`[NodeManager.eventHandlers] event.reason '${event.reason}'is NodeEventReasons`)
                        // 수신된 이벤트에 따리 이벤트 핸들러 호출
                        this.eventHandlerOfEvent[event.reason as NodeEventReason](nodeName)
                    }
                } else {
                    Log.info(`[NodeManager.eventHandlers] Event raised at ${raisedTime}. Ignore old event.`)
                }
            }
        },
        // 노드가 삭제된 이벤트를 수신했을때의 처리
        DeleteNode: (event: BaseEvent) => {
            Log.info(`[NodeManager.eventHandlers] Node '${event.nodeName} removed from moritoring list. delete it.`)
            Channel.info(event.nodeName, `Node removed from moritoring list.`)
            NodeStatus.deleteNode(event.nodeName)
        }
    }

    // 노드 정보 출력 이벤트를 수신했을때의 처리
    // 노드 리스트를 테이블용 데이터로 만든 후 표로 출력
    private printNode = () => {
        const arr = new Array<Object>()
        NodeStatus.getAll().forEach((node, key) => {
            arr.push({
                name: key, ipAddress: node.ipAddress,
                lastUpdateTime: new Date(node.lastUpdateTime),
                status: node.status, lastRebootedTime: new Date(node.lastRebootedTime),
                hasScheduled: node.hasScheduled, hasReboodRequest: node.hasReboodRequest
            })
        })
        console.table(arr);
    }

    /**
     * 쿠버네티스에서 모니터링 된 이벤트에 대한 핸들러들
     */
    private eventHandlerOfEvent = {
        // cordon을 실패하면 바로 리부트/종료
        CordonFailed: (nodeName: string) => {
            Channel.warn(nodeName, `Failed to cordon node and a reboot process will start immediately.`)
            this.reboot(nodeName)
        },
        // drain이 준비 되었으면 실패 시를 위한 타이머를 설정함.
        DrainScheduled: (nodeName: string) => {
            Channel.info(nodeName, `Node draining is scheduled.`)
            this.setTimerForReboot(nodeName)
        },
        // drain 스케줄링이 실패하면 바로 리부트/종료
        DrainSchedulingFailed: (nodeName: string) => {
            Channel.warn(nodeName, `Failed to schedule a node drain and a reboot process will start immediately.`)
            this.reboot(nodeName)
        },
        // drain이 성공하면 바로 리부트/종료
        DrainSucceeded: (nodeName: string) => {
            Channel.info(nodeName, `Node drained and a reboot process will start immediately.`)
            this.reboot(nodeName)
        },
        // drain이 실패해도 바로 리부트/종료
        DrainFailed: (nodeName: string) => {
            Channel.warn(nodeName, `Failed to drain the node and a reboot process will start immediately.`)
            this.reboot(nodeName)
        },
        // 노드가 리부트 되었으면 리부트 시각을 노드정보에 설정
        // maintenance에 의해 리부트 된 경우 컨디션 제거 작업을 설정함
        Rebooted: (nodeName: string) => {
            Channel.info(nodeName, `Node rebooted`)
            const node = NodeStatus.getNode(nodeName)
            if (node && node.hasReboodRequest) {
                setTimeout(async () => {
                    await this.removeRebootCondition(nodeName)
                    this.unCordonNode(nodeName)
                }, 30 * 1000)
            }
            this.setNodeRebootTime(nodeName)
        },
        // 노드가 NotReady상태가 되었으면 리부트 시각을 노드정보에 설정
        NodeNotReady: (nodeName: string) => {
            Channel.info(nodeName, `Node stopped. (received 'NodeNotReady' event)`)
            this.setNodeRebootTime(nodeName)
        },
        // 노드가 Ready상태가 되었어도 리부트 시각을 노드정보에 설정    
        NodeReady: (nodeName: string) => {
            Channel.info(nodeName, `Node is ready now (receive 'NodeReady' event)`)
            this.setNodeRebootTime(nodeName)
        },
        // 아래 이벤트들은 무시
        CordonStarting: () => { },
        CordonSucceeded: () => { },
        DrainStarting: () => { },
        UncordonStarting: () => { },
        UncordonSucceeded: (nodeName: string) => {
            Log.info(`[NodeManager.UncordonSucceeded] uncordoned by draino remove node condition.`)
        },
        UncordonFailed: () => { },
    }

    /**
     * 노드가 리부트 된 시각을 설정함
     * @param nodeName  리부트 된 시각을 설정할 노드 명
     */
    private setNodeRebootTime(nodeName: string) {
        const node = NodeStatus.getNode(nodeName)
        if (node) {
            // 노드의 리부트 된 시각을 지금으로 설정
            NodeStatus.setNode(node, { lastRebootedTime: new Date() })
        }
    }

    /**
     * 리부트 작업을 수행
     * 
     * @param nodeName 리부트할 노드 명
     */
    private reboot(nodeName: string) {
        const config = this.cmg.config;
        const node = NodeStatus.getNode(nodeName)

        //리부트 방식 확인, 노드 리부트 혹은 AWS EC2인스턴스 종료 여부
        const isReboot: boolean = config.rebootThroughSSH === undefined || config.rebootThroughSSH === true
        const rebootStr = (isReboot) ? "Reboot" : "Termination"

        // 노드 목록에 노드가 있을때만 작업 수행 
        if (node !== undefined) {
            // drain 작업 실패 시 실행하기 위한 타이머가 설정되어 있으면 취소
            if (node.timer !== undefined) {
                clearTimeout(node.timer)
            }
            // 리부트를 위한 타이머 딜레이 설정. 초단위 0보다 작으면 0으로 설정
            let delay = config.rebootDelay * 1000
            if (config.rebootDelay <= 0) {
                delay = 0
            }

            const now = Date.now()
            const rebootBuffer = 3

            // 마지막으로 리부트 한 노드가 있으면 최소한 리부트 버퍼만큼 띄우고 작업하도록. 리부트 버퍼는 3분
            // 스케줄링과 상관 없이 실패에 의한 리부트가 있을 수 있으므로 여기서 한번 더 확인함
            // 최소한 동시에 리부트가 실행되지 않도록
            if (NodeManager.lastRebootTime !== undefined) {
                const nextRebootAvailable = NodeManager.lastRebootTime.getTime() + (ONEMINUTEMILLISECOND * rebootBuffer)

                if (nextRebootAvailable > now + delay) {
                    delay = nextRebootAvailable - now
                } else {
                    delay = delay
                }
            }
            // 리부트할 시각 계산 
            const rebootTime = new Date(now + delay)
            Channel.info(nodeName, `Node ${rebootStr} process will start at ${rebootTime}.`)
            // 타이머 설정 
            setTimeout(() => {
                Log.info(`[NodeManager.reboot] ${(isReboot) ? "Reboot" : "Termination"} ${nodeName} started.`)
                Channel.info(nodeName, `Node ${rebootStr} process starts now.`)
                // 리부트를 수행한 시간을 변경함
                NodeManager.lastRebootTime = new Date()
                // dry-run이 아니면 리부트/종료 수행
                if (this.dryRun !== true) {
                    Log.info(`[NodeManager.reboot] DryRun is not true. ${rebootStr} is enabled.`)

                    try {
                        const rebooter: Rebooter = new Rebooter(this.cmg)
                        rebooter.run(node.nodeName)
                        // 노드 정보에 마지막으로 리부트 한 시각 설정
                        NodeStatus.setNode(node, { lastRebootedTime: new Date() })
                    } catch (err) {
                        Channel.error(nodeName, `Node '${nodeName} ${rebootStr} is failed ${rebootTime}.`)
                        Log.error(`[NodeManager.reboot] ${err}`)
                    }
                }
            }, delay)
        }
    }

    /**
     * 일정시간 동안 drain작업이 종료되지 않은 경우를 대비한 타이머 설정
     * drain 대기시간은 10분 
     * 10분 이내에 drain 종료 이벤트가 오지 않으면 무조건 리부트 수행
     * 
     * @param nodeName 리부트 타이머를 설정할 노드 명
     */
    private setTimerForReboot(nodeName: string) {
        const drainBuffer = 10
        const timeout = drainBuffer * ONEMINUTEMILLISECOND;
        const node = NodeStatus.getNode(nodeName)

        const timer = setTimeout(() => {
            // 타임아웃이 되면 타이머를 제거하고 리부트 수행 
            if (node !== undefined) {
                NodeStatus.setNode(node, { timer: undefined })
            }
            Channel.warn(nodeName, `Node '${nodeName} draining failed for ${drainBuffer} minutes and will reboot in 1 minute.`)
            this.reboot(nodeName)
        }, timeout)

        // 타이머를 노드 리스트에 설정 - 정상적인 이벤트가 왔을 경우 타이머를 취소하기 위해서 
        if (node !== undefined) {
            NodeStatus.setNode(node, { timer: timer })
        }
    }

    /**
     * 노드매니저 메인 루틴, 기본 실행 주기는 10초, 최소 주기는 5초
     * 
     * 주기를 설정하여 checkNodeStatus()를 호출하고 Node목록을 로그에 출력
     */
    run() {
        const config = this.cmg.config;
        const interval = (config.nodeManager.interval && config.nodeManager.interval > 5000) ? config.nodeManager.interval : 10000;

        this.mainLoop = setInterval(() => {
            this.checkNodeStatus()
            this.printNode()
        }, interval)
    }

    /**
     * 현재 시각이 cordon 작업을 할 시점인지 확인
     * 
     * @param now 현재 시각
     * @returns cordon 작업 시간인지 여부 
     */
    private isCordonTime = (now: Date): boolean => {
        const ret = util.betweenTimes(now, this.cordonStartHour, this.cordonEndHour)
        Log.debug(`[NodeManager.isCordonTime] isCordonTime : ${ret}`)
        return ret
    }

    /**
     * 현재 시각이 리부트 작업을 할 시점인지 확인
     * 
     * @param now 현재 시각
     * @returns 리부트 작업 시간인지 여부 
     */
    private isRebootTime = (now: Date): boolean => {
        const ret = util.betweenTimes(now, this.rebootStartHour, this.rebootEndHoure)
        Log.debug(`[NodeManager.isRebootTime] isRebootTime : ${ret}`)
        return ret
    }

    // 설정 정보용 변수들
    private cordonStartHour: Date = new Date('Thu, 01 Jan 1970 20:00:00+09:00')
    private cordonEndHour: Date = new Date('Thu, 01 Jan 1970 21:00:00+09:00')
    private rebootStartHour: Date = new Date('Thu, 01 Jan 1970 03:00:00+09:00')
    private rebootEndHoure: Date = new Date('Thu, 01 Jan 1970 05:00:00+09:00')
    private percentOfReboot = 30
    private maxLivenessMilli = 10 * ONEDAYMILLISECOND
    private rebootBuffer = 15
    // 작업 진행상태 플래그
    private cordoned = false
    private rebootScheduled = false

    /**
     * 설정파일에서 필요한 설정 정보를 읽어옮
     */
    private reloadConfigValues = () => {
        const maint = this.cmg.config.maintenance
        if (maint !== undefined) {
            // 개발 테스트 모드일 경우. cordon 시작 시점부터 30초단위로 설정
            if (maint.testMode === true) {
                Log.info("[NodeManager.reloadConfigValues] TEST Mode !!!!!!!!!!!!!")
                this.cordonStartHour = util.timeStrToDate(maint.cordonStartHour, "20:00+09:00")
                this.cordonEndHour = new Date(this.cordonStartHour.getTime() + (60000))
                this.rebootStartHour = new Date(this.cordonStartHour.getTime() + (60000 * 5))
                this.rebootEndHoure = new Date(this.cordonStartHour.getTime() + (60000 * 6))

                this.percentOfReboot = maint.ratio
                if (this.percentOfReboot < 10 || this.percentOfReboot > 90) {
                    this.percentOfReboot = 20
                }

                this.maxLivenessMilli = maint.maxLivenessDays * ONEMINUTEMILLISECOND

                this.rebootBuffer = (maint.rebootBuffer) ? this.rebootBuffer : 15
                if (this.rebootBuffer < 1 || this.rebootBuffer > 30) {
                    this.rebootBuffer = 15
                }
            } else {
                // cordon 시간대 기본값 시작 : 20시-한국시간 종료 : 21시-한국시간
                this.cordonStartHour = util.timeStrToDate(maint.cordonStartHour, "20:00+09:00")
                this.cordonEndHour = util.timeStrToDate(maint.cordonEndHour, "21:00+09:00")
                // 시작 시각이 종료시각 보다 나중이면 종료시각을 시작시각 1시간 후로 설정 
                if (this.cordonStartHour.getTime() > this.cordonEndHour.getTime()) {
                    this.cordonEndHour.setHours(this.cordonStartHour.getHours() + 1)
                }
                // 리부트 시간대 기본값 시작 : 03시-한국시간 종료 : 04시-한국시간
                this.rebootStartHour = util.timeStrToDate(maint.rebootStartHour, "03:00+09:00")
                this.rebootEndHoure = util.timeStrToDate(maint.rebootEndHour, "04:00+09:00")
                // 시작 시각이 종료시각 보다 나중이면 종료시각을 시작시각 1시간 후로 설정 
                if (this.rebootStartHour.getTime() > this.rebootEndHoure.getTime()) {
                    this.rebootEndHoure.setHours(this.rebootStartHour.getHours() + 1)
                }
                // 리부트 비율은 기본 20%, 최소 10%, 최대 50%
                this.percentOfReboot = maint.ratio
                if (this.percentOfReboot < 10 || this.percentOfReboot > 50) {
                    this.percentOfReboot = 20
                }
                // 리부트 없이 노드가 유지되는 기간은 기본 14일, 최소 7일, 최대 28일
                this.maxLivenessMilli = maint.maxLivenessDays * ONEDAYMILLISECOND
                if (this.maxLivenessMilli < 7 * ONEDAYMILLISECOND || this.maxLivenessMilli > 28 * ONEDAYMILLISECOND) {
                    this.maxLivenessMilli = 14 * ONEDAYMILLISECOND
                }
                // 노드간 리부트 시 시간 간격은, 기본 15분, 최소 5분, 최대 30분 
                this.rebootBuffer = (maint.rebootBuffer) ? this.rebootBuffer : 15
                if (this.rebootBuffer < 5 || this.rebootBuffer > 30) {
                    this.rebootBuffer = 15
                }
            }
        }
    }
    /**
     * CORDONED 및 REBOOTED condition중 남아있는 컨디션 삭제
     * CORDONED NODE에 대해서는 UNCORDON수행 
     */
    private cleanConditions = async () => {
        Log.info("[NodeManager.cleanConditions] Cleaning node conditions.")
        const yesterDay = Date.now() - ONEDAYMILLISECOND
        const promises = Array.from(NodeStatus.getAll())
            .map(([_, node]) => node)
            .map(async (node) => {
                if (node.hasScheduled && node.scheduledTime < yesterDay) {
                    Log.info(`[NodeManager.cleanConditions] Node '${node.nodeName}' has scheduled reboot but it is too old. Delete schedule.`)
                    await this.removeCordonedCondition(node.nodeName, true)
                }
                if (node.hasReboodRequest && node.rebootRequestedTime < yesterDay) {
                    Log.info(`[NodeManager.cleanConditions] Node '${node.nodeName}' has requesed to reboot but it is too old. Delete request.`)
                    await this.removeRebootCondition(node.nodeName)
                }
            })
        Log.info("[NodeManager.cleanConditions] Cleaned node conditions.")
        await Promise.all(promises)
    }

    private cordonNodes = async (now: Date, numberOfReboot: number) => {
        // 이미 cordon을 수행 했는지 확인
        // 중복 작업을 제거함. 
        // 도중에 node mon이 재 기동 되더라도 다시 처리할 수 있음.
        if (this.cordoned === false) {
            Log.info("[NodeManager.checkNodeStatus] Time to cordon check")

            await this.cleanConditions()
            // 일정시간동안 리부트 되지 않은 노드를 목록으로 조회
            const arr = this.findOldNodes(now)
            Log.info(`[NodeManager.checkNodeStatus] Reboot Schedule nodes : ${JSON.stringify(arr)}`)

            // 해당 노드들에 대해서 cordon 작업을 수행하고 리부트 우선순위 목록에 추가함
            // 최대 리부트 수 까지만 cordon을 수행
            arr.slice(0, numberOfReboot).forEach(node => {
                this.cordonNode(node)
            })
            // cordon 작업이 수행되었음을 표시
            this.cordoned = true
        } else {
            Log.info("[NodeManager.checkNodeStatus] Time to cordon check but already done")
        }
    }

    private rebootNodes = async (numberOfReboot: number) => {
        // 리부트 작업이 실행되지 않은 경우만 수행

        if (this.rebootScheduled === false) {
            // condition 기반으로 CORDON이 수행된 노드 목록을 조회
            const rebootList = this.getCordonedNode()
            const cordonedCount = rebootList.length;

            Log.info("[NodeManager.checkNodeStatus] Time to reboot check")
            Log.info(`[NodeManager.checkNodeStatus] nubmer of reboot by max liveness : ${cordonedCount}`)

            // 만약 cordon이 수행된 노드 수가 리부트할 최대 노드 수 보다 적으면 추가로 reboot할 노드를 추가함 
            if (numberOfReboot > cordonedCount) {
                Log.debug("[NodeManager.checkNodeStatus] reboot scheduled nodes are less than numberOfReboot. add more!")
                const sortedNodeListWithoutCordonedNodes = await this.filterRebootNode(rebootList)
                sortedNodeListWithoutCordonedNodes.forEach(node => rebootList.push(node))

                this.scheduleRebootNodes(rebootList.slice(0, numberOfReboot))
            } else {
                this.scheduleRebootNodes(rebootList)
            }

            // 선택된 노드들에 대해서 리부트 작업을 스케쥴링 
            this.rebootScheduled = true
        } else {
            Log.info("[NodeManager.checkNodeStatus] Time to reboot check but already done")
        }
    }

    /**
     * 주기적으로 작업 스케줄과 노드 상태를 확인하여 cordon 및 리부트 작업을 수행함
     * 
     */
    private checkNodeStatus = async () => {
        const maint = this.cmg.config.maintenance

        // maintenance 관련 설정이 있고 실행하도록 설정되어 있을때만 실행
        if (maint && maint.runMaintenance) {
            // 이미 cordon 시간대 이거나 reboot 작업 시간인 경우는 설정 정보를 리로드 하지 않음
            // 그렇지 않으면 설정정보를 새로 읽어옮
            // 따라서 cordon 작업시간 중이거나 reboot 작업시간 중에 설정파일을 변경하더라도 적용되지 않음
            if (!this.cordoned && !this.rebootScheduled) {
                this.reloadConfigValues()
            }

            const now = new Date()
            // 매일 리부트할 최대 노드 수를 계산
            const numberOfReboot = Math.ceil(NodeStatus.getAll().size * (this.percentOfReboot / 100))
            Log.info(`[NodeManager.checkNodeStatus] nubmer of reboot : ${numberOfReboot}`)
            // 지금이 cordon작업을 수행할 시점인지 확인 
            if (this.isCordonTime(now)) {
                await this.cordonNodes(now, numberOfReboot)
            } else {
                // cordon시간대가 아니지만 cordon 작업을 수핸한 경우는 cordon 작업시간대가 끝난 처음이므로 로그를 남김
                if (this.cordoned == true) {
                    Log.info("[NodeManager.checkNodeStatus] End ofcordon check")
                }
                this.cordoned = false;
            }

            // 지금이 reboot 작업을 수행할 시점인지 확인
            if (this.isRebootTime(now)) {
                this.rebootNodes(numberOfReboot)
            } else {
                // reboot 시간이 끝나면 reboot 대상 노드들을 목록에서 제거
                if (this.rebootScheduled === true) {
                    Log.info("[NodeManager.checkNodeStatus] End of reboot check")
                }
                this.rebootScheduled = false
            }
        }
    }

    /**
     * 노드 중에서 일정 기간동안 리부트 되지 않은 노드 목록을 조회
     * 
     * maintenance.maxLivenessDays : 정해진 일 수 이상 리부트 되지 않은 경우 무조건 리부트 하도록 함. 기본값 10일
     * 
     * @param now  현재 시각
     * @returns 일정 기간동안 리부트 되지 않는 노드 이름 목록
     */
    private findOldNodes = (now: Date): Array<string> => {
        const rebootTime = now.getTime() - (this.maxLivenessMilli)

        return NodeStatus.findNodes(node => {
            if (node.lastRebootedTime !== 0) {
                return node.lastRebootedTime < rebootTime
            }
            return false
        })
    }

    private getCordonedNode(): string[] {
        return NodeStatus.findNodes(node => node.hasScheduled)
    }

    /**
     * 전체 모니터링 대상 노드 중에서  아래 조건의 노드를 제외
     *  - 워커가 실행중인 노드
     *  - 이미 NodeMon에 의해 Cordon된 노드
     *  - 하루이내에 리부트된 노드 
     * 
     * @returns 필터링되고 정렬된 리부트 대상 노드이름 배열
     */
    private async filterRebootNode(cordonedList: string[]): Promise<string[]> {
        // worker가 실행중인 노드 목록 조회
        const nodesHasWorker = await this.getNodeHasWorker()
        Log.debug(`[NodeManager.filterRebootNode] Node has workder ${JSON.stringify(nodesHasWorker)}`)
        const yesterday = Date.now() - (ONEDAYMILLISECOND)

        const filteredNodes = NodeStatus.findNodes(node => {
            let rebootOneMoreDaysAgo = true
            if (node.lastRebootedTime !== 0) {
                rebootOneMoreDaysAgo = node.lastRebootedTime < yesterday
            }
            return !nodesHasWorker.includes(node.nodeName) && !cordonedList.includes(node.nodeName) && rebootOneMoreDaysAgo

        })
        Log.debug(`[NodeManager.filterRebootNode] Filtered nodes ${JSON.stringify(filteredNodes)}`)
        return Promise.resolve(filteredNodes)
    }

    /**
     * 워커를 표시하는 Pod 레이블 및 필드를 기준으로 워커가 실행중인 노드 목록을 조회
     * @returns 워커가 실행중인 노드 목록
     */
    private async getNodeHasWorker(): Promise<string[]> {
        const fieldSelector = this.cmg.config.kubernetes.workerPodFieldSelector
        const labelSelector = this.cmg.config.kubernetes.workerPodLabelSelector
        return this.k8sUtil.getNodeListOfPods(fieldSelector, labelSelector)
    }

    /**
     * 전달된 노드 이름들에 대해서 순차적으로 리부트를 하도록 timeout설정
     * 
     * maintenance.rebootBuffer : 리부트 노드들 간의 시간 간격 설정. 설정되어있지 않으면 15분.
     * 
     * @param list 리부트 스케줄 대상 노드 이름 배열
     */
    private scheduleRebootNodes(list: string[]) {
        list.forEach((nodeName, index) => {
            const delay = index * (this.rebootBuffer * ONEMINUTEMILLISECOND) + 1000
            Log.debug(`[NodeManager.scheduleRebootNodes] Set timer for reboot '${nodeName} ${delay}`)
            const scheduledTime = new Date(Date.now() + delay)
            Channel.info(nodeName, `Node reboot is scheduled at ${scheduledTime}`)
            setTimeout(() => this.setNodeConditionToReboot(nodeName), (delay < 0) ? 0 : delay)
            if (!NodeStatus.isCordoned(nodeName)) {
                Log.debug(`[NodeManager.scheduleRebootNodes] Node is not cordoned by current node mon. remove condition`)
                this.removeCordonedCondition(nodeName, false)
            }
        })
    }

    private getNextRebootTime(): Date {
        const now = new Date()
        if (this.cordonStartHour > this.rebootStartHour) {
            const tommorow = new Date(now.getTime() + ONEDAYMILLISECOND)
            return new Date(tommorow.setHours(this.rebootStartHour.getHours(), this.rebootStartHour.getMinutes(), this.rebootStartHour.getSeconds(), 0))
        } else {
            return new Date(now.setHours(this.rebootStartHour.getHours(), this.rebootStartHour.getMinutes(), this.rebootStartHour.getSeconds(), 0))
        }
    }

    /**
     * 전달된 노드 명에 해당하는 노드에 대해서  cordon 수행 
     * 
     * @param nodeName cordon을 수행할 노드 명
     */
    private async cordonNode(nodeName: string) {
        Log.debug(`[NodeManager.cordonNode] Node ${nodeName} cordoned`)

        // dry-run이 아닌 경우 cordon 수행
        if (!this.cmg.config.dryRun) {
            const rebootTime = this.getNextRebootTime()
            await this.k8sUtil.changeNodeCondition(nodeName, NODE_CORDONED, "True", `Reboot scheduled by nodeMon : ${rebootTime.toISOString()}`)
            await this.k8sUtil.cordonNode(nodeName)
        }
        Channel.info(nodeName, `Node cordoned`)
    }

    private async unCordonNode(nodeName: string) {
        if (!this.cmg.config.dryRun) {
            if (NodeStatus.isCordoned(nodeName)) {
                await this.removeCordonedCondition(nodeName, true)
            } else {
                this.k8sUtil.changeNodeCondition(nodeName, REBOOT_REQUESTED, "False")
            }
        }
    }

    /**
     * 리부트가 종료 된 후 해당 리부트 작업을 위해 사용된 condition을 삭제
     * 
     * @param nodeName reboot를 위한 condition을 제거할 노드 명 
     */
    private removeRebootCondition = async (nodeName: string) => {
        Log.debug(`[NodeManager.removeRebootCondition] Node ${nodeName} RebootRequested`)

        // dry-run이 아닌 경우에만 수행 
        if (!this.cmg.config.dryRun) {
            // 먼저 RebootRequested 컨디션을 False로 변경 
            await this.k8sUtil.removeNodeCondition(nodeName, REBOOT_REQUESTED)
            Channel.info(nodeName, `Node reboot process finished.`)
        }
    }

    /**
     * 리부트가 시작 된 후 해당 리부트 작업 시작을 위해 사용된 condition을 삭제
     * 
     * @param nodeName reboot 시작을 위한 condition을 제거할 노드 명 
     */
    private removeCordonedCondition = async (nodeName: string, doUnCordon: boolean) => {
        Log.debug(`[NodeManager.removeCordonedCondition] Node ${nodeName}`)

        // dry-run이 아닌 경우에만 수행 
        if (!this.cmg.config.dryRun) {
            if (await this.k8sUtil.removeNodeCondition(nodeName, NODE_CORDONED) && doUnCordon) {
                Log.debug(`[NodeManager.removeCordonedCondition] unCordon Node : ${nodeName}`)
                this.k8sUtil.uncordonNode(nodeName)
            }
        }
    }

    /**
     * 리부트 프로세스 시작점
     * draino가 drain작업을 수행하도록 RebootRequested 컨디션을 생성하고 True로 설정
     * draino에 의해 drain이 완료되면 리부트 단계로 넘어감.
     * 
     * @param nodeName reboot를 위한 condition을 생성할 노드 명 
     */
    private setNodeConditionToReboot = (nodeName: string) => {
        Log.debug(`[NodeManager.setNodeConditionToReboot] Node ${nodeName} is scheduled for reboot`)

        // 리부트된 노드 목록에 해당 노드를 추가
        // this.rebootedList.add(nodeName)

        // dry-run이 아닌 경우에만 수행 
        if (!this.cmg.config.dryRun) {
            this.k8sUtil.changeNodeCondition(nodeName, REBOOT_REQUESTED, "True")
        }
        Channel.info(nodeName, `Node reboot process started.`)
    }


    //// Test fundtions: 아래는 테스트를 위한 임시 함수들
    public getIscordonTime(): (now: Date) => boolean {
        return this.isCordonTime
    }

    public getIsRebootTime(): (now: Date) => boolean {
        return this.isRebootTime
    }

    public getReloadConfigValues(): () => void {
        return this.reloadConfigValues.bind(this)
    }
}