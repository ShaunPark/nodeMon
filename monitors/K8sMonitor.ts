import * as k8s from "@kubernetes/client-node"

const { workerData } = require('worker_threads');
const logger= require('npmlog')

interface NodeEvent  {
    timestamp: Date,
    event?: K8SEvent,
}

interface K8SEvent {
    uid: string,
    message: string,
    namespace: string,
    reason: string,
    involvedObject: InvolvedObject,
    type: string,
    firstTimestamp: string,
    lastTimestamp: string
}

interface InvolvedObject {
    kind: string,
    name: string,
    uid: string
}


interface NodeCondition {
    lastHeartbeatTime?: Date;
    lastTransitionTime?: Date;
    message?: string;
    reason?: string;
    status: string;
    type: string;
}
class Node {
    public conditions:Array<NodeCondition> = [];
    public events:Array<NodeEvent> = [];
}
class K8sMonitor {
    constructor(private label?:string ) {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        this._k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    }

    private _k8sApi?:k8s.CoreV1Api;

    public async run() {
        logger.info("----Node Conditons------------------------------------------")
        try {    
            const k8sApi = this._k8sApi;
            if( k8sApi ) {
                const {body} = await k8sApi.listNode()
                let nodes = new Map<string, Node>()

                logger.info(`${body.items.length} nodes found`)

                body.items.map( item => {
                    if( item.metadata ) {
                        const {name} = item.metadata;

                        logger.info(`Node name : ${name}`)
                        let temoNode = new Node()

                        if ( name ) {

                            if ( item?.status) {
                                const {conditions} = item.status;

                                conditions?.map( condition => {
                                    temoNode.conditions.push(condition as NodeCondition);
                                })
                                // if(item?.status?.conditions) {
                                //     temoNode.conditions = item?.status?.conditions;
                                //     logger.info(`Node condition count : ${temoNode.conditions.length}`)
                                // } else {
                                //     logger.info(`Node condition is not found`)
                                // }
                            }

                            this.getNodeEventAsync(k8sApi, name).then( list => {
                                logger.log(`returned value ${list}`)
                                // if(list) {
                                //     logger.info(`Node event count : ${list.items.length}`)
                                // } else {
                                //     logger.info(`Node event is not found`)
                                // }
                                // temoNode.events = list;
                            })
    
                            logger.info(`node info ${temoNode.conditions.length} ${temoNode.events.length}`)
                            nodes.set(name, temoNode)
                        }
                    }
                })

                nodes.forEach((value, key) => {
                    logger.info(`----${key} Conditions aaa-----${value.conditions.length} ${value.events.length}------`)
        
                    value.conditions.forEach( condition => {
                        logger.log(condition)
                    })
        
                    logger.info(`----Events aaa-----------`)
        
                    value.events.forEach( item => {
                        logger.log(item)
                    })
                })
        

                //this.sendToNodeManager(nodes)
            }
        } catch(err) {
            console.error(err)
            throw err;
        }
    }

    // private sendToNodeManager(nodes:Map<string, Node>) {
    //     nodes.forEach((value, key) => {
    //         logger.info(`----Conditions -----------`)

    //         value.conditions?.forEach( condition => {
    //             logger.log(condition)
    //         })

    //         logger.info(`----Events -----------`)

    //         value.events?.items.forEach( item => {
    //             logger.log(item)
    //         })
    //     })
    // }

    private async getNodeEventAsync(k8sApi :k8s.CoreV1Api, nodeName?:string):Promise<k8s.CoreV1EventList>{
        logger.info(`----Node Events of ${nodeName}  ------------------------------------------`)

        const { body } = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)

        logger.info(`return value ${JSON.stringify(body)}`)

        return Promise.resolve(body)
        // return new Promise((resolve, reject) => {
        //     if( body.items.length > 0) {
        //         body.items.map( (item) => {
        //             const nodeEvent:NodeEvent = { timestamp: new Date()};
        //             nodeEvent.event = item;
        //             console.log( `event message : ${nodeEvent.event.message}`)
        //             // console.log(`Message : ${message} @ ${eventTime?.toISOString()}`)
        //         })
        //     } else {
        //         Logger.log("No Events");
        //     }
    
        // })
    }
}
export default K8sMonitor
