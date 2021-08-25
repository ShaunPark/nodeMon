import * as http from 'http';
import * as k8s from '@kubernetes/client-node';
import { V1NodeList } from '@kubernetes/client-node';
import jsonpath from 'jsonpath';
import Logger from "../logger/Channel";
import Log from '../logger/Logger';
import IConfig from "../types/ConfigType"
import K8SInformer from './K8SClient';
import jexl from 'jexl'
import * as utils from "../util/Util"

interface LocalLabel {
    key: string,
    value: string
}

export default class K8SNodeInformer extends K8SInformer {
    private informer: k8s.Informer<k8s.V1Node>

    constructor(config: IConfig, kubeConfig?: string) {
        super(kubeConfig)
        const labelSelector = config.kubernetes.nodeSelector
        const builtExpr = utils.buildExpr(labelSelector, config.kubernetes.nodeSelectorExpr)

        let listFn: () => Promise<{
            response: http.IncomingMessage;
            body: V1NodeList;
        }>

        if (builtExpr) {
            this.informer = k8s.makeInformer(
                this.kubeConfig,
                '/api/v1/nodes',
                async (): Promise<{
                    response: http.IncomingMessage;
                    body: V1NodeList;
                }> => {
                    const ret = await this.k8sApi.listNode(
                        undefined,
                        true,
                        undefined,
                        undefined,
                        undefined)
                    const items = ret.body.items
                    ret.body.items = items.filter(item => {
                        return this.checkValid(builtExpr, item.metadata?.labels)
                    })
                    return Promise.resolve({ response: ret.response, body: ret.body })
                },
                undefined
            );
        } else {
            this.informer = k8s.makeInformer(
                this.kubeConfig,
                '/api/v1/nodes',
                (): Promise<{
                    response: http.IncomingMessage;
                    body: V1NodeList;
                }> => this.k8sApi.listNode(
                    undefined,
                    true,
                    undefined,
                    undefined,
                    labelSelector),
                labelSelector
            );
        }

        this.informer.on('add', this.sendNodeCondition);
        this.informer.on('update', this.sendNodeCondition);
        this.informer.on('delete', (node) => {
            if (node.metadata && node.metadata.name) {
                const nodeName = node.metadata.name
                Log.info(`[K8SNodeInformer] Node ${nodeName}deleted from cluster`)
                Logger.sendEventToNodeManager({ kind: "DeleteNode", nodeName: nodeName })
            }
        });
        this.informer.on('error', (err: k8s.V1Node) => {
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                this.informer.start()
            }, 5000);
        });
    }

    stopInformer = () => {
        this.informer.stop()
    }

    startInformer = () => {
        this.informer.start()
    }

    private sendNodeCondition = (node: k8s.V1Node) => {
        try {
            if (node.metadata !== undefined && node.status !== undefined) {
                const { name } = node.metadata;
                const { conditions } = node.status;
                const unschedulable = node.spec?.unschedulable ? true : false;
                const validConditions = ["Ready", "RebootRequested", "RebootScheduled"]
                const retArr: string[] = jsonpath.query(node, '$.status.addresses[?(@.type=="InternalIP")].address')
                if (retArr.length == 0) {
                    Log.error(`[K8SNodeInformer.sendNodeCondition] Cannot get internal ip-address of node ${name}. skip ${name}`)
                } else {
                    if (name && conditions) {
                        const sendCondition = conditions
                            .filter(condition => validConditions.includes(condition.type))
                            .map(
                                c => {
                                    let ltt = 0
                                    if (c.lastTransitionTime) {
                                        try {
                                            ltt = c.lastTransitionTime.getTime()
                                        } catch (err) {
                                            const dt = new Date(c.lastTransitionTime)
                                            ltt = dt.getTime()
                                        }
                                    }
                                    return { lastTransitionTime: ltt, reason: c.reason, status: c.status, type: c.type }
                                })

                        const status = sendCondition.find(condition => condition.type == "Ready" && condition.reason == "KubeletReady")
                        const statusString = status?.status == "True" ? "Ready" : "NotReady"

                        let rebootTime = 0
                        if (status) {
                            rebootTime = status.lastTransitionTime
                        }
                        // Node condition를 node manager로 전달
                        Logger.sendEventToNodeManager({
                            kind: "NodeCondition",
                            status: statusString,
                            conditions: sendCondition,
                            nodeName: name, nodeUnscheduleable: unschedulable, nodeIp: retArr[0],
                            rebootTime: rebootTime
                        })
                    }
                }
            }
        } catch (err) {
            Log.error(err)
        }
    }

    private checkValid(expr?: string, labels?: { [key: string]: string; }): boolean {
        const context = { metadata: { labels: labels } }
        if (expr) {
            try {
                const ret = jexl.evalSync(expr, context)
                if (typeof ret == "boolean") {
                    return ret
                }
            } catch (err) {
                console.log(err)
            }
            return false
        } else {
            return true
        }
    }
}
