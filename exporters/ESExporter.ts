import { MessagePort } from "worker_threads"
import ConfigManager from "../config/ConfigManager";
import { logger } from '../logger/Logger'
import { NodeConditionCache } from "../managers/NodeManager";
import { NodeCondition } from "../types/Type";
import { ESLogClient } from "../utils/ESLogClient";

const { workerData, parentPort } = require('worker_threads');
export class ESLog {
    constructor(public node: string, public message: string) {}
}

class NodeCache implements NodeConditionCache {
    ipAddress: string = "";
    conditions: Map<string, NodeCondition> = new Map<string,NodeCondition>();
    lastUpdateTime: Date = new Date();
    status: string =""
    timer?: NodeJS.Timeout | undefined;
    lastRebootedTime?: Date | undefined;
    nodeName: string = "";
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

    private log = (event: MessageEvent<ESLog> | MessageEvent<NodeCache>) => {
        logger.info(`log in es exporter : ${JSON.stringify(event)}`)
        if (event.data instanceof ESLog) {
            this.esLogger.putLog({ nodeName: event.data.node, message: event.data.message })
        } else if ( event.data instanceof NodeCache) {
            logger.info(`NodeStatus : ${JSON.stringify(event)}`)
        }
    }

    run = () => { }
}

const esExporter = new ESExporter(workerData?.config)
process.on('SIGTERM', function onSigterm() {
    logger.info('ESExporter - Got SIGTERM.')
})

esExporter.run()