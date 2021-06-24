import * as k8s from "@kubernetes/client-node"

const { workerData } = require('worker_threads');
const logger= require('npmlog')

interface NodeEvent  {
    timestamp: Date,
    event?: K8SEvent,
}

type K8SEvent = {
    uid: string,
    message: string,
    namespace: string,
    reason: string,
    involvedObject: InvolvedObject,
    type: string,
    firstTimestamp: string,
    lastTimestamp: string
}

type InvolvedObject = {
    kind: string,
    name: string,
    uid: string
}
class Node {
    public conditions?:Array<k8s.V1NodeCondition>;
    public events?:k8s.CoreV1EventList;
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
                                if(item?.status?.conditions) {
                                    temoNode.conditions = item?.status?.conditions;
                                    logger.info(`Node condition count : ${temoNode.conditions.length}`)
                                } else {
                                    logger.info(`Node condition is not found`)
                                }
                            }

                            this.getNodeEventAsync(k8sApi, name).then( list => {
                                if(list) {
                                    logger.info(`Node event count : ${list.items.length}`)
                                } else {
                                    logger.info(`Node event is not found`)
                                }
                                temoNode.events = list;
                            })
    
                            logger.info(`node info ${temoNode.conditions?.length} ${temoNode.events?.items.length}`)
                            nodes.set(name, temoNode)
                        }
                    }
                })

                this.sendToNodeManager(nodes)
            }
        } catch(err) {
            console.error(err)
            throw err;
        }
    }

    private sendToNodeManager(nodes:Map<string, Node>) {
        nodes.forEach((value, key) => {
            logger.info(`----Conditions -----------`)

            value.conditions?.forEach( condition => {
                logger.log(condition)
            })

            logger.info(`----Events -----------`)

            value.events?.items.forEach( item => {
                logger.log(item)
            })
        })
    }

    private async getNodeEventAsync(k8sApi :k8s.CoreV1Api, nodeName?:string):Promise<k8s.CoreV1EventList>{
        logger.info(`----Node Events of ${nodeName}  ------------------------------------------`)

        const { body } = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)
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
