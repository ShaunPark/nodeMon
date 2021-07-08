import * as k8s from '@kubernetes/client-node';
import { CoreV1Event, V1NodeCondition } from '@kubernetes/client-node';
import { NodeInfo } from '../managers/NodeCache';
import { IConfig, NodeCondition } from '../types/Type';
import Logger from "../logger/Logger";

interface LocalLabel {
    key: string,
    value: any
}

let k8sApi:k8s.CoreV1Api;

export class K8SEventInformer {
    // private _k8sApi: k8s.CoreV1Api;
    private _config?: IConfig;
    private _kc: k8s.KubeConfig;
    constructor() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
    }

    private reInit() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
    }


    public stringsToArray = (str?: string): Array<LocalLabel> | undefined => {
        if (str == undefined) {
            return undefined
        }
        const array = new Array<LocalLabel>()
        const strs = str.trim().split(",")
        strs.forEach(s => {
            const values = s.trim().split("=")
            array.push({key:values[0] , value:values.slice(1).join("=")})
        })
        return array
    }

    createAndStartInformer = (config: IConfig) => {
        const labelSelector = config?.kubernetes?.nodeSelector;
        const listFn = () => k8sApi.listEventForAllNamespaces(
            true,
            undefined,
            'involvedObject.kind=Node'
        );

        const informer = k8s.makeInformer(
            this._kc,
            '/api/v1/events',
            listFn.bind(this)
        );

        const labelMap = this.stringsToArray(labelSelector)

        console.log(JSON.stringify(labelMap))

        informer.on('add', (evt: k8s.CoreV1Event) => {
            console.log('Event added !!!', JSON.stringify(evt.involvedObject.kind))
            if( this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
             }
        });
        informer.on('update', (evt: k8s.CoreV1Event) => {
            console.log('Event updated !!!', JSON.stringify(evt.involvedObject.kind))

            if( this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
            }
        });
        informer.on('delete', (evt: k8s.CoreV1Event) => {
            console.log('Event deleted !!!')

            if( this.checkValid(evt)) {
                console.log(`Deleted:  ${evt.involvedObject.name} ${evt.reason} ${evt.type}`);
            }
        });
        informer.on('error', (err: k8s.CoreV1Event) => {
            console.error(err);
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                informer.start()
            }, 5000);
        });
        informer.start()
    }

    private createSendingEvent(obj:CoreV1Event):Object {
        return {   
            kind:"NodeEvent",
            nodeName: obj.involvedObject.name, 
            reason: obj.reason, 
            source: obj.source?.component,
            lastTimestamp: obj.lastTimestamp 
        }
    }

    private targetEvents:Array<string> = [ 
        "CordonStarting", 
        "CordonSucceeded",  
        "CordonFailed", 
        "UncordonStarting",
        "UncordonSucceeded",
        "UncordonFailed",

        "DrainScheduled",
        "DrainSchedulingFailed",
        "DrainStarting",
        "DrainSucceeded",
        "DrainFailed",

        "NodeNotReady",
        "Starting",
        "Rebooted",
        "NodeAllocatableEnforced",
        "NodeReady",
        "NodeNotSchedulable"
    ]

    public checkValid(event:CoreV1Event):boolean {
        console.log(`checkValid  ${event.involvedObject.kind}  ${event.reason} `)
        if( event.reason )
            return event.involvedObject.kind == "Node" && this.targetEvents.includes(event.reason)
        return false
    }

    // {
    //     "metadata": {
    //         "namespace": "default",
    //         "managedFields": [
    //             {
    //                 "manager": "draino",
    //             }
    //         ]
    //     },
    //     "involvedObject": {
    //         "kind": "Node",
    //         "name": "ip-10-0-0-11",
    //     },
    //     "reason": "DrainSchedulingFailed",
    //     "source": {
    //         "component": "draino"
    //     },
    //     "firstTimestamp": "2021-07-07T08:00:11Z",
    //     "lastTimestamp": "2021-07-07T08:00:11Z",
    // },

    // sendNodeCondition = (name:string, unschedulable:boolean, nodeIp:string, conditions:Array<V1NodeCondition) => {
    //     const nodeInfo:NodeInfo = { nodeName: name, nodeUnscheduleable:unschedulable, nodeIp}

    //                             // Node condition를 node manager로 전달
    //     this.sendNodeConditionsToManager(nodeInfo, conditions)
    // }

    // private sendNodeConditionsToManager(node:NodeInfo, nodeConditions:Array<k8s.V1NodeCondition>) {
    //     // 모니터링 대상 condition만 처리 그 외는 무시
    //     const targetConditions = this._config?.kubernetes?.conditions;

    //     const newArr:Array<NodeCondition> = []
    //     //targetCondition이 정의 되어 있으면 해당 condition만 전송, 아니면 모두 전송
    //     if( targetConditions && targetConditions.length > 0 )  {
    //         nodeConditions
    //         .filter(condition => targetConditions.includes(condition.type))
    //         .map( condition => newArr.push( condition as NodeCondition))
    //     } else {
    //         nodeConditions.map( condition => newArr.push( condition as NodeCondition))
    //     }

    //     // logger.info(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
    //     Logger.sendEventToNodeManager({kind:"NodeCondition", conditions: newArr, ...node})
    // }
}
