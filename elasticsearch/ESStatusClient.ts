import Log from "../logger/Logger";
import ConfigManager from "../config/ConfigManager";
import { NodeCondition } from "../types/Type";
import { ESClient } from "./ESClient";


export interface ESNodeStatus {
    clusterName?:string,
    ipAddress?: string,
    conditions?: Map<string, NodeCondition>
    lastUpdateTime?: Date
    status?: string,
    lastRebootedTime?: Date,
    nodeName?: string,
    UUID: string
}

const mapping = {
    clusterName: {type:"keyword"},
    nodeName: { type: "keyword" },
    ipAddress: { type: "ip" },
    status: { type: "keyword" },
    lastUpdateTime: { type: "date" },
    lastRebootedTime: { type: "date" },
    conditions: { type: "object" },
    UUID: { type: "keyword" }
}
export class ESStatusClient extends ESClient<ESNodeStatus> {
    constructor(configManager: ConfigManager) {
        const el = configManager.config.elasticSearch;
        if (el !== undefined) {
            const { host, port, statusIndex } = el
            super(statusIndex, `http://${host.trim()}:${port}`, mapping, el)
        } else {
            Log.error("[ESStatusClient] ElasticSearch connection information is not set in config file.")
        }
    }
    public async updateStatus(status: ESNodeStatus) {
        const searchStatus = { UUID: status.UUID }
        try {
            const arr = await super.searchId(searchStatus, "timestamp")
            if (arr.length == 0) {
                super.put(status)
            } else {
                super.update(arr[0], status)
                if (arr.length > 1) {
                    arr.slice(1).forEach((id) => {
                        super.delete(id)
                    })
                }
            }
        } catch (err) {

        }
    }
}