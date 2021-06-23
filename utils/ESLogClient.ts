import { RequestParams } from "@elastic/elasticsearch";
import { ESClient } from "./ESClient";

const INDEX_NAME = "node_condition"

export type LogType = {
    node: string,
    condition?: string,
    status?: boolean
};

export class ESLogClient extends ESClient<LogType> {
    constructor() {
        super(INDEX_NAME)
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
    public async searchLog(log: LogType) {
        try {
            const bodyData: RequestParams.Search = {
              index: this.INDEX_NAME,
              body: {
                  query: {
                      match: log
                  }
              }
            };
            console.log("[SUCCESS]: ElasticSearchAPILog putLog method");

            const {body} = await this.search(bodyData);

            const arr:any[] = body.hits.hits;
            arr.map( item => {console.log(item._source)})
        } catch (error) {
            console.log(
              `[ERROR]:  ElasticSearchAPILog putLog method, error-message=${error.message}`
            );
            return;
        }
    }

}