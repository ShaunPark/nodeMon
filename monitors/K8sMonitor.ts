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
    constructor(private interval: number, private label:string ) {
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
                {
                    const {body} = await k8sApi.listNode()
                    const nodes = new Map<string, Node>()

                    body.items.map( item => {
                        if( item.metadata ) {
                            const {name} = item.metadata;
                            if ( name ) {
                                const node = new Node()

                                if ( item?.status) {
                                    if(item?.status?.conditions) {
                                        node.conditions = item?.status?.conditions;
                                    }
                                }

                                this.getNodeEventAsync(k8sApi, name).then( list => {
                                    node.events = list;
                                })
        
                                nodes.set(name, node)
                            }
                        }
                    })

                    this.sendToNodeManager(nodes)
                }
            }
        } catch(err) {
            console.error(err)
            throw err;
        }
    }

    private sendToNodeManager(nodes:Map<string, any>) {
        nodes.forEach((value, key) => {
            logger.info(value)
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
