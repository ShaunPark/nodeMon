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
            // console.log('Event added !!!', JSON.stringify(evt.involvedObject.kind))
            if( this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
             }
        });
        informer.on('update', (evt: k8s.CoreV1Event) => {
            // console.log('Event updated !!!', JSON.stringify(evt.involvedObject.kind))

            if( this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
            }
        });
        informer.on('delete', (evt: k8s.CoreV1Event) => {
            // console.log('Event deleted !!!')

            // if( this.checkValid(evt)) {
            //     console.log(`Deleted:  ${evt.involvedObject.name} ${evt.reason} ${evt.type}`);
            // }
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

    private concernedEvents:Array<string> = [ 
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
            return event.involvedObject.kind == "Node" && this.concernedEvents.includes(event.reason)
        return false
    }
}
