import * as k8s from "@kubernetes/client-node"
import { deleteItems } from "@kubernetes/client-node";

const { workerData } = require('worker_threads');
const logger= require('npmlog')

interface NodeEvent  {
    action?: string;
    count?: number;
    /**
    * Time when this Event was first observed.
    */
    eventTime?: Date;
    /**
    * The time at which the event was first recorded. (Time of server receipt is in TypeMeta.)
    */
    firstTimestamp?: Date;
    involvedObject: InvolvedObject;
    /**
    * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
    */
    kind?: string;
    /**
    * The time at which the most recent occurrence of this event was recorded.
    */
    lastTimestamp?: Date;
    /**
    * A human-readable description of the status of this operation.
    */
    message?: string;
    // metadata: V1ObjectMeta;
    /**
    * This should be a short, machine understandable string that gives the reason for the transition into the object\'s current status.
    */
    reason?: string;
    // related?: V1ObjectReference;
    /**
    * Name of the controller that emitted this Event, e.g. `kubernetes.io/kubelet`.
    */
    // reportingComponent?: string;
    /**
    * ID of the controller instance, e.g. `kubelet-xyzf`.
    */
    // reportingInstance?: string;
    // series?: CoreV1EventSeries;
    // source?: V1EventSource;
    /**
    * Type of this event (Normal, Warning), new types could be added in the future
    */
    type?: string;
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
            throw err;
        }
    }

    private sendNodeEventsToManager(nodeName:string, nodeEvents:Array<k8s.CoreV1Event>) {
        const newArr:Array<NodeEvent> = []
        nodeEvents.map( event => {
            newArr.push( event as NodeEvent)
        })
        logger.info(`Send Node Events of ${nodeName} \n ${JSON.stringify(newArr)}`)

    }

    private sendNodeConditionsToManager(nodeName:string, nodeConditions:Array<k8s.V1NodeCondition>) {
        const newArr:Array<NodeCondition> = []
        nodeConditions.map( condition => {
            newArr.push( condition as NodeCondition)
        })
        logger.info(`Send Node Conditions of ${nodeName} \n ${JSON.stringify(newArr)}`)
    }

    private async getNodeEventsAsync(k8sApi :k8s.CoreV1Api, nodeName?:string):Promise<Array<k8s.CoreV1Event>>{
        const { body } = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)
        return Promise.resolve(body.items)
    }
}
export default K8sMonitor
