import { MessagePort } from "worker_threads"
import ConfigManager from "../config/ConfigManager";
import Log from '../logger/Logger'
import { NodeConditionCache } from "../types/Type";
import { ESLogClient } from "./ESLogClient";
import { ESNodeStatus, ESStatusClient } from "./ESStatusClient";

const { workerData, parentPort } = require('worker_threads');


export interface ESMessage {
    kind: "log"|"status"
    log?: ESLog
    status?: ESNodeStatus
}
export interface ESLog {
    logType: "Error" | "Info" | "Warning",
    node: string,
    message: string
}
class ESExporter {
    private configManager
    private esLogger;
    private esStatus;
    constructor(configFile: string) {
        parentPort.addEventListener("message", this.initMessageHandler)
        this.configManager = new ConfigManager(configFile);
        this.esLogger = new ESLogClient(this.configManager)
        this.esStatus = new ESStatusClient(this.configManager)
    }

    private initMessageHandler = (event: MessageEvent) => {
        const ePort: MessagePort = event.data.port;
        if (ePort !== undefined)
            ePort.addListener("message", this.log);
    }

    private log = (event: MessageEvent<ESMessage>) => {
        // logger.info(`log in es exporter : ${JSON.stringify(event)}`)
        if (event.data.kind === "log" && event.data.log) {
            this.esLogger.putLog({ logType: event.data.log.logType, nodeName: event.data.log.node, message: event.data.log.message })
        } else if (event.data.kind === "status" && event.data.status) {
            this.esStatus.updateStatus(event.data.status)
        }
    }
}

new ESExporter(workerData?.config)
process.on('SIGTERM', function onSigterm() {
    Log.info('[ESExporter.onSigterm]Got SIGTERM in ESExporter. Graceful shutdown start')
})
