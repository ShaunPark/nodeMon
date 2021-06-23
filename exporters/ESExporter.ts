
import { Client } from "@elastic/elasticsearch";
import { MessagePort } from "worker_threads"
import { IEvent } from "../types/Type";
const { workerData, parentPort } = require('worker_threads');

class ESExporter {

    constructor(private interval:number, private host:string, private port:number) {
        parentPort.addEventListener("message", this.messageHandler)
    }

    private messageHandler = (event:MessageEvent) => {
        if( event.data.port ) {
            const ePort:MessagePort = event.data.port;
            ePort.addListener("message", this.log);
            // ePort.addListener(Symbol.for("event"), this.event);
        }
    }

    private log = (event:MessageEvent) => {
        console.log(event)
        if( event instanceof Object && Object.prototype.hasOwnProperty.call(event, "type")) {
            console.log(`log in es exporter : ${event}`);
        } else {
            console.log(`event in es exporter : ${event}`);
        }
    }

    private event = (event:MessageEvent) => {
        console.log(`event in es exporter : ${event.data}`);
    }

    private sendLog() {
        
    }
}

const esExporter = new ESExporter(workerData.interval, workerData.host, workerData.port)
// esExporter.run();