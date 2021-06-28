export interface IArguments {
    configFile: string;
}

export interface IConfig {
    interval?: number;
    kubernetes?: Ik8s;
}

export interface Ik8s {
    interval: number;
    label?: string;
    labelExpr?: string;
    nodeSelector?: string;
    conditions?: Array<string>
    events?: Array<string>
}

export interface IEvent {
    type: string;
    message: string;
}

export interface NodeEvent  {
    action?: string;
    count?: number;
    /**
    * Time when this Event was first observed.
    */
    eventTime?: Date;
    /**
    * The time at which the event was first recorded. (Time of server receipt is in TypeMeta.)
    */
    firstTimestamp?: Date;
    involvedObject: InvolvedObject;
    /**
    * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
    */
    kind?: string;
    /**
    * The time at which the most recent occurrence of this event was recorded.
    */
    lastTimestamp?: Date;
    /**
    * A human-readable description of the status of this operation.
    */
    message?: string;
    // metadata: V1ObjectMeta;
    /**
    * This should be a short, machine understandable string that gives the reason for the transition into the object\'s current status.
    */
    reason?: string;
    // related?: V1ObjectReference;
    /**
    * Name of the controller that emitted this Event, e.g. `kubernetes.io/kubelet`.
    */
    // reportingComponent?: string;
    /**
    * ID of the controller instance, e.g. `kubelet-xyzf`.
    */
    // reportingInstance?: string;
    // series?: CoreV1EventSeries;
    // source?: V1EventSource;
    /**
    * Type of this event (Normal, Warning), new types could be added in the future
    */
    type?: string;
}

export interface InvolvedObject {
    kind: string,
    name: string,
    uid: string
}

export interface NodeCondition {
    lastHeartbeatTime?: Date;
    lastTransitionTime?: Date;
    message?: string;
    reason?: string;
    status: string;
    type: string;
}

