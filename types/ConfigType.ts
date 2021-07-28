import { integer } from "@elastic/elasticsearch/api/types";

export default interface IConfig {
    dryRun: boolean
    //interval?: number;
    rebootDelay: number;
    rebootThroughSSH?: boolean;
    configReloadInterval?: integer;
    kubernetes: Ik8s;
    nodeManager: INodeMgr;
    elasticSearch: IElasticSearch;
    maintenance?: IMaintenance
}

interface IMaintenance {
    maxLivenessDays: 14
    runMaintenance: boolean
    testMode: boolean
    rebootStartHour: string // 2 - 2AM, 
    rebootEndHour: string   // 4 - 4AM
    // duration: number // 10 - 10 days
    ratio: number // 30 percent
    cordonStartHour: string
    cordonEndHour: string
    rebootBuffer?: number
}
export interface IElasticSearch {
    host: string
    port: number
    logIndex: string
    statusIndex: string
    id?: string
    apiKey?: string
    useApiKey: boolean
}
interface Ik8s {
    nodeSelector?: string
    conditions?: Array<string>
    workerPodFieldSelector?: string
    workerPodLabelSelector?: string
}

interface INodeMgr {
    interval: number;
    awsRegion?: string
    awsVPC?: string;
    sshPemFile: string;
    sshUser: string;
}
