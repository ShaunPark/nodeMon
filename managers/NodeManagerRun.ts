import NodeManager from "./NodeManager"
const { workerData } = require('worker_threads');

const nodeManager = new NodeManager(workerData?.config, workerData?.dryRun)
nodeManager.run()