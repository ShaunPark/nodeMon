export interface IConfig {
    //interval?: number;
    kubernetes?: Ik8s;
    nodeManager?: INodeMgr;
    rebootThroughSSH?: boolean;
    elasticSearch?: IElasticSearch;
}

export interface IElasticSearch {
    host: string
    port: number
    logIndex: string
    statusIndex: string

}
export interface Ik8s {
    nodeSelector?: string
    conditions?: Array<string>
}

interface INodeMgr {
    interval: number;
    awsRegion?: string
    awsVPC?: string;
    sshPemFile?: string;
}
