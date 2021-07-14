import { RequestParams } from "@elastic/elasticsearch";
import ConfigManager from "../config/ConfigManager";
import { ESClient } from "./ESClient";

export type LogType = {
    nodeName: string,
    message?: string
};

export class ESLogClient extends ESClient<LogType> {
    constructor(configManager:ConfigManager) {
        const el = configManager.config.elasticSearch;
        if( el !== undefined) {
            const {host, port, logIndex} = el
            super(logIndex, `http://${host.trim()}:${port}`)
        } else {
            console.error("ElasticSearch connection information is not set in config file.")
        }
    }

    public putLog(log: LogType): Promise<void>|undefined {
        try {
            const bodyData: RequestParams.Index = {
              index: this.INDEX_NAME,
              body: {
                ...log,
                timestamp: new Date()
              }
            };
            console.log("[SUCCESS]: ElasticSearchAPILog putLog method");

            return this.requestElasticSearch(bodyData);
        } catch (error) {
            console.log(
              `[ERROR]:  ElasticSearchAPILog putLog method, error-message=${error.message}`
            );
            return;
        }
    }

    public async searchLog(log: LogType):Promise<Array<LogType>>{
        try {
            const bodyData: RequestParams.Search = {
              index: this.INDEX_NAME,
              body: {
                  query: {
                      match: log
                  }
              }
            };
            console.log("[SUCCESS]: ElasticSearchAPILog searchLog method");

            const {body} = await this.search(bodyData);

            console.log(JSON.stringify(body))
            const retArr = new Array<LogType>()

            const arr:any[] = body.hits.hits;
            arr.map( item => { retArr.push(item._source as LogType)})
            return Promise.resolve(retArr)
        } catch (error) {
            console.log(
              `[ERROR]:  ElasticSearchAPILog putLog method, error-message=${error.message}`
            );
            throw error;
        }
    }

    public async updateLog(log: LogType) {
        try {
            
        } finally {
            
        }
    }
}