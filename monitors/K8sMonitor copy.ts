import * as k8s from "@kubernetes/client-node"
const { workerData } = require('worker_threads');
 
class K8sMonitor {
    constructor(private interval: number, private label:string ) {

    }

    private _k8sApi?:k8s.CoreV1Api;

    public run() {

        // setInterval(()=>{
        //     const dateTimeStr = new Date().toISOString();
        //     console.log(`k8s monitor ${dateTimeStr}`);
        // }, this.interval)
        try {
            const kc = new k8s.KubeConfig();
            kc.loadFromDefault();
    
            const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
            console.log(`Start K8Smonitor with interval : ${this.interval}`)
            setInterval( () => this.monitor(k8sApi), this.interval)
    
        } catch(err) {
            console.error(err)
            throw err;
        }
    }

    private async monitor( k8sApi :k8s.CoreV1Api) {
        console.log("----Node Conditons------------------------------------------")
        try {    
            if( k8sApi ) {
                {
                    const {body} = await k8sApi.listNode()

                    body.items.map( item => {
                        if ( item?.status) {
                            const {conditions} = item?.status;
                        
                        if(conditions) {
                            conditions.map( ({reason, lastTransitionTime, type}) => console.log(`${reason} : ${lastTransitionTime} - ${type}`))
                        }
                        // const nodeName = item.metadata?.name
                        // if( nodeName ) {
                        //     k8sApi.readNodeStatus(nodeName);
                        // }}
                        }
                    })

                    body.items.map( item => {
                        if( item.metadata){ this.getNodeEvent(k8sApi, item.metadata.name)}
                           
                    })
                }
            }
        } catch(err) {
            console.error(err)
            throw err;
        }
    }

    private async getNodeEvent(k8sApi :k8s.CoreV1Api, nodeName?:string) {
        console.log(`----Node Events of ${nodeName}  ------------------------------------------`)

        {
            const {body} = await k8sApi.listEventForAllNamespaces(undefined, undefined, `involvedObject.kind=Node,involvedObject.name=${nodeName}`)

            if( body.items.length > 0) {
                body.items.map( ({message, eventTime }) => {
                    console.log(`Message : ${message} @ ${eventTime?.toISOString()}`)
                })
            } else {
                console.log("No Events");
            }
        }
    }
}



const k8sMon = new K8sMonitor(workerData.interval, workerData.label)
k8sMon.run();
