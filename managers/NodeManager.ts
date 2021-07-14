import { MessagePort } from "worker_threads"
import Logger from "../logger/Logger";
import express from "express"
import { IConfig, NodeCondition, NodeEvent } from "../types/Type";
import AWSShutdown from "../utils/AWSReboot";
import SSHReboot from "../utils/SSHReboot"
import ConfigManager from "../config/ConfigManager";
import { eventHandlers, NodeConditionCache } from "./NodeCache";

const { workerData, parentPort } = require('worker_threads');

export type NodeStatus = "Ready" | "Cordoned" | "DrainScheduled" | "DrainStarted" | "Drained" | "DrainTimeout" | "DrainFailed" | "RebootScheduled" | "NotReady"
type EventTypes = "NodeCondition" | "NodeEvent" | "DeleteNode"

class NodeManager {
    private application: express.Application;
    private static nodes = new Map<string, NodeConditionCache>()
    private configManager: ConfigManager;

    constructor(private configFile: string) {
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
            Logger.initLoggerForNodeManager(ePort);
        }
    }

    // Kubernetes 모니터에서 전달된 이벤트 처리
    private onEvent = (event: any) => {
        //수신한 이벤트를 처리
        eventHandlers[event.kind as EventTypes](event, NodeManager.nodes, this.configManager);
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
        //     console.log("express started")
        // })

        setInterval(() => {
            eventHandlers['PrintNode'](NodeManager.nodes)
            //eventHandlers['CleanNode'](NodeManager.nodes)
        }, interval)
    }

    private checkNodeStatus = () => {
        // console.log("Node status !!! ") 
        // this.nodes.forEach( (node, nodeName) => {
        //     console.log(`${nodeName}`)
        //     node.forEach( (condition, type) => {
        //         console.log(`${type} : ${condition.status} : ${condition.reason}`)
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
        Logger.sendEventToES("messsage from nodemanager")
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

const nodeManager = new NodeManager(workerData?.config)
nodeManager.run()

export default NodeManager;