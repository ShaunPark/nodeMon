import ConfigManager from "../config/ConfigManager";
import { NodeConditionCache } from "../managers/NodeManager";
import { NodeCondition } from "../types/Type";
import { ESClient } from "./ESClient";


export interface ESNodeStatus {
    ipAddress?: string
    conditions?: Map<string, NodeCondition>
    lastUpdateTime?: Date
    status?: string,
    timer?: NodeJS.Timeout,
    lastRebootedTime?: Date,
    nodeName?: string,
    UUID: string
}

export class ESStatusClient extends ESClient<ESNodeStatus> {
    constructor(configManager: ConfigManager) {
        const el = configManager.config.elasticSearch;
        if (el !== undefined) {
            const { host, port, statusIndex } = el
            super(statusIndex, `http://${host.trim()}:${port}`)
        } else {
            console.error("ElasticSearch connection information is not set in config file.")
        }
    }

    public putStatus(status: ESNodeStatus) {
        super.put(status)
    }

    public async updateStatus(status: ESNodeStatus) {
        const searchStatus = { UUID: status.UUID }
        try {
            const arr = await super.searchId(searchStatus)
            console.log(JSON.stringify(arr))
            if (arr.length == 0) {
                super.put(status)
            } else {
                super.update(arr[0], status)
            }
        } catch (err) {

        }
    }

    public async searchStatus(status: ESNodeStatus): Promise<Array<ESNodeStatus>> {
        return super.search(status)
    }
}