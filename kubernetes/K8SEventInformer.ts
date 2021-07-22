import * as k8s from '@kubernetes/client-node';
import { CoreV1Event, DefaultRequest, RequestInterface, RequestResult } from '@kubernetes/client-node';
import IConfig from "../types/ConfigType"
import Logger from "../logger/Channel";
import request = require('request');
import Log from '../logger/Logger'
import K8SInformer from './K8SClient';

interface LocalLabel {
    key: string,
    value: any
}


// Kubernetes client library 0.15.0 까지는 Informer생성 시 fieldSelector사용 불가
// fieldSelector을 위해 Request를 새롭게 구현하고 webRequest 직전에 fieldSelector를 queryparam에 추가하도록 함
class RequestWithFieldSelector extends DefaultRequest {
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

export default class K8SEventInformer extends K8SInformer{
    // private _k8sApi: k8s.CoreV1Api;
    // private _config?: IConfig;
    private informer: k8s.ListWatch<CoreV1Event> 
    constructor(config:IConfig) {
        super()
        const labelSelector = config.kubernetes.nodeSelector;
        const listFn = () => this.k8sApi.listEventForAllNamespaces(
            true,
            undefined,
            'involvedObject.kind=Node'
        );

        // 기본 makeInformer를 대신하여 커스텀 request를 사용하여 informer를 생성하도록 수정
        // fieldSelector를 통해 Node에서 발생한 event만 수신하도록 함.
        const requestImpl = new RequestWithFieldSelector(undefined, 'involvedObject.kind=Node');
        const watch = new k8s.Watch(this.kubeConfig, requestImpl);
        this.informer = new k8s.ListWatch<CoreV1Event>('/api/v1/events', watch, listFn, false);

        const labelMap = this.stringsToArray(labelSelector)

        Log.info(`[K8SEventInformer] ${JSON.stringify(labelMap)}`)

        this.informer.on('add', (evt: k8s.CoreV1Event) => {
            // logger.info('Event added !!!', JSON.stringify(evt.involvedObject.kind))
            if (this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
            }
        });
        this.informer.on('update', (evt: k8s.CoreV1Event) => {
            // logger.info('Event updated !!!', JSON.stringify(evt.involvedObject.kind))

            if (this.checkValid(evt)) {
                Logger.sendEventToNodeManager(this.createSendingEvent(evt))
            }
        });
        this.informer.on('delete', (evt: k8s.CoreV1Event) => {
            // logger.info('Event deleted !!!')

            // if( this.checkValid(evt)) {
            //     logger.info(`Deleted:  ${evt.involvedObject.name} ${evt.reason} ${evt.type}`);
            // }
        });
        this.informer.on('error', (err: k8s.CoreV1Event) => {
            console.error(err);
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                this.informer.start()
            }, 5000);
        });

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

    stopInformer() {
        this.informer?.stop()
    }

    startInformer = () => {
        this.informer.start()
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

    // event - source component pairs
    private concernedEvents = new Map<string, string[]>([
        ["CordonStarting", ["draino", "kubelet"]],
        ["CordonSucceeded",["draino", "kubelet"]],
        ["CordonFailed", ["draino", "kubelet"]],
        ["UncordonStarting", ["draino", "kubelet"]],
        ["UncordonSucceeded", ["draino", "kubelet"]],
        ["UncordonFailed", ["draino", "kubelet"]],

        ["DrainScheduled", ["draino", "kubelet"]],
        ["DrainSchedulingFailed", ["draino", "kubelet"]],
        ["DrainStarting", ["draino", "kubelet"]],
        ["DrainSucceeded", ["draino", "kubelet"]],
        ["DrainFailed", ["draino", "kubelet"]],

        ["NodeNotReady",["node-controller"]],
        //["Starting",""],
        ["Rebooted", ["kubelet"]],
        // "NodeAllocatableEnforced",
        ["NodeReady", ["kubelet"]],
        // "NodeNotSchedulable"
    ])

    public checkValid(event: CoreV1Event): boolean {
        Log.info(`[K8SEventInformer.checkValid] Got Event of Node :   ${event.involvedObject.name}  ${event.reason}  ${event.source?.component}`)

        if (event.reason) {
            const ce = this.concernedEvents.get(event.reason)
            if( ce !== undefined && event.source && event.source.component) {
                const isValid = ce.includes(event.source.component)

                return isValid
            } 
        }
        return false
    }
}
