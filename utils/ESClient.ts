import { Client, RequestParams } from '@elastic/elasticsearch';
import { resolve } from 'path/posix';

const client = new Client({
  node: "http://localhost:9200"
});

export abstract class ESClient<T> {
  protected readonly INDEX_NAME: string;

  constructor(indexName: string) {
    this.INDEX_NAME = indexName;
  }

  protected async requestElasticSearch(bodyData: RequestParams.Index) {
    await client.index(bodyData);
  }

  public async createIndex() {
      if( !client.indices.exists({index: this.INDEX_NAME}) ) {
        await client.indices.create({index: this.INDEX_NAME});
      }
  }

  public abstract putLog(log: T): Promise<void>|undefined;

  protected async search(bodyData: RequestParams.Search):Promise<Record<string, any>>{
      return await client.search(bodyData)
  }
}
