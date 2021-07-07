import * as k8s from '@kubernetes/client-node';
import { IConfig } from '../types/Type';


export class K8SNodeInformer {
    private _k8sApi:k8s.CoreV1Api;
    private _config?:IConfig;
    private _kc:k8s.KubeConfig;
    constructor() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
    }

    private reInit() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
    }

    createAndStartInformer = (config:IConfig) => {            
        const listFn = () => this._k8sApi.listNode(
            undefined,
            undefined,
            undefined,
            undefined,
            config?.kubernetes?.nodeSelector,
        );
    
        const informer = k8s.makeInformer(
            this._kc,
            '/api/v1/nodes',
            listFn
        );
        
        informer.on('add', (obj: k8s.V1Node) => {
            console.log(`Added: ${JSON.stringify(obj)}`);
        });
        informer.on('update', (obj: k8s.V1Node) => {
            console.log(`Updated: ${JSON.stringify(obj)}`);
        });
        informer.on('delete', (obj: k8s.V1Node) => {
            console.log(`Deleted: ${JSON.stringify(obj)}`);
        });
        informer.on('error', (err: k8s.V1Node) => {
            console.error(err);
            // Restart informer after 5sec
            setTimeout(() => {
                this.reInit()
                informer.start()
            }, 5000);
        });
        informer.start()
    }
}
