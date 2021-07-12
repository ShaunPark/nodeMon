import * as k8s from '@kubernetes/client-node';
import { CoreV1Event, RequestInterface, RequestResult } from '@kubernetes/client-node';
import { IConfig } from '../types/Type';
import Logger from "../logger/Logger";
import request = require('request');
interface LocalLabel {
    key: string,
    value: any
}

let k8sApi:k8s.CoreV1Api;

export class RequestWithFieldSelector implements RequestInterface {
    // requestImpl can be overriden in case we need to test mocked DefaultRequest
    private requestImpl: (opts: request.OptionsWithUri) => request.Request;

    constructor(requestImpl?: (opts: request.OptionsWithUri) => request.Request) {
        this.requestImpl = requestImpl ? requestImpl : request;
    }

    // Using request lib can be confusing when combining Stream- with Callback-
    // style API. We avoid the callback and handle HTTP response errors, that
    // would otherwise require a different error handling, in a transparent way
    // to the user (see github issue request/request#647 for more info).
    public webRequest(opts: request.OptionsWithUri): RequestResult {
        const req = this.requestImpl(this.addFieldSelectorToOpt(opts));
        // pause the stream until we get a response not to miss any bytes
        req.pause();
        req.on('response', (resp) => {
            if (resp.statusCode === 200) {
                req.resume();
            } else {
                req.emit('error', new Error(resp.statusMessage));
            }
        });
        return req;
    }

    fieldSelector?:string;

    private addFieldSelectorToOpt(opts: request.OptionsWithUri):request.OptionsWithUri {
        if ( this.fieldSelector !== undefined) {
            console.log(JSON.stringify(opts))
            return opts
        }
        return opts
    }
}

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
            'involvedObject.kind=Node',
            'involvedObject.kind=Node'
        );

        const requestImpl = new RequestWithFieldSelector();
        requestImpl.fieldSelector = 'involvedObject.kind=Node'
        const watch = new k8s.Watch(this._kc, requestImpl);
        const informer = new k8s.ListWatch<CoreV1Event>('/api/v1/events', watch, listFn, false,'involvedObject.kind=Node');        

        // const informer = k8s.makeInformer(
        //     this._kc,
        //     '/api/v1/events',
        //     listFn.bind(this),
        // );

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
