import { MessagePort } from "worker_threads"
import ConfigManager from "../config/ConfigManager";
import { logger } from '../logger/Logger'
import { ESLogClient } from "../utils/ESLogClient";

const { workerData, parentPort } = require('worker_threads');
interface ESLog {
    node:string,
    message:string
}
class ESExporter {
    private configManager
    private esLogger;
    constructor(configFile:string) {
        parentPort.addEventListener("message", this.initMessageHandler)
        this.configManager = new ConfigManager(configFile);
        this.esLogger = new ESLogClient(this.configManager)
    }

    private initMessageHandler = (event: MessageEvent) => {
        const ePort: MessagePort = event.data.port;
        ePort.addListener("message", this.log);
    }

    private log = (event: MessageEvent<ESLog>) => {
        logger.info(`log in es exporter : ${JSON.stringify(event)}`)

        this.esLogger.putLog({nodeName:event.data.node, message:event.data.message})
    }

    run = () => {}
}

const esExporter = new ESExporter(workerData?.config)
esExporter.run()