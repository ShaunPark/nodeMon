import * as k8s from "@kubernetes/client-node"
import { deleteItems } from "@kubernetes/client-node";
import { NodeCondition, NodeEvent } from "../types/Type";
import { Logger } from "../logger/Logger";

const { workerData } = require('worker_threads');
const logger= require('npmlog')

class Node {
    public conditions:Array<NodeCondition> = [];
    public events:Array<NodeEvent> = [];
}
class K8sMonitor {
    constructor( private label?:string ) {
        this.init()
    }

    private init() {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        this._k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    }

    private _k8sApi?:k8s.CoreV1Api;

    public async run() {
        try {    
            if( !this._k8sApi ) {
                this.init()
            }

            const k8sApi = this._k8sApi;

            if( k8sApi ) {
                const {body} = await k8sApi.listNode()

                let nodeConditions = new Map<string, NodeCondition>()
    
                body.items.map( item => {
                    if( item.metadata && item.status ) {
                        const { name } = item.metadata;
                        const {conditions} = item.status;
    
                        if ( name && conditions ) {
    
                            this.sendNodeConditionsToManager(name, conditions)
    
                            this.getNodeEventsAsync(k8sApi, name).then( array => {
                                this.sendNodeEventsToManager(name, array)
                            })
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
        const newArr:Array<NodeEvent> = []
        nodeEvents.map( event => {
            newArr.push( event as NodeEvent)
        })
        //logger.info(`Send Node Events of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.log(`Send Node Events of ${nodeName} \n ${JSON.stringify(newArr)}`)
    }

    private sendNodeConditionsToManager(nodeName:string, nodeConditions:Array<k8s.V1NodeCondition>) {
        const newArr:Array<NodeCondition> = []
        nodeConditions.map( condition => {
            newArr.push( condition as NodeCondition)
        })
        // logger.info(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
        Logger.log(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
    }

    private async getNodeEventsAsync(k8sApi :k8s.CoreV1Api, nodeName?:string):Promise<Array<k8s.CoreV1Event>> {
        const { body } = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)
        return Promise.resolve(body.items)
    }
}
export default K8sMonitor
