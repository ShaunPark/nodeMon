import k8s, {V1NodeList, V1NodeStatus, V1NodeCondition} from "@kubernetes/client-node"

const { workerData } = require('worker_threads');
 
class K8sMonitor {
    constructor(private interval: number, private label:string ) {

    }

    private _k8sApi?:k8s.CoreV1Api;

    public async run() {

        setInterval(()=>{
            const dateTimeStr = new Date().toISOString();
            console.log(`k8s monitor ${dateTimeStr}`);
        }, this.interval)
        // const kc = new k8s.KubeConfig();
        // kc.loadFromDefault();

        // this._k8sApi = kc.makeApiClient(k8s.CoreV1Api);

        // setInterval( this.monitor, this.interval)
    }

    private async monitor() {
        if( this._k8sApi ) {
            const {body} = await this._k8sApi?.listNode()

            body.items.map( item => {
                const conditions = item?.status?.conditions;
                
                if(conditions) {
                    conditions.map( condition => console.log(condition))
                }
                // const nodeName = item.metadata?.name
                // if( nodeName ) {
                //     k8sApi.readNodeStatus(nodeName);
                // }
            })
        }
    }
}

const k8sMon = new K8sMonitor(workerData.interval, workerData.label)
k8sMon.run();
