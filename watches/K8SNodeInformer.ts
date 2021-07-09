import * as k8s from '@kubernetes/client-node';
import { V1Node, V1NodeCondition } from '@kubernetes/client-node';
import { NodeInfo } from '../managers/NodeCache';
import { IConfig, NodeCondition } from '../types/Type';
import Logger from "../logger/Logger";
import jsonpath from 'jsonpath';

interface LocalLabel {
    key: string,
    value: any
}

type Label = {
    [key:string]: string
}
export class K8SNodeInformer {
    private _k8sApi: k8s.CoreV1Api;
    private _config?: IConfig;
    private _kc: k8s.KubeConfig;
    constructor() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
    }

    private reInit() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
    }


    public stringsToArray = (str?: string): Array<LocalLabel> | undefined => {
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

    private labelSelectors?:Array<LocalLabel>;
    createAndStartInformer = (config: IConfig) => {
        const labelSelector = config?.kubernetes?.nodeSelector;
        const listFn = () => this._k8sApi.listNode(
            undefined,
            true,
            undefined,
            undefined,
            labelSelector,
        );

        const informer = k8s.makeInformer(
            this._kc,
            '/api/v1/nodes',
            listFn
        );

        this.labelSelectors = this.stringsToArray(labelSelector)

        informer.on('add', this.sendNodeCondition);
        informer.on('update', this.sendNodeCondition);
        informer.on('delete', this.sendNodeCondition);

        informer.on('error', (err: k8s.V1Node) => {
            console.error(err);
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                informer.start()
            }, 5000);
        });
        informer.start()
    }

    private labelMap = new Map<string, {lastUpdateTime:Date, needSend:string}>()

    sendNodeCondition = (node: V1Node) => {
        // console.log(`sendNodeCondition `)
        const needSend = this.checkValid(node.metadata?.labels)
        if ( needSend && node.metadata && node.status) {
            const { name } = node.metadata;
            const { conditions } = node.status;
            const unschedulable = node.spec?.unschedulable ? true : false;
            const retArr: string[] = jsonpath.query(node, '$.status.addresses[?(@.type=="InternalIP")].address')
            console.log(`retArr ${JSON.stringify(retArr)} `)
            if (retArr.length < 1) {
                console.error(`Cannot get internal ip-address of node ${name}. skip ${name}`)
            } else {
                if (name && conditions) {
                    const nodeInfo: NodeInfo = { nodeName: name, nodeUnscheduleable: unschedulable, nodeIp: retArr[0] }
                    const status = conditions.find( condition => condition.type == "Ready")
                    const statusString = status?.status=="True"?"Ready":"NotReady"
                    // Node condition를 node manager로 전달
                    this.sendNodeConditionsToManager(nodeInfo, conditions, statusString)
                }
            }
        }

        const nodeName = node.metadata?.name
        const needSendStr = (needSend)?"TRUE":"FALSE"
        if( nodeName ){
            const temp = this.labelMap.get(nodeName)
            if( temp ) {
                if( !needSend && temp.needSend != needSendStr) {
                    Logger.sendEventToNodeManager({ kind: "DeleteNode", nodeName: nodeName })
                }
            } 
            this.labelMap.set(nodeName, {lastUpdateTime: new Date(), needSend:needSendStr})
        }
    }

    private sendNodeConditionsToManager(node: NodeInfo, nodeConditions: Array<k8s.V1NodeCondition>, status:string) {
        // 모니터링 대상 condition만 처리 그 외는 무시
        const targetConditions = this._config?.kubernetes?.conditions;

        const newArr: Array<NodeCondition> = []
        //targetCondition이 정의 되어 있으면 해당 condition만 전송, 아니면 모두 전송
        if (targetConditions && targetConditions.length > 0) {
            nodeConditions
                .filter(condition => targetConditions.includes(condition.type))
                .map(condition => newArr.push(condition as NodeCondition))
        } else {
            nodeConditions.map(condition => newArr.push(condition as NodeCondition))
        }

        // logger.info(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.sendEventToNodeManager({ kind: "NodeCondition", status: status, conditions: newArr, ...node })
    }

    public checkValid(labels?: { [key: string]: string; }): boolean {
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
