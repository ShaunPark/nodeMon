import * as k8s from '@kubernetes/client-node';
import { CoreV1Event, DefaultRequest, RequestInterface, RequestResult } from '@kubernetes/client-node';
import { IConfig } from '../types/Type';
import Logger from "../logger/Channel";
import request = require('request');
import { logger } from '../logger/Logger'

interface LocalLabel {
    key: string,
    value: any
}

let k8sApi: k8s.CoreV1Api;

// Kubernetes client library 0.15.0 까지는 Informer생성 시 fieldSelector사용 불가
// fieldSelector을 위해 Request를 새롭게 구현하고 webRequest 직전에 fieldSelector를 queryparam에 추가하도록 함
export class RequestWithFieldSelector extends DefaultRequest {
    constructor(requestImpl?: (opts: request.OptionsWithUri) => request.Request, private fieldSelector?: string) {
        super(requestImpl)
    }
    public webRequest(opts: request.OptionsWithUri): RequestResult {
        if (this.fieldSelector !== undefined) {
            return super.webRequest(this.addFieldSelectorToOptions(opts, this.fieldSelector))
        }
        return super.webRequest(opts)
    }

    private addFieldSelectorToOptions(opts: request.OptionsWithUri, fieldSelector: string): request.OptionsWithUri {
        opts.qs['fieldSelector'] = k8s.ObjectSerializer.serialize(fieldSelector, 'string');
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

        str.trim().split(",").forEach(s => {
            const values = s.trim().split("=")
            array.push({ key: values[0], value: values.slice(1).join("=") })
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

        // 기본 makeInformer를 대신하여 커스텀 request를 사용하여 informer를 생성하도록 수정
        // fieldSelector를 통해 Node에서 발생한 event만 수신하도록 함.
        const requestImpl = new RequestWithFieldSelector(undefined, 'involvedObject.kind=Node');
        const watch = new k8s.Watch(this._kc, requestImpl);
        const informer = new k8s.ListWatch<CoreV1Event>('/api/v1/events', watch, listFn, false);

        const labelMap = this.stringsToArray(labelSelector)

        logger.info(JSON.stringify(labelMap))

        informer.on('add', (evt: k8s.CoreV1Event) => {
            // logger.info('Event added !!!', JSON.stringify(evt.involvedObject.kind))
            if (this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
            }
        });
        informer.on('update', (evt: k8s.CoreV1Event) => {
            // logger.info('Event updated !!!', JSON.stringify(evt.involvedObject.kind))

            if (this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
            }
        });
        informer.on('delete', (evt: k8s.CoreV1Event) => {
            // logger.info('Event deleted !!!')

            // if( this.checkValid(evt)) {
            //     logger.info(`Deleted:  ${evt.involvedObject.name} ${evt.reason} ${evt.type}`);
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

    private createSendingEvent(obj: CoreV1Event): Object {
        return {
            kind: "NodeEvent",
            nodeName: obj.involvedObject.name,
            reason: obj.reason,
            source: obj.source?.component,
            lastTimestamp: obj.lastTimestamp
        }
    }

    private concernedEvents: Array<string> = [
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

    public checkValid(event: CoreV1Event): boolean {
        logger.info(`checkValid  ${event.involvedObject.kind}  ${event.reason} `)
        // Informer 에 fieldSelector를 적용하여 event의 involvedObject.kind 확인 불필요 
        if (event.reason) {
            return this.concernedEvents.includes(event.reason)
            //return event.involvedObject.kind == "Node" && this.concernedEvents.includes(event.reason)
        }
        return false
    }
}
