import * as k8s from "@kubernetes/client-node"
import { V1NodeCondition, V1NodeStatus } from "@kubernetes/client-node";

export default class NodeConditionChanger {
    private cli: k8s.CoreV1Api;
    
    constructor() {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        this.cli = kc.makeApiClient(k8s.CoreV1Api);
    }

    // 노드 condition을 변경하는 메소드 
    public async changeNodeCondition(nodeName: string, condition: V1NodeCondition): Promise<Object> {
        try {
            const status: V1NodeStatus = { conditions: [condition] }
            const body = { status: status }
            const header = { headers: { "Content-Type": "application/strategic-merge-patch+json" } }
            const ret = await this.cli.patchNodeStatus(nodeName, body, undefined, undefined, undefined, undefined, header)
            console.log('Job finished successfully.')
            return Promise.resolve(ret)
        } catch (err) {
            console.error(err)
            throw err
        }
    }
}