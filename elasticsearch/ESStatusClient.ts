import Log from "../logger/Logger";
import ConfigManager from "../config/ConfigManager";
import { NodeCondition } from "../types/Type";
import { ESClient } from "./ESClient";


export interface ESNodeStatus {
    ipAddress?: string
    conditions?: Map<string, NodeCondition>
    lastUpdateTime?: Date
    status?: string,
    lastRebootedTime?: Date,
    nodeName?: string,
    UUID: string
}

const mapping = {
    ipAddress: { type: "ip" },
    conditions: { type: "object" },
    lastUpdateTime: { type: "date" },
    status: { type: "keyword" },
    lastRebootedTime: { type: "date" },
    nodeName: { type: "keyword" },
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

    // public putStatus(status: ESNodeStatus) {
    //     super.put(status)
    // }

    public async updateStatus(status: ESNodeStatus) {
        const searchStatus = { UUID: status.UUID }
        try {
            const arr = await super.searchId(searchStatus, "timestamp")
            // console.log(JSON.stringify(arr))
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

    // public async searchStatus(status: ESNodeStatus): Promise<Array<ESNodeStatus>> {
    //     return super.search(status)
    // }
}