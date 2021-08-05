import Channel from "../logger/Channel"
import { NodeConditionCache } from "../types/Type"

export class NodeStatus {
    public static lastRebootTime: Date | undefined
    public static changedTime?:Date = undefined
    private static nodeStatusCache = new Map<string, NodeConditionCache>()
    /**
         * 노드정보를 관리하는 목록에서 노드를 검색
         * @param nodeName 노드 명
         * @returns 노드 정보
         */
    public static getNode(nodeName: string) {
        return this.nodeStatusCache.get(nodeName)
    }
    /**
     * 노드정보 목록에서 노드를 삭제
     * @param nodeName 노드 명
     */
    public static deleteNode(nodeName: string) {
        this.nodeStatusCache.delete(nodeName)
    }
    /**
     * 모든 노드 정보를 리턴
     * @returns 노드정보 목록
     */
    public static getAll() {
        return this.nodeStatusCache
    }
    /**
     * 기존 노드 정보을 변경하여 저장. 노드 정보가 변경될때마다 elastic search의 상태 인덱스를 업데이트 
     * @param node 신규/변경된 노드 정보
     * @param obj 변경할 속성을 가진 오브젝트
     */
    public static setNode(node: NodeConditionCache, obj?: Object) {
        const newNode = { ...node, ...obj }
        Channel.sendNodeStatusToES(newNode);
        this.nodeStatusCache.set(newNode.nodeName, newNode)
        this.changedTime = new Date();
    }

    public static isCordoned(nodeName: string): boolean {
        const node = this.getNode(nodeName)
        if (node) {
            return node.hasScheduled
        }
        return false
    }

    public static findNodes(f: (node: NodeConditionCache) => boolean): string[] {
        return Array.from(this.nodeStatusCache)
            .map(([_, node]) => node)
            .filter(f)
            .sort((node1, node2) => {
                return node1.lastRebootedTime - node2.lastRebootedTime
            })
            .map(node => node.nodeName)
    }


    public static getChangedTime() {
        return this.changedTime !== undefined
    }

    public static resetChangedTime() {
        this.changedTime = undefined
    }
}