const { workerData, parentPort } = require('worker_threads');
 
class ESExporter {

    constructor(private interval:number, private host:string, private port:number) {
        parentPort.addEventListener("message", this.messageHandler)
    }

    // public run() {

    // }

    private messageHandler = (event:MessageEvent) => {
        console.log(`log in es exporter ${event.data.message}`);
    }
}

const esExporter = new ESExporter(workerData.interval, workerData.host, workerData.port)
// esExporter.run();