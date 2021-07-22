import ConfigManager from "../config/ConfigManager";
import { ESClient } from "./ESClient";

export type LogType = {
    nodeName: string,
    message?: string
};

const mapping = {
    nodeName: { type: "keyword" },
    message: { type: "text" }
}

export class ESLogClient extends ESClient<LogType> {
    constructor(configManager: ConfigManager) {
        const el = configManager.config.elasticSearch;
        if (el !== undefined) {
            const { host, port, logIndex } = el
            super(logIndex, `http://${host.trim()}:${port}`, mapping)
        } else {
            console.error("ElasticSearch connection information is not set in config file.")
        }
    }

    public putLog(log: LogType) {
        super.put(log)
    }

    public async searchLog(log: LogType): Promise<Array<LogType>> {
        return super.search(log)
    }
}