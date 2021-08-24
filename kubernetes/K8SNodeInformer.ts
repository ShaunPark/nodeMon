import { LoadBalancersConfig } from '@aws-sdk/client-ec2';
import * as k8s from '@kubernetes/client-node';
import jsonpath from 'jsonpath';
import Logger from "../logger/Channel";
import Log from '../logger/Logger';
import IConfig from "../types/ConfigType"
import K8SInformer from './K8SClient';

interface LocalLabel {
    key: string,
    value: string
}

type Label = {
    [key: string]: string
}
export default class K8SNodeInformer extends K8SInformer {
    private _config: IConfig;
    private informer: k8s.Informer<k8s.V1Node>

    constructor(config: IConfig, kubeConfig?: string) {
        super(kubeConfig)
        this._config = config
        const labelSelector = config.kubernetes.nodeSelector;

        this.labelSelectors = this.stringsToArray(labelSelector)

        const ls = (this.labelSelectors.length < 2) ? labelSelector : ""

        const listFn = () => this.k8sApi.listNode(
            undefined,
            true,
            undefined,
            undefined,
            ls,
        );

        this.informer = k8s.makeInformer(
            this.kubeConfig,
            '/api/v1/nodes',
            listFn,
            ls
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

    private stringsToArray = (str?: string): Array<LocalLabel> => {
        if (str == undefined) {
            return new Array<LocalLabel>()
        }
        const array = new Array<LocalLabel>()
        const strs = str.trim().split(",")
        strs.forEach(s => {
            const values = s.trim().split("=")
            array.push({ key: values[0], value: values.slice(1).join("=") })
        })
        return array
    }

    private labelSelectors: Array<LocalLabel>;

    stopInformer = () => {
        this.informer.stop()
    }

    startInformer = () => {
        this.informer.start()
    }

    private labelMap = new Map<string, { lastUpdateTime: Date, needSend: string }>()

    private sendNodeCondition = (node: k8s.V1Node) => {
        try {
            const needSend = this.checkValid(node.metadata?.labels)
            if (needSend && node.metadata !== undefined && node.status !== undefined) {
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

            // const nodeName = node.metadata?.name
            // const needSendStr =  "TRUE" 
            // if (nodeName) {
            //     const temp = this.labelMap.get(nodeName)
            //     if (temp) {
            //         if (!needSend && temp.needSend != needSendStr) {
            //             Logger.sendEventToNodeManager({ kind: "DeleteNode", nodeName: nodeName })
            //         }
            //     }
            //     this.labelMap.set(nodeName, { lastUpdateTime: new Date(), needSend: needSendStr })
            // }
        } catch (err) {
            Log.error(err)
        }
    }

    private checkValid(labels?: { [key: string]: string; }): boolean {
        // Log.debug(`[K8SEventInformer.checkValid] Event on Node: ${event.involvedObject.name}-${event.reason}-${event.source?.component}`)
        const labelMap = this.labelSelectors
        if (labelMap.length < 2) {
            return true
        }
        console.table(labelMap)
        console.table(labels)
        if (labelMap !== undefined && labels !== undefined) {
            let isValid: boolean = false;
            labelMap.forEach(lbl => {
                const v = labels[lbl.key]
                if (lbl.value == "" || v == lbl.value) {
                    isValid = true;
                }
            })
            console.log("find !!!")
            return isValid
        }

        return (labelMap == undefined)
    }
}
