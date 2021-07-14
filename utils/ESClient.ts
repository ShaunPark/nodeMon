import { Client, RequestParams } from '@elastic/elasticsearch';
export abstract class ESClient<T> {
  private client:Client;

  protected readonly INDEX_NAME: string;

  constructor(indexName: string, hostString: string) {
    this.INDEX_NAME = indexName;
    this.client = new Client({ node: hostString})
  }

  protected async requestElasticSearch(bodyData: RequestParams.Index) {
    await this.client.index(bodyData);
  }

  public async createIndex() {
      if( !this.client.indices.exists({index: this.INDEX_NAME}) ) {
        await this.client.indices.create({index: this.INDEX_NAME});
      }
  }

  public abstract putLog(log: T): Promise<void>|undefined;

  protected async search(bodyData: RequestParams.Search):Promise<Record<string, any>>{
      return await this.client.search(bodyData)
  }
}
