import { V1Node, V1NodeCondition, V1NodeList, V1NodeSpec, V1NodeStatus } from "@kubernetes/client-node";
import jsonpath from "jsonpath";
import Log from '../logger/Logger'
import IConfig from "../types/ConfigType";
import K8SClient from "./K8SClient";
import jexl from 'jexl'
import * as utils from "../util/Util"

export default class K8SUtil extends K8SClient {
    protected config: IConfig;

    constructor(config: IConfig) {
        super()
        this.config = config
    }

    // 노드 condition을 변경하는 메소드 
    public async changeNodeCondition(nodeName: string, conditionType: string, str: "True" | "False", message?: string): Promise<V1Node> {
        Log.info(`[K8SUtil.changeNodeCondition] remove node status of condition '${nodeName}' '${conditionType}' '${str}'`)

        try {
            const msg = (message === undefined) ? "Reboot requested by nodeMon" : message
            const condition: V1NodeCondition = {
                status: str,
                type: conditionType,
                lastTransitionTime: new Date(),
                lastHeartbeatTime: new Date(),
                message: msg,
                reason: "beeNodeMon"
            }
            const status: V1NodeStatus = { conditions: [condition] }
            const header = { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
            const { body } = await this.k8sApi.patchNodeStatus(nodeName, { status: status }, undefined, undefined, undefined, undefined, header)
            return Promise.resolve(body)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    private async getNodeConditions(nodeName: string): Promise<V1NodeCondition[]> {
        try {
            // 노드 상태정보 조회
            const ret = await this.k8sApi.readNodeStatus(nodeName)

            // 성공적으로 조회된 경우만 해당 결과를 리턴 아닌경우 메시지 출력 후 종료
            if (ret.response.statusCode == 200 && ret.body.status && ret.body.status.conditions) {
                return Promise.resolve(ret.body.status.conditions)
            } else {
                Log.error(JSON.stringify(ret))
            }
        } catch (err) {
            Log.error(err.response.body.message)
        }
        return Promise.reject()
    }

    public async removeNodeCondition(nodeName: string, conditionType: string): Promise<boolean> {
        Log.info(`[K8SUtil.removeNodeCondition] remove node status of condition '${conditionType}'`)
        let hasCondition = false

        try {
            const conditions = await this.getNodeConditions(nodeName)
            Log.info(`[K8SUtil.removeNodeCondition] remove node status of '${nodeName}'`)
            if (conditions) {
                conditions.forEach(condition => {
                    if (condition.type == conditionType) {
                        hasCondition = true;
                    }
                })
                if (hasCondition) {
                    const newCondition = conditions.filter(condition => condition.type != conditionType)
                    // condition 변경작업 수행 
                    await this.patchNodeStatus(nodeName, { conditions: newCondition })
                }
            }
        } catch (err) {
            Log.error(err)
        } finally {
            return Promise.resolve(hasCondition)
        }
    }

    private async patchNodeStatus(nodeName: string, status: V1NodeStatus): Promise<V1Node> {
        try {
            const header = { headers: { "Content-Type": "application/merge-patch+json" } }
            const { body } = await this.k8sApi.patchNodeStatus(nodeName, { status: status }, undefined, undefined, undefined, undefined, header)
            return Promise.resolve(body)
        } catch (err) {
            Log.error(err)
        }
        return Promise.reject()
    }

    public async cordonNode(nodeName: string): Promise<V1Node> {
        try {
            const spec: V1NodeSpec = { unschedulable: true }
            const { body } = await this.patchNode(nodeName, spec)
            return Promise.resolve(body)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    private async patchNode(nodeName: string, spec: V1NodeSpec) {
        const header = { headers: { "Content-Type": "application/merge-patch+json" } }
        return this.k8sApi.patchNode(nodeName, { spec: spec }, undefined, undefined, undefined, undefined, header)
    }

    public async uncordonNode(nodeName: string): Promise<V1Node> {
        try {
            const spec: V1NodeSpec = { unschedulable: false }
            const { body } = await this.patchNode(nodeName, spec)
            return Promise.resolve(body)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    public async getNodeListOfPods(fieldSelector: string | undefined = undefined, labelSelector: string | undefined = undefined): Promise<string[]> {
        const { body } = await this.k8sApi.listPodForAllNamespaces(undefined, undefined, fieldSelector, labelSelector)
        const nodeList = jsonpath.query(body, '$.items[*].spec.nodeName') as string[]
        return Promise.resolve(nodeList)
    }

    private async getCordonedNodes(type: string): Promise<(string | undefined)[]> {
        const labelSelector = this.config.kubernetes.nodeSelector
        const builtExpr = utils.buildExpr(labelSelector, this.config.kubernetes.nodeSelectorExpr)

        const checkFunc = (item: V1Node): boolean => {
            const ret = jsonpath.query(item, `$.status.conditions[?(@.type == '${type}')]`)
            return ret.length == 1 && ret[0].status == "True"
        }

        if (builtExpr) {
            const checkValid = (item: V1Node): boolean => {
                const ret = jexl.evalSync(builtExpr, { metadata: { labels: item.metadata?.labels } })
                return (typeof ret == "boolean") ? ret : false
            }

            const { body } = await this.k8sApi.listNode(undefined, undefined, undefined, undefined, undefined)
            const items = body.items.filter(checkValid).filter(checkFunc).map(item => item.metadata?.name)
            return Promise.resolve(items)
        } else {
            const { body } = await this.k8sApi.listNode(undefined, undefined, undefined, undefined, this.config.kubernetes.nodeSelector)
            const items = body.items.filter(checkFunc).map(item => item.metadata?.name)
            return Promise.resolve(items)
        }
    }
}