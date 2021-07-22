import NodeManager from "./NodeManager"
import Log from '../logger/Logger'

const { workerData } = require('worker_threads');

const nodeManager = new NodeManager(workerData?.config, workerData?.dryRun)
process.on('SIGTERM', function onSigterm() {
    Log.info('Got SIGTERM in NodeManager. Graceful shutdown start')
    nodeManager.close();
})
nodeManager.run()