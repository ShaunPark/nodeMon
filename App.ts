import ConfigManager from "./config/ConfigManager";
import { parse } from "ts-command-line-args"
import { Worker, MessageChannel, MessagePort } from "worker_threads"
import path from 'path'
import { IArguments, IConfig} from "./types/Type"
import Logger from "./logger/Logger";

class NodeMon {
    private _config:IConfig;
    private _esLogger!:Worker;
    
    constructor() {
        const args = parse<IArguments>({
            configFile: {type: String, alias: 'f'}
        })
        
        const configManager = new ConfigManager(args.configFile);
        this._config = configManager.config;
    }

    public run = () => {
        // console.log(this._config)
        // this.createLoggerThread()

        // setInterval(() => {
        //     const dateStr = new Date();
        //     const msg = `run ${dateStr.toDateString()}`;
        //     const milliseconds = dateStr.getMilliseconds();

        //     if( (milliseconds % 3) == 0 ) {
        //         Logger.event(msg);
        //     } else {
        //         Logger.log(msg);
        //     }

        // }, this._config.interval)
    }

    private createLoggerThread() {  
   
        // this._esLogger = new Worker('./build/exporters/ESExporter.js', {
        //     workerData: {
        //         aliasModule: path.resolve(__dirname, 'exporter/ESExporter.ts'),
        //         interval: 10000,
        //         host: 'localhost',
        //         port: 5000            }
        // })
        

        // // Create Log Channel and init Logger class
        // const { port1, port2 } = new MessageChannel();
        // Logger.initLogger(port1);

        // try {
        //     this._esLogger.postMessage({port: port2}, [port2]);

        // } catch(err) {
        //     console.error(err)
        //     throw err;
        // }
    }

    private createMonitorThread() {
        // // Start sub thread for K8S Monitor
        // const worker = new Worker('./build/monitors/K8sMonitor.js', {
        //     workerData: {
        //     aliasModule: path.resolve(__dirname, 'monitors/K8sMonitor.ts'), // worker.js uses this
        //     interval: 10000,
        //     label: "label"
        //     },
        // })
    }
}

// Start Nod Mon Main process
const nodeMon = new NodeMon()
nodeMon.run();