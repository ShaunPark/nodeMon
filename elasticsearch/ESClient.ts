import { Client, RequestParams } from '@elastic/elasticsearch';
import Log from '../logger/Logger'
import { IElasticSearch } from '../types/ConfigType';

export abstract class ESClient<T> {
  private client: Client;

  constructor(private INDEX_NAME: string, hostString: string, private mapping:Object, el: IElasticSearch ) {
    if (el.useApiKey && el.apiKey !== undefined) {
      this.client = new Client({
        node: hostString, auth: {
          apiKey: el.apiKey
        }
      })
    } else if (!el.useApiKey && el.id !== undefined ) {
      const password = (process.env.ES_PASSWORD)?process.env.ES_PASSWORD:""
      this.client = new Client({
        node: hostString, auth: {
          username: el.id,
          password: password
        }
      })
    } else {
      this.client = new Client({ node: hostString })
    }
    this.createIndex()
  }

  private async createIndex() {
    Log.debug(`[ESClient.createIndex] Check Index : ${this.INDEX_NAME}`)
    const exist = await this.client.indices.exists({ index: this.INDEX_NAME })
    if (exist.body !== true) {
      Log.info(`[ESClient.createIndex] Index ${this.INDEX_NAME} doesn't exist. Create!!!`)
      await this.client.indices.create({
        index: this.INDEX_NAME,
        body: {
          mappings: {
            properties: { ...this.mapping, timestamp: { type: "date" } }
          }
        }
      });
    }
  }

  protected async put(data: T) {
    try {
      const bodyData: RequestParams.Index = {
        index: this.INDEX_NAME,
        body: {
          ...data,
          timestamp: new Date()
        }
      };

      await this.client.index(bodyData);
    } catch (error) {
      Log.error(`[ESClient.put] ${error}`);
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
      Log.debug(`[ESClient.search] search body : ${JSON.stringify(bodyData)}`)
      const { body } = await this.client.search(bodyData);

      const retArr = new Array<T>()
      const arr: any[] = body.hits.hits;

      Log.debug(`[ESClient.search] search return : ${JSON.stringify(body)}`)

      arr.forEach(item => { retArr.push(item._source as T) })

      return Promise.resolve(retArr)
    } catch (error) {
      Log.error(`[ESClient.search] ${error.message}`);
      return Promise.reject()
    }
  }

  protected async searchId(data: T, sort?: string): Promise<Array<string>> {
    try {
      const bodyData: RequestParams.Search = {
        index: this.INDEX_NAME,
        body: {
          query: {
            match: data
          }
        },
        sort: sort
      };
      //Log.debug(`[ESClient.searchId] ${JSON.stringify(bodyData)}`)

      const { body } = await this.client.search(bodyData);

      const retArr = new Array<string>()
      const arr: any[] = body.hits.hits;

      arr.forEach(item => { retArr.push(item._id) })

      return Promise.resolve(retArr)
    } catch (error) {
      Log.error(`[ESClient.searchId] ${error.message}`);
      return Promise.reject()
    }
  }

  public async update(id: string, data: T) {
    try {
      const bodyData: RequestParams.Index = {
        index: this.INDEX_NAME,
        id: id,
        body: {
          ...data,
          timestamp: new Date()
        }
      }
      await this.client.index(bodyData);
    } catch (error) {
      Log.error(`ESClient update=${error.message}`);
    }
  }

  protected async delete(id: string) {
    try {
      const bodyData: RequestParams.Delete = { index: this.INDEX_NAME, id: id }
      await this.client.delete(bodyData)
    } catch (error) {
      Log.error(`[ESClient.delete] ${error.message}`);
    }
  }
}
