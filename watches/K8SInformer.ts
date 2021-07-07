import * as k8s from '@kubernetes/client-node';
import { V1Node } from '@kubernetes/client-node';
import { json } from 'express';
import { IConfig } from '../types/Type';

interface LocalLabel {
    key: string,
    value: any
}
export class K8SNodeInformer {
    private _k8sApi: k8s.CoreV1Api;
    private _config?: IConfig;
    private _kc: k8s.KubeConfig;
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


    public stringsToArray = (str?: string): Array<LocalLabel> | undefined => {
        if (str == undefined) {
            return undefined
        }
        const array = new Array<LocalLabel>()
        const strs = str.trim().split(",")
        strs.forEach(s => {
            const values = s.trim().split("=")
            array.push({key:values[0] , value:values.slice(1).join("=")})
        })
        return array
    }

    createAndStartInformer = (config: IConfig) => {
        const labelSelector = config?.kubernetes?.nodeSelector;
        const listFn = () => this._k8sApi.listNode(
            undefined,
            true,
            undefined,
            undefined,
            labelSelector,
        );

        const informer = k8s.makeInformer(
            this._kc,
            '/api/v1/nodes',
            listFn
        );

        const labelMap = this.stringsToArray(labelSelector)

        informer.on('add', (obj: k8s.V1Node) => {
            console.log('Node add event !!!')
            if( this.checkValid(labelMap, obj.metadata?.labels)) {
                console.log(`Added: ${JSON.stringify(obj)}`);
            }
        });
        informer.on('update', (obj: k8s.V1Node) => {
            console.log('Node update event !!!')

            if( this.checkValid(labelMap, obj.metadata?.labels)) {
                console.log(`Updated: ${JSON.stringify(obj)}`);
            }
        });
        informer.on('delete', (obj: k8s.V1Node) => {
            console.log('Node delete event !!!')

            if( this.checkValid(labelMap, obj.metadata?.labels)) {
                console.log(`Deleted: ${JSON.stringify(obj)}`);
            }
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

    public checkValid(labelMap?:LocalLabel[], labels?:{[key: string]: string;}):boolean {
        if ( labelMap && labels ) {
            let hasAllLabel: boolean = true;
            labelMap.forEach( lbl => {
                const v = labels[lbl.key]
                if( !v || v != lbl.value ) {
                    hasAllLabel = false;
                }
            })
            return hasAllLabel
        } 

        return (labelMap == undefined)
    }
}
