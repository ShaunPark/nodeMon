export default interface IConfig {
    //interval?: number;
    rebootDelay: number;
    rebootThroughSSH?: boolean;

    kubernetes?: Ik8s;
    nodeManager?: INodeMgr;
    elasticSearch?: IElasticSearch;
    maintenance?: IMaintenance
}

interface IMaintenance {
    maintenanceDay: number // 0 - Sunday, 1 - Monday ....
    startHour: number // 2 - 2AM, 
    endHour: number   // 4 - 4AM
    duration: number // 10 - 10 days
    ratio: number // 30 percent
    cordonStartHour:number
    cordonEndHour:number
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
}

interface INodeMgr {
    interval: number;
    awsRegion?: string
    awsVPC?: string;
    sshPemFile?: string;
}
