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
    startHour: string // 2 - 2AM, 
    endHour: string   // 4 - 4AM
    // duration: number // 10 - 10 days
    ratio: number // 30 percent
    cordonStartHour: string
    cordonEndHour: string
}
interface IElasticSearch {
    host: string
    port: number
    logIndex: string
    statusIndex: string
}
interface Ik8s {
    nodeSelector?: string
    conditions?: Array<string>
    podFieldSelector?: string
    podLabelSelector?: string
}

interface INodeMgr {
    interval: number;
    awsRegion?: string
    awsVPC?: string;
    sshPemFile: string;
    sshUser: string;
}
