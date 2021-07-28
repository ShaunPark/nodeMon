import { V1NodeCondition, V1NodeSpec, V1NodeStatus } from "@kubernetes/client-node";
import jsonpath from "jsonpath";
import Log from '../logger/Logger'
import IConfig from "../types/ConfigType";
import K8SClient from "./K8SClient";

export default class K8SUtil extends K8SClient {
    protected config: IConfig;

    constructor(config: IConfig) {
        super()
        this.config = config
    }

    // 노드 condition을 변경하는 메소드 
    public async changeNodeCondition(nodeName: string, conditionType: string, str: "True" | "False", message?: string): Promise<Object> {
        try {
            const msg = (message === undefined) ? "Reboot requested by nodeMon" : message
            const condition: V1NodeCondition = {
                status: str,
                type: conditionType,
                lastHeartbeatTime: new Date(),
                lastTransitionTime: new Date(),
                message: msg,
                reason: "beeNodeMon"
            }
            const status: V1NodeStatus = { conditions: [condition] }
            const header = { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
            return this.k8sApi.patchNodeStatus(nodeName, { status: status }, undefined, undefined, undefined, undefined, header)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    public async getNodeCondition(nodeName: string, conditionName: string): Promise<V1NodeCondition[]> {
        const conditions = await this.getNodeConditions(nodeName)
        const ret: V1NodeCondition[] = jsonpath.query(conditions, `$..conditions[?(@.type == '${conditionName}')]`)
        return Promise.resolve(ret)
    }

    private async getNodeConditions(nodeName: string): Promise<V1NodeStatus> {
        try {
            // 노드 상태정보 조회
            const ret = await this.k8sApi.readNodeStatus(nodeName)

            // 성공적으로 조회된 경우만 해당 결과를 리턴 아닌경우 메시지 출력 후 종료
            if (ret.response.statusCode == 200 && ret.body.status && ret.body.status.conditions) {
                return Promise.resolve(ret.body.status)
            } else {
                Log.error(JSON.stringify(ret))
            }
        } catch (err) {
            Log.error(err.response.body.message)
        }
        return Promise.reject()
    }

    public async removeNodeCondition(nodeName: string, conditionType: string) {
        Log.info(`[K8SUtil.removeNodeCondition] remove node status of condition '${conditionType}'`)
        try {
            const status = await this.getNodeConditions(nodeName)

            Log.info(`[K8SUtil.removeNodeCondition] remove node status of '${nodeName}'`)
            if (status.conditions) {
                status.conditions = status.conditions.filter(condition => condition.type != conditionType)
                // condition 변경작업 수행 
                await this.removeNodeStatus(nodeName, status)
            }
        } catch (err) {
            Log.error(err)
        }
    }

    private async removeNodeStatus(nodeName: string, status: V1NodeStatus): Promise<Object> {
        try {
            const header = { headers: { "Content-Type": "application/merge-patch+json" } }
            const ret = await this.k8sApi.patchNodeStatus(nodeName, { status: status }, undefined, undefined, undefined, undefined, header)
            return Promise.resolve(ret)
        } catch (err) {
            Log.error(err)
        }
        return Promise.reject()
    }

    public async cordonNode(nodeName: string): Promise<Object> {
        try {
            const spec: V1NodeSpec = { unschedulable: true }
            return this.patchNode(nodeName, spec)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    private async patchNode(nodeName: string, spec: V1NodeSpec) {
        const header = { headers: { "Content-Type": "application/merge-patch+json" } }
        return this.k8sApi.patchNode(nodeName, { spec: spec }, undefined, undefined, undefined, undefined, header)
    }

    public async uncordonNode(nodeName: string): Promise<Object> {
        try {
            const spec: V1NodeSpec = { unschedulable: false }
            return this.patchNode(nodeName, spec)
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

    public async getCordonedNodes(type: string): Promise<string[]> {
        const { body } = await this.k8sApi.listNode(undefined, undefined, undefined, undefined, this.config.kubernetes.nodeSelector)
        const { items } = body
        const arr: string[] = []
        items.forEach(item => {
            console.log(JSON.stringify(item))
            const ret = jsonpath.query(item, `$.status.conditions[?(@.type == '${type}')]`)
            console.log(JSON.stringify(ret))
            if (ret.length == 1 && ret[0].status == "True") {
                if (item.metadata && item.metadata.name) {
                    arr.push(item.metadata.name)
                }
            }
        })
        return Promise.resolve(arr)
    }
}