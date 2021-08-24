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
    private nodeInformer: K8SNodeInformer;
    private eventInformer: K8SEventInformer

    constructor(private configFile: string, private dryRun?: boolean, kubeConfig?:string) {
        // command line argument parsing 
        // argument 파싱 에러 발생 시 종료 
        try {
            this.configManager = new ConfigManager(configFile);
            const config: IConfig = this.configManager.config;

            Log.info(`[NodeMonMain] load config from ${configFile}`)
            this.nodeInformer = new K8SNodeInformer(config, kubeConfig)
            this.eventInformer = new K8SEventInformer(config, kubeConfig)
        } catch (err) {
            Log.error(err)
            process.exit(1);
        }
    }

    public run = () => {
        Log.info(`[NodeMonMain.run] NodeMon started`)
        this.initChannels(this.configFile);

        this.nodeInformer.startInformer()
        // NodeInformer에 의해 노드 정보가 오기전에 오는 이벤트들이 무시되지 않도록 eventinformer를 5초 후에 시작.
        setTimeout(() => {
            this.eventInformer.startInformer()
        }, 5000)

        const currentNode = process.env.NODE_NAME
        if (currentNode) {
            Channel.info(currentNode, 'Node monitor started.')
        } else {
            Channel.info("--------", 'Node monitor started.')
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
        Channel.initLogger(mainToesChannel.port1, mainTonmChannel.port1, this.configManager.config.kubernetes.clusterName);

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

    close = () => {
        this._esLogger.postMessage({ type: "shutdown" });
        this._nodeManager.postMessage({ type: "shutdown" });

        Log.info('[NodeMonMain.close] Stop Informers')
        this.eventInformer.stopInformer()
        this.nodeInformer.stopInformer()

        const currentNode = process.env.NODE_NAME
        if (currentNode) {
            Channel.info(currentNode, 'Node monitor stoped')
        } else {
            Channel.info("--------", 'Node monitor stopped.')
        }
        this._esLogger.terminate()
        this._nodeManager.terminate()
    }
}

const args = parse<IArguments>({
    configFile: { type: String, alias: 'f' },
    kubeConfig: { type: String, alias: 'k', optional:true },
    dryRun: { type: Boolean, optional: true }
})
const nodeMon = new NodeMonMain(args.configFile, args.dryRun, args.kubeConfig);

process.on('SIGTERM', function onSigterm() {
    Log.info('[NodeMonMain.onSigterm] Got SIGTERM. Graceful shutdown start')

    nodeMon.close();
})

nodeMon.run();