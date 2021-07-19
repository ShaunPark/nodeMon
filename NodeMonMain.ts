import { parse } from "ts-command-line-args"
import { Worker, MessageChannel } from "worker_threads"

import IArguments from "./types/Type"
import IConfig from "./types/ConfigType"
import ConfigManager from "./config/ConfigManager";
import path from 'path'
import Channel from "./logger/Channel";
import K8SEventInformer from "./kubernetes/K8SEventInformer";
import K8SNodeInformer from "./kubernetes/K8SNodeInformer";
import Log from './logger/Logger'

type Config = {
    interval: number;
    kubernetes?: KubernetesConfig;
}

type KubernetesConfig = {
    interval: number;
    label: string;
}

export class NodeMonMain {
    private _esLogger!: Worker;
    private _nodeManager!: Worker;
    private configManager: ConfigManager;

    constructor(private configFile: string, private dryRun?: boolean) {
        // command line argument parsing 
        // argument 파싱 에러 발생 시 종료 
        try {
            this.configManager = new ConfigManager(configFile);
            const config: IConfig = this.configManager.config;

            Log.info(`load config from ${configFile}`)
            // logger.info(config.interval)
            // if (config.kubernetes) {
            //     const { interval } = config.kubernetes;
            //     logger.info(` interval ${interval} : ${label}`)
            // } else {
            //     logger.info('no kubernetes info')
            // }
        } catch (err) {
            Log.error(err)
            process.exit(1);
        }
    }

    public run = (): void => {
        const config: IConfig = this.configManager.config;

        Log.info(`NodeMon started`)
        this.initChannels(this.configFile);

        if (config.kubernetes) {
            const nodeInformer = new K8SNodeInformer()
            nodeInformer.createAndStartInformer(this.configManager.config)
            const eventInformer = new K8SEventInformer()
            eventInformer.createAndStartInformer(this.configManager.config)
        }
        const currentNode = process.env.NODE_NAME
        if (currentNode) {
            Channel.sendMessageEventToES({ message: `Node monitor started on node ${currentNode}.`, node: currentNode })
        } else {
            Channel.sendMessageEventToES({ message: `Node monitor started.`, node: "--------" })
        }
    }

    private initChannels = (configFile: string) => {
        this._esLogger = new Worker('./build/elasticsearch/ESExporter.js', {
            workerData: {
                aliasModule: path.resolve(__dirname, 'elasticsearch/ESExporter.ts'),
                config: configFile
            }
        })

        this._nodeManager = new Worker('./build/managers/NodeManagerRun.js', {
            workerData: {
                aliasModule: path.resolve(__dirname, 'managers/NodeManagerRun.ts'),
                config: configFile,
                dryRun: (this.dryRun === undefined) ? false : this.dryRun
            }
        })

        // Create Log Channel and init Logger class
        const mainToesChannel = new MessageChannel();
        const mainTonmChannel = new MessageChannel();
        const nmToEsChannel = new MessageChannel();
        Channel.initLogger(mainToesChannel.port1, mainTonmChannel.port1);

        try {
            this._nodeManager.postMessage({ type: "parent", port: mainTonmChannel.port2 }, [mainTonmChannel.port2]);
            this._nodeManager.postMessage({ type: "es", port: nmToEsChannel.port2 }, [nmToEsChannel.port2]);

            this._esLogger.postMessage({ type: "parent", port: mainToesChannel.port2 }, [mainToesChannel.port2]);
            this._esLogger.postMessage({ type: "nm", port: nmToEsChannel.port1 }, [nmToEsChannel.port1]);
        } catch (err) {
            Log.error(err)
            throw err;
        }
    }

    // private mainLoop = () => {
    //     const config: IConfig = this.configManager.config;

    //     logger.info('NodeMon main Loop started')

    //     this.monitorPrometheus()
    // }

    // private monitorPrometheus = () => { }

    close = async () => {
        this._esLogger.postMessage({ type: "shutdown"});

        const currentNode = process.env.NODE_NAME
        if (currentNode) {
            Channel.sendMessageEventToES({ message: `Node monitor stoped from node ${currentNode}.`, node: currentNode })
        } else {
            Channel.sendMessageEventToES({ message: `Node monitor stopped.`, node: "--------" })
        }

        setTimeout( () => {
            this._esLogger.terminate()
            this._nodeManager.terminate()
        }, 1000)
    }
}

const args = parse<IArguments>({
    configFile: { type: String, alias: 'f' },
    dryRun: { type: Boolean, optional: true }
})
const nodeMon = new NodeMonMain(args.configFile, args.dryRun);

process.on('SIGTERM', function onSigterm() {
    Log.info('Got SIGTERM. Graceful shutdown start')

    nodeMon.close();
})

nodeMon.run();