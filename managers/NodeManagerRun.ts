import NodeManager from "./NodeManager"
import Log from '../logger/Logger'
import express, { Express } from 'express'
import { NodeStatus } from "./NodeStatus";

const { workerData } = require('worker_threads');

const nodeManager = new NodeManager(workerData?.config, workerData?.dryRun)
process.on('SIGTERM', function onSigterm() {
    Log.info('[NodeManagerRun.onSigterm] Got SIGTERM in NodeManager. Graceful shutdown start')
    nodeManager.close();
})

const app: Express = express();
const port:number = 8080
app.get("/", (req, res:any) => {
    res.send("hello")
})
app.get("/nodes", (req, res:any) => {
    console.log(`request from ${req.hostname}`)
    const nodes = Array.from(NodeStatus.getAll()).map(([_, node]) => node)
    res.json(nodes)
})
app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`)
})
nodeManager.run()