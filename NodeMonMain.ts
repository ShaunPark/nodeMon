import { exit } from "process";
import { checkServerIdentity } from "tls";
import { parse } from "ts-command-line-args"
import { IArguments, IConfig} from "./types/Type"
import K8sMonitor from "./monitors/K8sMonitor";
import ConfigManager from "./config/ConfigManager";

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
    public _config:IConfig = {interval:10000};
    private _k8sMonitor?:K8sMonitor = undefined;
    constructor() {
        this._isAWS = this.isAWS()

        // command line argument parsing 
        // argument 파싱 에러 발생 시 종료 
        try {
            const args = parse<IArguments>({
                configFile: {type: String, alias: 'f'}
            })

            const configManager = new ConfigManager(args.configFile);
            this._config = configManager.config;
    

            logger.info(`load config from ${args.configFile}`)
            logger.info(this._config.interval)
            if( this._config.kubernetes) {
                const {interval, label} = this._config.kubernetes;
                logger.info(` interval ${interval} : ${label}`)
            } else {
                logger.info('no kubernetes info')
            }
        }  catch (err) {
            logger.err(err)
            process.exit(1);
        }
    }

    public run = (): void => {
        logger.info(`NodeMon started`)
        this.initEventPublishier();
        this.startESExporter();
        this.startNodeManager()

        if( this._config.kubernetes ) {
            this._k8sMonitor = new K8sMonitor(this._config.kubernetes.label);
        }
        const interval = (this._config.interval == undefined || this._config.interval < 1000)?1000:this._config.interval;
        logger.info(`NodeMon main Loop interval : ${interval}`)

        setInterval(this.mainLoop, interval)
    }

    private initEventPublishier = () => {}
    private startNodeManager = () => {}
    private startESExporter = () => {}

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