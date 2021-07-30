import * as k8s from '@kubernetes/client-node';
import { CoreV1Event, DefaultRequest, RequestInterface, RequestResult } from '@kubernetes/client-node';
import IConfig from "../types/ConfigType"
import Logger from "../logger/Channel";
import request = require('request');
import Log from '../logger/Logger'
import K8SInformer from './K8SClient';
import { NodeEvent } from '../types/Type';

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

export default class K8SEventInformer extends K8SInformer {
    // private _k8sApi: k8s.CoreV1Api;
    // private _config?: IConfig;
    private informer: k8s.ListWatch<CoreV1Event>
    constructor(config: IConfig) {
        super()
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

        this.informer.on('add', (evt: k8s.CoreV1Event) => {
            const nodeEvent = this.createSendingEvent(evt)
            if (nodeEvent) {
                Logger.sendEventToNodeManager(nodeEvent)
            }
        });
        this.informer.on('update', (evt: k8s.CoreV1Event) => {
            const nodeEvent = this.createSendingEvent(evt)
            if (nodeEvent) {
                Logger.sendEventToNodeManager(nodeEvent)
            }
        });
        this.informer.on('delete', (evt: k8s.CoreV1Event) => {
        });
        this.informer.on('error', (err: k8s.CoreV1Event) => {
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                this.informer.start()
            }, 5000);
        });

    }

    stopInformer() {
        this.informer?.stop()
    }

    startInformer = () => {
        this.informer.start()
    }

    private createSendingEvent(obj: CoreV1Event): NodeEvent | undefined {
        if (this.checkValid(obj)) {
            if (obj.involvedObject.name && obj.reason && obj.lastTimestamp) {
                let lt = 0
                try {
                    lt = obj.lastTimestamp.getTime()
                } catch(err) {
                    
                }
                return {
                    kind: "NodeEvent",
                    nodeName: obj.involvedObject.name,
                    reason: obj.reason,
                    lastTimestamp: lt
                }
            }
        }
        return undefined
    }

    // event - source component pairs
    private concernedEvents = new Map<string, string[]>([
        ["CordonStarting", ["draino", "kubelet"]],
        ["CordonSucceeded", ["draino", "kubelet"]],
        ["CordonFailed", ["draino", "kubelet"]],
        ["UncordonStarting", ["draino", "kubelet"]],
        ["UncordonSucceeded", ["draino", "kubelet"]],
        ["UncordonFailed", ["draino", "kubelet"]],

        ["DrainScheduled", ["draino", "kubelet"]],
        ["DrainSchedulingFailed", ["draino", "kubelet"]],
        ["DrainStarting", ["draino", "kubelet"]],
        ["DrainSucceeded", ["draino", "kubelet"]],
        ["DrainFailed", ["draino", "kubelet"]],

        ["NodeNotReady", ["node-controller"]],
        //["Starting",""],
        ["Rebooted", ["kubelet"]],
        // "NodeAllocatableEnforced",
        ["NodeReady", ["kubelet"]],
        // "NodeNotSchedulable"
    ])

    private checkValid(event: CoreV1Event): boolean {
        Log.debug(`[K8SEventInformer.checkValid] Event on Node: ${event.involvedObject.name}-${event.reason}-${event.source?.component}`)

        if (event.reason) {
            const ce = this.concernedEvents.get(event.reason)
            if (ce !== undefined && event.source && event.source.component) {
                const isValid = ce.includes(event.source.component)

                return isValid
            }
        }
        return false
    }
}
