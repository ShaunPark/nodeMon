import * as http from 'http';
import * as k8s from '@kubernetes/client-node';
import { V1NodeList } from '@kubernetes/client-node';
import jsonpath from 'jsonpath';
import Logger from "../logger/Channel";
import Log from '../logger/Logger';
import K8SInformer from './K8SClient';
import jexl from 'jexl'
import * as utils from "../util/Util"
import ConfigManager from '../config/ConfigManager';

export default class K8SNodeInformer extends K8SInformer {
    private informer: k8s.Informer<k8s.V1Node>

    constructor(private configManager: ConfigManager, kubeConfig?: string) {
        super(kubeConfig)
        const listFn = (): Promise<{
            response: http.IncomingMessage;
            body: V1NodeList;
        }> => this.k8sApi.listNode(undefined, true)

        this.informer = k8s.makeInformer(
            this.kubeConfig,
            '/api/v1/nodes',
            listFn
        );

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
            const config = this.configManager.config
            const labelSelector = config.kubernetes.nodeSelector
            const builtExpr = utils.buildExpr(labelSelector, config.kubernetes.nodeSelectorExpr)

            if (this.checkValid(builtExpr, node.metadata?.labels) && node.metadata !== undefined && node.status !== undefined) {
                const { name } = node.metadata;

                console.log(name)
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
        let retValue = false
        if (expr) {
            try {
                const ret = jexl.evalSync(expr, context)
                if (typeof ret == "boolean") {
                    retValue = ret
                }
            } catch (err) {
                console.log(err)
            }
            retValue = false
        } else {
            retValue = true
        }
        console.log(retValue)
        return retValue
    }
}
