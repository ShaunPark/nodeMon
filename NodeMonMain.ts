import { exit } from "process";
import { checkServerIdentity } from "tls";
import { parse } from "ts-command-line-args"
import { IArguments, IConfig} from "./types/Type"
import K8sMonitor from "./monitors/K8sMonitor";
import ConfigManager from "./config/ConfigManager";
import { Worker, MessageChannel, MessagePort } from "worker_threads"
import path from 'path'
import { Logger } from "./logger/Logger";

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
    public _config:IConfig = {interval:10000};

    private _isAWS:boolean = false;
    private _k8sMonitor?:K8sMonitor = undefined;
    private _esLogger!:Worker;

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

    private initEventPublishier = () => {
        this._esLogger = new Worker('./build/exporters/ESExporter.js', {
            workerData: {
                aliasModule: path.resolve(__dirname, 'exporter/ESExporter.ts'),
                interval: 10000,
                host: 'localhost',
                port: 5000            }
        })

        // Create Log Channel and init Logger class
        const { port1, port2 } = new MessageChannel();
        Logger.initLogger(port1);

        try {
            this._esLogger.postMessage({port: port2}, [port2]);

        } catch(err) {
            console.error(err)
            throw err;
        }
    }

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

    private monitorPrometheus = () => {}

    private isAWS():boolean {
        return false
    }
}

const nodeMon = new NodeMonMain();
nodeMon.run();