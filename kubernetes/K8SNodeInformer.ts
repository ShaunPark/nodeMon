import * as k8s from '@kubernetes/client-node';
import jsonpath from 'jsonpath';
import Logger from "../logger/Channel";
import Log from '../logger/Logger';
import { NodeInfo } from '../managers/NodeManager';
import { NodeCondition } from '../types/Type';
import IConfig from "../types/ConfigType"
import K8SInformer from './K8SClient';

interface LocalLabel {
    key: string,
    value: any
}

type Label = {
    [key: string]: string
}
export default class K8SNodeInformer extends K8SInformer {
    private _config: IConfig;
    private informer:k8s.Informer<k8s.V1Node>

    constructor(config: IConfig) {
        super()
        this._config = config
        const labelSelector = config.kubernetes.nodeSelector;

        const listFn = () => this.k8sApi.listNode(
            undefined,
            true,
            undefined,
            undefined,
            labelSelector,
        );

        this.informer = k8s.makeInformer(
            this.kubeConfig,
            '/api/v1/nodes',
            listFn,
            labelSelector
        );

        this.labelSelectors = this.stringsToArray(labelSelector)

        this.informer.on('add', this.sendNodeCondition);
        this.informer.on('update', this.sendNodeCondition);
        this.informer.on('delete', (node) => {
            const nodeName = node.metadata?.name
            Log.info(`[K8SNodeInformer] Node ${nodeName}deleted from cluster`)
            Logger.sendEventToNodeManager({ kind: "DeleteNode", nodeName: nodeName })
        });
        this.informer.on('error', (err: k8s.V1Node) => {
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                this.informer.start()
            }, 5000);
        });
    }

    private stringsToArray = (str?: string): Array<LocalLabel> | undefined => {
        if (str == undefined) {
            return undefined
        }
        const array = new Array<LocalLabel>()
        const strs = str.trim().split(",")
        strs.forEach(s => {
            const values = s.trim().split("=")
            array.push({ key: values[0], value: values.slice(1).join("=") })
        })
        return array
    }

    private labelSelectors?: Array<LocalLabel>;

    stopInformer = () => {
        this.informer.stop()
    }
    
    startInformer = () => {
        this.informer.start()
    }

    private labelMap = new Map<string, { lastUpdateTime: Date, needSend: string }>()

    private sendNodeCondition = (node: k8s.V1Node) => {
        const needSend = this.checkValid(node.metadata?.labels)
        if (needSend && node.metadata && node.status) {
            const { name } = node.metadata;
            const { conditions } = node.status;
            const unschedulable = node.spec?.unschedulable ? true : false;
            const retArr: string[] = jsonpath.query(node, '$.status.addresses[?(@.type=="InternalIP")].address')

            if (retArr.length < 1) {
                Log.error(`[K8SNodeInformer.sendNodeCondition] Cannot get internal ip-address of node ${name}. skip ${name}`)
            } else {
                if (name && conditions) {
                    const nodeInfo: NodeInfo = { nodeName: name, nodeUnscheduleable: unschedulable, nodeIp: retArr[0] }
                    const status = conditions.find(condition => condition.type == "Ready")
                    const statusString = status?.status == "True" ? "Ready" : "NotReady"
                    // Node condition를 node manager로 전달
                    this.sendNodeConditionsToManager(nodeInfo, conditions, statusString)
                }
            }
        }

        const nodeName = node.metadata?.name
        const needSendStr = (needSend) ? "TRUE" : "FALSE"
        if (nodeName) {
            const temp = this.labelMap.get(nodeName)
            if (temp) {
                if (!needSend && temp.needSend != needSendStr) {
                    Logger.sendEventToNodeManager({ kind: "DeleteNode", nodeName: nodeName })
                }
            }
            this.labelMap.set(nodeName, { lastUpdateTime: new Date(), needSend: needSendStr })
        }
    }

    private sendNodeConditionsToManager(node: NodeInfo, nodeConditions: Array<k8s.V1NodeCondition>, status: string) {
        // 모니터링 대상 condition만 처리 그 외는 무시
        const targetConditions = this._config?.kubernetes.conditions;

        const newArr: Array<NodeCondition> = []
        //targetCondition이 정의 되어 있으면 해당 condition만 전송, 아니면 모두 전송
        if (targetConditions && targetConditions.length > 0) {
            targetConditions.push("Ready")
            nodeConditions
                .filter(condition => targetConditions.includes(condition.type))
                .map(condition => newArr.push(condition as NodeCondition))
        } else {
            nodeConditions.map(condition => newArr.push(condition as NodeCondition))
        }

        // logger.info(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.sendEventToNodeManager({ kind: "NodeCondition", status: status, conditions: newArr, ...node })
    }

    private checkValid(labels?: { [key: string]: string; }): boolean {
        const labelMap = this.labelSelectors
        if (labelMap && labels) {
            let hasAllLabel: boolean = true;
            labelMap.forEach(lbl => {
                const v = labels[lbl.key]
                if (!v) {
                    hasAllLabel = false;
                } else if (lbl.value != "" && v != lbl.value) {
                    hasAllLabel = false;
                }
            })
            return hasAllLabel
        }

        return (labelMap == undefined)
    }
}
