import { MessagePort } from "worker_threads"
const { workerData, parentPort } = require('worker_threads');

class NodeManager {

    constructor(private interval:number, private host:string, private port:MessagePort, private loggerPort:MessagePort) {
        parentPort.addEventListener("message", this.initMessageHandler)
    }

    private initMessageHandler = (event:MessageEvent) => {
        if( event.data.port ) {
            const ePort:MessagePort = event.data.port;
            ePort.addListener("message", this.onEvent);
        }
    }

    private onEvent = (event:MessageEvent) => {
        console.log(`receive node events : ${event}`)
        
        // if( event instanceof Object && Object.prototype.hasOwnProperty.call(event, "type")) {
        //     console.log(`log in es exporter : ${event}`);
        // } else {
        //     console.log(`event in es exporter : ${event}`);
        // }
    }

    public run() {
        setInterval(this.checkNodeStatus, 10000)
    }

    private checkNodeStatus = () => {
        console.log("NodeManager started.")
        // run routine 

        // run daily routine

    }

    private dayCheckStartTime:Date = new Date();
    private lastDay:Date = new Date();

    private dailyRoutine() {
        if( this.isFirstTimeOfDay() ) {
            this.lastDay = new Date();
        }
    }

    private isFirstTimeOfDay():boolean {
        return false;
    }
}

const nodeManager = new NodeManager(workerData.interval, workerData.host, workerData.port, workerData.loggerPort)
nodeManager.run()