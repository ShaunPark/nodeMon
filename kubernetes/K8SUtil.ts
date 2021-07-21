import { V1Node, V1NodeCondition, V1NodeSpec, V1NodeStatus } from "@kubernetes/client-node";
import jsonpath from "jsonpath";
import Log from '../logger/Logger'
import IConfig from "../types/ConfigType";
import K8SClient from "./K8SClient";

export default class NodeConditionChanger extends K8SClient {
    protected config: IConfig;

    constructor(config: IConfig) {
        super()
        this.config = config
    }

    // 노드 condition을 변경하는 메소드 
    public async changeNodeCondition(nodeName: string, conditionType: string): Promise<Object> {
        try {
            const condition: V1NodeCondition = {
                status: "True",
                type: conditionType,
                lastHeartbeatTime: new Date(),
                lastTransitionTime: new Date(),
                message: "Reboot requested by nodeMon",
                reason: conditionType
            }
            const status: V1NodeStatus = { conditions: [condition] }
            const body = { status: status }
            const header = { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
            return this.k8sApi.patchNodeStatus(nodeName, body, undefined, undefined, undefined, undefined, header)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
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

    async removeNodeCondition(nodeName: string, conditionType: string) {
        Log.info(`remove node status of condition '${conditionType}'`)
        try {
            const status = await this.getNodeConditions(nodeName)

            Log.info(`remove node status of '${nodeName}'`)
            if (status.conditions) {
                status.conditions = status.conditions.filter(condition => condition.type != conditionType)
    
                Log.debug(JSON.stringify(status))
    
                // condition 변경작업 수행 
                await this.changeNodeStatus(nodeName, status)
            }
        } catch(err) {
            Log.error(err)
        }
    }

    private async changeNodeStatus(nodeName: string, status: V1NodeStatus): Promise<Object> {
        try {
            //const status: V1NodeStatus = { conditions: conditions }
            const body = { status: status }
            const header = { headers: { "Content-Type": "application/merge-patch+json" } }
            const ret = await this.k8sApi.patchNodeStatus(nodeName, body, undefined, undefined, undefined, undefined, header)
            console.log('Job finished successfully.')
            return Promise.resolve(ret)
        } catch (err) {
            Log.error(err)
        }
        return Promise.reject()
    }


    public async cordonNode(nodeName: string): Promise<Object> {
        try {
            const spec: V1NodeSpec = { unschedulable: true }
            const body: V1Node = { spec: spec }
            return this.k8sApi.patchNode(nodeName, body)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    public async uncordonNode(nodeName: string): Promise<Object> {
        try {
            const spec: V1NodeSpec = { unschedulable: false }
            const body: V1Node = { spec: spec }
            return this.k8sApi.patchNode(nodeName, body)
        } catch (err) {
            Log.error(err)
            return Promise.reject()
        }
    }

    // public async getAllNodeAndMemory(labelSelector: string | undefined): Promise<Array<string>> {
    //     const retArr = new Array<string>()

    //     Log.debug(`getAllNodeAndMemory : ${labelSelector}`)
    //     const arr = await this.k8sApi.listNode(undefined, undefined, undefined, undefined, labelSelector)

    //     arr.body.items.forEach(node => {
    //         if (node.metadata && node.metadata.name && node.status && node.status.allocatable) {
    //             retArr.push(node.metadata.name)
    //         }
    //     })

    //     Log.debug(`getAllNodeAndMemory : ${retArr.length}`)
    //     return Promise.resolve(retArr)
    // }

    public async getNodeListOfPods(fieldSelector: string | undefined = undefined, labelSelector: string | undefined = undefined):Promise<string[]> {
        const { body } = await this.k8sApi.listPodForAllNamespaces(undefined, undefined, fieldSelector, labelSelector)
        const nodeList = jsonpath.query(body, '$.items[*].spec.nodeName') as string[]
        return Promise.resolve(nodeList)
    }
}