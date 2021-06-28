import * as k8s from "@kubernetes/client-node"
import { IConfig, NodeCondition, NodeEvent } from "../types/Type";
import { Logger } from "../logger/Logger";

const { workerData } = require('worker_threads');
// const logger= require('npmlog')

class Node {
    public conditions:Array<NodeCondition> = [];
    public events:Array<NodeEvent> = [];
}
class K8sMonitor {
    constructor( private config?:IConfig ) {
        this.init()
    }

    private init() {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        this._k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    }

    private _k8sApi:k8s.CoreV1Api|undefined;

    public async run() {
        try {    
            if( !this._k8sApi ) {
                this.init()
            }

            const k8sApi = this._k8sApi;

            if( k8sApi ) {

                // Node selector를 적용하여 node 목록 조회
                const {body} = await k8sApi.listNode(undefined, undefined, undefined, undefined, this.config?.kubernetes?.nodeSelector)

                body.items.map( item => {
                    if( item.metadata && item.status ) {
                        const { name } = item.metadata;
                        const {conditions} = item.status;
            
                        if ( name && conditions ) {
                            // Node condition를 node manager로 전달
                            this.sendNodeConditionsToManager(name, conditions)
                            // 각 Node별 event조회 및 처리
                            this.getNodeEventsAsync(k8sApi, name).then( array => this.sendNodeEventsToManager(name, array))
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

    private sendNodeEventsToManager(nodeName:string, nodeEvents:Array<k8s.CoreV1Event>) {
        const targetEvents = this.config?.kubernetes?.events;

        const newArr:Array<NodeEvent> = []
        
        //targetEvent가 정의 되어 있으면 해당 condition만 전송, 아니면 모두 전송
        if( targetEvents && targetEvents?.length > 0 ) {
            nodeEvents
            .filter(event => event.type && targetEvents.includes(event.type))
            .map(event => newArr.push( event as NodeEvent))

        } else {
            nodeEvents.map( event => newArr.push( event as NodeEvent))    
        }
        //logger.info(`Send Node Events of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.sendEventToNodeManager({kind:"NodeEvent", nodeName: nodeName,  events: newArr})
    }

    private sendNodeConditionsToManager(nodeName:string, nodeConditions:Array<k8s.V1NodeCondition>) {
        // 모니터링 대상 condition만 처리 그 외는 무시
        const targetConditions = this.config?.kubernetes?.conditions;

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
        Logger.sendEventToNodeManager({kind:"NodeCondition", nodeName: nodeName,  conditions: newArr})
    }

    private async getNodeEventsAsync(k8sApi :k8s.CoreV1Api, nodeName?:string):Promise<Array<k8s.CoreV1Event>> {
        const { body } = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)
        return Promise.resolve(body.items)
    }
}
export default K8sMonitor
