import * as k8s from "@kubernetes/client-node"
import { IConfig, NodeCondition, NodeEvent } from "../types/Type";
import Logger from "../logger/Logger";
import * as jsonpath from 'jsonpath'

class Node {
    public conditions:Array<NodeCondition> = [];
    public events:Array<NodeEvent> = [];
}
class K8sMonitor {
    constructor() {
        this.init()
    }

    private init() {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        this._k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    }

    private _k8sApi?:k8s.CoreV1Api;
    private _config?:IConfig;

    public async run(config:IConfig) {
        this._config = config;
        try {    
            if( !this._k8sApi ) {
                this.init()
            }

            const k8sApi = this._k8sApi;

            if( k8sApi ) {

                // Node selector를 적용하여 node 목록 조회
                const { body } = await k8sApi.listNode(undefined, undefined, undefined, undefined, config?.kubernetes?.nodeSelector)

                body.items.map( item => {
                    if( item.metadata && item.status ) {
                        const { name } = item.metadata;
                        const { conditions } = item.status;

                        // get internal ip address from status
                        const retArr:string[] = jsonpath.query(item,'$.status.addresses[?(@.type=="InternalIP")].address')

                        if( retArr.length < 1) {
                            console.error(`Cannot get internal ip-address of node ${name}. skip ${name}`)
                            
                        } else {
                            if ( name && conditions ) {
                                // Node condition를 node manager로 전달
                                this.sendNodeConditionsToManager(name, retArr[0], conditions)
                                // 각 Node별 event조회 및 처리
                                this.getNodeEventsAsync(k8sApi, name).then( array => this.sendNodeEventsToManager(name, retArr[0], array))
                            }
                        }        
                    }
                })
            }
        } catch(err) {
            console.error(err)
            this._k8sApi = undefined
            throw err;
        }
    }

    private pushEventToArray(arr: Array<NodeEvent>, e: NodeEvent) {
        arr.push( {
            action: e.action,
            count: e.count,
            eventTime: e.eventTime,
            firstTimestamp: e.firstTimestamp,
            involvedObject: { kind: e.involvedObject.kind, name: e.involvedObject.name, uid: e.involvedObject.uid },
            kind: e.kind,
            lastTimestamp: e.lastTimestamp,
            message: e.message,
            reason: e.reason,
            type: e.type            
        })
    }

    private sendNodeEventsToManager(nodeName:string, nodeIp:string, nodeEvents:Array<k8s.CoreV1Event>) {
        const targetEvents = this._config?.kubernetes?.events;

        const newArr:Array<NodeEvent> = []
        
        //targetEvent가 정의 되어 있으면 해당 condition만 전송, 아니면 모두 전송
        if( targetEvents && targetEvents?.length > 0 ) {
            nodeEvents
            .filter(event => event.reason && targetEvents.includes(event.reason))
            .map(e => this.pushEventToArray(newArr, e))
        } else {
            nodeEvents.map( e => this.pushEventToArray(newArr, e))    
        }

        //logger.info(`Send Node Events of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.sendEventToNodeManager({kind:"NodeEvent", nodeName: nodeName,  nodeIp: nodeIp, events: newArr})
    }

    private sendNodeConditionsToManager(nodeName:string, nodeIp:string, nodeConditions:Array<k8s.V1NodeCondition>) {
        // 모니터링 대상 condition만 처리 그 외는 무시
        const targetConditions = this._config?.kubernetes?.conditions;

        const newArr:Array<NodeCondition> = []
        //targetCondition이 정의 되어 있으면 해당 condition만 전송, 아니면 모두 전송
        if( targetConditions && targetConditions.length > 0 )  {
            nodeConditions
            .filter(condition => targetConditions.includes(condition.type))
            .map( condition => newArr.push( condition as NodeCondition))
        } else {
            nodeConditions.map( condition => newArr.push( condition as NodeCondition))
        }

        // logger.info(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.sendEventToNodeManager({kind:"NodeCondition", nodeName: nodeName, nodeIp: nodeIp, conditions: newArr})
    }

    private async getNodeEventsAsync(k8sApi :k8s.CoreV1Api, nodeName?:string):Promise<Array<k8s.CoreV1Event>> {
        const { body } = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)
        return Promise.resolve(body.items)
    }
}
export default K8sMonitor
