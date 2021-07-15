import { Client, RequestParams } from '@elastic/elasticsearch';
import { logger } from '../logger/Logger'

export abstract class ESClient<T> {
  private client: Client;

  protected INDEX_NAME: string;

  constructor(indexName: string, hostString: string) {
    this.INDEX_NAME = indexName;
    this.client = new Client({ node: hostString })
    this.createIndex()
  }

  public async createIndex() {
    if (!this.client.indices.exists({ index: this.INDEX_NAME })) {
      await this.client.indices.create({ index: this.INDEX_NAME });
    }
  }

  protected put(data: T) {
    try {
      const bodyData: RequestParams.Index = {
        index: this.INDEX_NAME,
        body: {
          ...data,
          timestamp: new Date()
        }
      };

      return this.client.index(bodyData);
    } catch (error) {
      logger.error(
        `ESClient put method, error-message=${error.message}`
      );
      console.error(error)
      return;
    }
  }

  protected async search(data: T): Promise<Array<T>> {
    try {
      const bodyData: RequestParams.Search = {
        index: this.INDEX_NAME,
        body: {
          query: {
            match: data
          }
        }
      };
      logger.info(JSON.stringify(bodyData))

      const { body } = await this.client.search(bodyData);

      const retArr = new Array<T>()
      const arr: any[] = body.hits.hits;
      logger.info(JSON.stringify(body))
      arr.forEach(item => { retArr.push(item._source as T) })

      logger.info(retArr.length)
      return retArr
    } catch (error) {
      logger.error(
        `ESClient search method, error-message=${error.message}`
      );
      return Promise.reject()
    }
  }

  protected async searchId(data: T): Promise<Array<string>>{
    try {
      const bodyData: RequestParams.Search = {
        index: this.INDEX_NAME,
        body: {
          query: {
            match: data
          }
        }
      };
      logger.info(JSON.stringify(bodyData))

      const { body } = await this.client.search(bodyData);

      const retArr = new Array<string>()
      const arr: any[] = body.hits.hits;

      arr.forEach(item => { retArr.push(item._id) })

      return retArr
    } catch (error) {
      logger.error(
        `ESClient search method, error-message=${error.message}`
      );
      return Promise.reject()
    }
  }

  public async update(id: string, data: T) {
    try {

      logger.info(id)

      const bodyData: RequestParams.Index = {
        index: this.INDEX_NAME,
        id: id,
        body: {
          ...data,
          timestamp: new Date()
        }
      }
      return this.client.index(bodyData);
    } catch (error) {
      logger.error(
        `ESClient update method, error-message=${error.message}`
      );
      // throw error;
    }
  }
}
