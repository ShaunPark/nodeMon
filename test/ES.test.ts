import * as chai from 'chai'
import assert from 'assert'
import { ESStatusClient } from '../utils/ESStatusClient';
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
    const esClient = new ESStatusClient(configManager)
    const uuid = getUUID()
    const message = `message ${uuid}`

    // it('save to es', async function () {

    //     logger.info('test message')

    //     try {esClient.putStatus({
    //         status: "False",
    //         lastUpdateTime: new Date(),
    //         lastRebootedTime: new Date(),
    //         ipAddress: "ip",
    //         conditions: new Map(),
    //         timer: undefined,
    //         nodeName: "test"
    //     })} catch(err) {
    //         logger.error(err)
    //     }
        
    // });

    it('update from es', () => {
        setTimeout(() => {
            try {esClient.updateStatus({
                status: "True",
                lastUpdateTime: new Date(),
                lastRebootedTime: new Date(),
                ipAddress: "ipaddress",
                conditions: new Map(),
                timer: undefined,
                nodeName: "test"
            })} catch(err) {
                logger.error(err)
            }
        }, 1000)
    })

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