import { Client, RequestParams } from '@elastic/elasticsearch';
import { logger } from '../logger/Logger'

export abstract class ESClient<T> {
  private client: Client;

  protected INDEX_NAME: string;

  constructor(indexName: string, hostString: string) {
    this.INDEX_NAME = indexName;
    this.client = new Client({ node: hostString })
  }

  public async createIndex() {
    if (!this.client.indices.exists({ index: this.INDEX_NAME })) {
      await this.client.indices.create({ index: this.INDEX_NAME });
    }
  }

  protected put(log: T) {
    try {
      const bodyData: RequestParams.Index = {
        index: this.INDEX_NAME,
        body: {
          ...log,
          timestamp: new Date()
        }
      };
      logger.info("[SUCCESS]: ElasticSearchAPILog putLog method");

      return this.client.index(bodyData);
    } catch (error) {
      logger.info(
        `[ERROR]:  ElasticSearchAPILog putLog method, error-message=${error.message}`
      );
      console.error(error)
      return;
    }
  }

  protected async search(log: T): Promise<Array<T>> {
    try {
      const bodyData: RequestParams.Search = {
        index: this.INDEX_NAME,
        body: {
          query: {
            match: log
          }
        }
      };
      logger.info(JSON.stringify(bodyData))
      logger.info("[SUCCESS]: ElasticSearchAPILog searchLog method");

      const { body } = await this.client.search(bodyData);

      const retArr = new Array<T>()
      const arr: any[] = body.hits.hits;
      logger.info(JSON.stringify(body))
      arr.forEach(item => { retArr.push(item._source as T) })

      logger.info(retArr.length)
      return retArr
    } catch (error) {
      logger.info(
        `[ERROR]:  ElasticSearchAPILog putLog method, error-message=${error.message}`
      );
      throw error;
    }
  }

  public async updateLog(log: T) {
    try {

    } finally {

    }
  }
}
