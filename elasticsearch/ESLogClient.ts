import Log from "../logger/Logger";
import ConfigManager from "../config/ConfigManager";
import { ESClient } from "./ESClient";

export type LogType = {
    logType: "Error"|"Info"|"Warning"
    nodeName: string,
    message?: string
};

const mapping = {
    logType: {type:"keyword"},
    nodeName: { type: "keyword" },
    message: { type: "text" }
}

export class ESLogClient extends ESClient<LogType> {
    constructor(configManager: ConfigManager) {
        const el = configManager.config.elasticSearch;
        if (el !== undefined) {
            const { host, port, logIndex } = el
            super(logIndex, `http://${host.trim()}:${port}`, mapping, el)
        } else {
            Log.error("[ESLogClient] ElasticSearch connection information is not set in config file.")
        }
    }

    public putLog(log: LogType) {
        super.put(log)
    }

    public async searchLog(log: LogType): Promise<Array<LogType>> {
        return super.search(log)
    }
}