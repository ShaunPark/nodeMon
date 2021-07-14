import { parse } from "ts-command-line-args"
import { IArguments, IConfig} from "./types/Type"
import K8sMonitor from "./monitors/K8sMonitor";
import ConfigManager from "./config/ConfigManager";
import { Worker, MessageChannel, MessagePort } from "worker_threads"
import path from 'path'
import Logger from "./logger/Logger";
import { K8SEventInformer } from "./watches/K8SEventInformer";
import { K8SNodeInformer } from "./watches/K8SNodeInformer";

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
    private _k8sMonitor?:K8sMonitor = undefined;
    private _esLogger!:Worker;
    private _nodeManager!:Worker;
    private configManager:ConfigManager;

    constructor(private configFile:string) {
        // command line argument parsing 
        // argument 파싱 에러 발생 시 종료 
        try {
            this.configManager = new ConfigManager(configFile);
            const config:IConfig = this.configManager.config;

            logger.info(`load config from ${configFile}`)
            logger.info(config.interval)
            if( config.kubernetes) {
                const {interval, label} = config.kubernetes;
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
        const config:IConfig = this.configManager.config;

        logger.info(config.interval)

        logger.info(`NodeMon started`)
        this.initChannels(this.configFile);

        // if( config.kubernetes ) {
        //     this._k8sMonitor = new K8sMonitor();
        // }
        // const interval = (config.interval == undefined || config.interval < 1000)?1000:config.interval;
        // logger.info(`NodeMon main Loop interval : ${interval}`)
        // 
        //setInterval(this.mainLoop, interval)

        if( config.kubernetes ) {
            const nodeInformer = new K8SNodeInformer()
            nodeInformer.createAndStartInformer(this.configManager.config)
            const eventInformer = new K8SEventInformer()
            eventInformer.createAndStartInformer(this.configManager.config)
        }
    }

    private initChannels = (configFile:string) => {
        this._esLogger = new Worker('./build/exporters/ESExporter.js', {
            workerData: {
                aliasModule: path.resolve(__dirname, 'exporter/ESExporter.ts'),
                config: configFile
            }
        })

        this._nodeManager = new Worker('./build/managers/NodeManager.js', {
            workerData: {
                aliasModule: path.resolve(__dirname, 'managers/NodeManager.ts'),
                config: configFile
            }
        })

        // Create Log Channel and init Logger class
        const mainToesChannel = new MessageChannel();
        const mainTonmChannel = new MessageChannel();
        const nmToEsChannel = new MessageChannel();
        Logger.initLogger(mainToesChannel.port1,mainTonmChannel.port1 );

        try {
            this._nodeManager.postMessage({type: "parent", port: mainTonmChannel.port2}, [mainTonmChannel.port2]);
            this._nodeManager.postMessage({type: "es", port: nmToEsChannel.port2}, [nmToEsChannel.port2]);

            this._esLogger.postMessage({type: "parent", port: mainToesChannel.port2}, [mainToesChannel.port2]);
            this._esLogger.postMessage({type: "nm", port: nmToEsChannel.port1}, [nmToEsChannel.port1]);
        } catch(err) {
            console.error(err)
            throw err;
        }
    }

    private mainLoop = () => {
        const config:IConfig = this.configManager.config;

        logger.info('NodeMon main Loop started')
        // this.monitorK8S()
        if ( this._k8sMonitor ) {
            logger.info('K8S monitor main Loop started')

            this._k8sMonitor.run(config).then( () => {
                console.log("monitor k8s ended.")
            });
        }

        this.monitorPrometheus()
    }

    private monitorPrometheus = () => {}
}

const args = parse<IArguments>({
    configFile: {type: String, alias: 'f'}
})
const nodeMon = new NodeMonMain(args.configFile);
nodeMon.run();