import { MessagePort } from "worker_threads"
import ConfigManager from "../config/ConfigManager";
import { logger } from '../logger/Logger'
import { NodeConditionCache } from "../managers/NodeManager";
import { ESLogClient } from "../utils/ESLogClient";

const { workerData, parentPort } = require('worker_threads');


export interface ESMessage {
    kind: string
    log?: ESLog
    status?:NodeConditionCache
}
export interface ESLog {
    node: string,
    message: string
}
class ESExporter {
    private configManager
    private esLogger;
    constructor(configFile: string) {
        parentPort.addEventListener("message", this.initMessageHandler)
        this.configManager = new ConfigManager(configFile);
        this.esLogger = new ESLogClient(this.configManager)
    }

    private initMessageHandler = (event: MessageEvent) => {
        const ePort: MessagePort = event.data.port;
        ePort.addListener("message", this.log);
    }

    private log = (event: MessageEvent<ESMessage>) => {
        logger.info(`log in es exporter : ${JSON.stringify(event)}`)
        if (event.data.kind === "log" && event.data.log) {
            this.esLogger.putLog({ nodeName: event.data.log.node, message: event.data.log.message })
        } else if ( event.data.kind === "status" && event.data.status) {
            logger.info(`NodeStatus : ${JSON.stringify(event.data.status)}`)
        }
    }

    run = () => { }
}

const esExporter = new ESExporter(workerData?.config)
process.on('SIGTERM', function onSigterm() {
    logger.info('ESExporter - Got SIGTERM.')
})

esExporter.run()