import { exit } from "process";
import { checkServerIdentity } from "tls";
import { parse } from "ts-command-line-args"
import { IArguments} from "./types/Type"
import K8sMonitor from "./monitors/K8sMonitor";

const logger= require('npmlog')

type Config = {
    interval: number;
    kubernetes?: KubernetesConfig;
}

type KubernetesConfig = {
    interval: number;
    label: string;
}

export class NodeMonMain {

    private _isAWS:boolean = false;
    private _config:Config = {interval:10000};
    private _k8sMonitor?:K8sMonitor = undefined;
    constructor() {
        this._isAWS = this.isAWS()

        // command line argument parsing 
        // argument 파싱 에러 발생 시 종료 
        try {
            const args = parse<IArguments>({
                configFile: {type: String, alias: 'f'}
            })
            this._config = this.initConfigManager(args.configFile);
        }  catch (err) {
            logger.err(err)
            process.exit(1);
        }
    }

    public run():void {
        logger.info(`NodeMon started`)
        this.initEventPublishier();
        this.startESExporter();
        this.startNodeManager()

        if( this._config.kubernetes ) {
            const { interval, label } = this._config.kubernetes;
            this._k8sMonitor = new K8sMonitor(interval, label);
        }

        setInterval(this.mainLoop, this._config.interval)
    }

    private initEventPublishier = () => {}
    private startNodeManager = () => {}
    private startESExporter = () => {}
    private initConfigManager = (configFile:string):Config =>{ return {interval:10000}}

    private mainLoop = () => {
        logger.info('NodeMon main Loop started')
        // this.monitorK8S()
        if ( this._k8sMonitor ) {
            logger.info('K8S monitor main Loop started')

            this._k8sMonitor.run().then( () => {
                console.log("monitor k8s ended.")
            });
        }

        this.monitorPrometheus()
    }

    // private monitorK8S = () => {
    // }

    private monitorPrometheus = () => {}

    private isAWS():boolean {
        return false
    }
}

const nodeMon = new NodeMonMain();
nodeMon.run();