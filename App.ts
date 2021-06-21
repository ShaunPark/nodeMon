import ConfigManager from "./config/ConfigManager";
import { parse } from "ts-command-line-args"
import { IConfig } from "./config/Config"
import { Worker } from "worker_threads"
import path from 'path'

interface IArguments {
    configFile: string;
}

class NodeMon {
    
    constructor() {
    }

    public run(config:IConfig) {
        console.log(config)
        setInterval(() => {
            const dateStr = new Date();
            console.log(`run ${dateStr.toDateString()}`)
        }, config.loopInterval)
    }
}

const args = parse<IArguments>({
    configFile: {type: String, alias: 'f'}
})

const configManager = new ConfigManager(args.configFile);


let nodeMon = new NodeMon()
nodeMon.run(configManager.config);


const worker = new Worker('./build/monitors/K8sMonitor.js', {
    workerData: {
      aliasModule: path.resolve(__dirname, 'monitors/K8sMonitor.ts'), // worker.js uses this
      interval: 3000,
      label: "label"
    },
  })
  

// const worker = new Worker('./build/monitors/K8sMonitor.js', {
//     workerData: {
//         path: './monitors/K8sMonitor.ts',
//         interval: 3000,
//         label: "label"
//     }
// });