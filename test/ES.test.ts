import * as chai from 'chai'
import assert from 'assert'
import { ESLogClient } from '../utils/ESLogClient';
import ConfigManager from '../config/ConfigManager';
import { logger } from '../logger/Logger'

const getUUID = () => {
    function s4() {
        return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
    }
    return s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4();
}
const NodeEventReasons = ["CordonFailed", "DrainScheduled", "DrainSchedulingFailed", "DrainSucceeded", "DrainFailed"]
const expect = chai.expect

describe('ElasticSearch', () => {

    const configManager = new ConfigManager("./test/config.yaml");
    const esClient = new ESLogClient(configManager)
    const uuid = getUUID()
    const message = `message ${uuid}`

    // it('save to es', async function (done) {

    //     logger.info('test message')

    //     esClient.putLog({ nodeName: uuid, message: message })
    //     assert.ok(true)
    //     done()
    // });

    // it('load from es', (done) => {
    //     const prom = new Promise<any[]>((resolve, reject) => {
    //         setTimeout(async () => {
    //             resolve(await esClient.searchLog({ nodeName: uuid }) as any[])
    //         }, 1000)
    //     })

    //     prom.then(function (result) {
    //         assert.strictEqual(result[0].message, message)
    //         done()
    //     })
    // })

    // it('typetest a', () => {
    //     const a: any = "CordonStatring"
    //     const reason = a as NodeEventReasons
    //     console.log(typeof reason)
    //     console.log(reason)
    //     assert.notStrictEqual(reason, undefined)
    // })


    // it('typetest b', () => {
    //     const a: any = "DrainScheduled"
    //     const reason = a as NodeEventReasons
    //     console.log(typeof reason)
    //     console.log(reason)

    //     assert.ok(reason !== undefined)
    // })
    // const nodes: Map<string, NodeConditionCache> = new Map()
    // const event1: NodeConditionEvent =
    // {
    //     "kind": "NodeCondition",
    //     "nodeName": "ip-10-0-0-11",
    //     "nodeIp": "",
    //     "conditions": [
    //         {
    //             "lastHeartbeatTime": new Date("2021-07-05T00:11:05.000Z"),
    //             "lastTransitionTime": new Date("2021-07-04T23:36:01.000Z"),
    //             "message": "kernel has no deadlock",
    //             "reason": "KernelHasNoDeadlock",
    //             "status": "False",
    //             "type": "KernelDeadlock"
    //         }],
    //     "nodeUnscheduleable": true,
    //     status: "Ready"
    // }

    // const nowDt = new Date()
    // const event2: NodeConditionEvent =
    // {
    //     "kind": "NodeCondition",
    //     "nodeName": "ip-10-0-0-11",
    //     "nodeIp": "",
    //     "conditions": [
    //         {
    //             "lastHeartbeatTime": nowDt,
    //             "lastTransitionTime": nowDt,
    //             "message": "kernel has no deadlock",
    //             "reason": "KernelHasNoDeadlock",
    //             "status": "True",
    //             "type": "KernelDeadlock"
    //         }],
    //     "nodeUnscheduleable": true,
    //     status: "Ready"
    // }

    // it('save events', () => {
    //     eventHandlers.NodeCondition(event1, nodes);
    //     assert.notDeepStrictEqual(nodes.get("ip-10-0-0-11"), event1)
    // });

    // it('update events', () => {
    //     eventHandlers.NodeCondition(event2, nodes);
    //     const condition = nodes.get("ip-10-0-0-11")?.conditions.get("KernelDeadlock")
    //     assert.strictEqual(condition?.status, "True")
    //     assert.strictEqual(condition.lastHeartbeatTime, nowDt)
    // });

    // const event3: NodeConditionEvent =
    // {
    //     "kind": "NodeCondition",
    //     "nodeName": "ip-10-0-0-11",
    //     "nodeIp": "",
    //     "conditions": [
    //         {
    //             "lastHeartbeatTime": new Date("2021-07-05T00:11:05.000Z"),
    //             "lastTransitionTime": new Date("2021-07-04T23:36:01.000Z"),
    //             "message": "new Event",
    //             "reason": "NewEvent",
    //             "status": "False",
    //             "type": "NewEvent"
    //         },
    //         {
    //             "lastHeartbeatTime": nowDt,
    //             "lastTransitionTime": nowDt,
    //             "message": "kernel has no deadlock",
    //             "reason": "KernelHasNoDeadlock",
    //             "status": "True",
    //             "type": "KernelDeadlock"
    //         }],
    //     "nodeUnscheduleable": true,
    //     status: "Ready"
    // }

})