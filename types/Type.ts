export default interface IArguments {
    configFile: string;
    dryRun?: boolean;
    kubeConfig?: string;
}

interface IEvent {
    type: string;
    message: string;
}

export interface NodeEvent extends BaseEvent {
    // action?: string;
    // count?: number;
    // eventTime?: Date;
    // firstTimestamp?: Date;
    // involvedObject: InvolvedObject;
    lastTimestamp: number;
    // message?: string;
    reason: string;
    // type: string;
}

//  interface InvolvedObject {
//     kind?: string,
//     name?: string,
//     uid?: string
// }
export interface NodeCondition {
    lastTransitionTime: number;
    reason?: string;
    status: string;
    type: string;
}

export interface BaseEvent {
    kind: string
    nodeName: string
}

export interface NodeInfo extends BaseEvent {
    nodeIp: string
    nodeUnscheduleable: boolean
    status: string,
    conditions: Array<NodeCondition>
    rebootTime: number
}

export interface NodeConditionCache {
    readonly ipAddress: string
    // readonly conditions: Map<string, NodeCondition>
    readonly lastUpdateTime: number
    readonly status: string
    readonly timer?: NodeJS.Timeout
    readonly lastRebootedTime: number
    readonly nodeName: string
    readonly UUID: string
    readonly hasScheduled: boolean
    readonly hasReboodRequest: boolean
    readonly scheduledTime: number
    readonly rebootRequestedTime: number
}