export interface IArguments {
    configFile: string;
}

export interface IConfig {
    loopInterval: number;
    kubernetes: Ik8s;
}

export interface Ik8s {
    interval: number;
    label?: string;
    labelExpr?: string;
}

export interface IEvent {
    type: string;
    message: string;
}