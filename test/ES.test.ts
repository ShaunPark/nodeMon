import * as chai from 'chai'
import assert from 'assert'
import { ESLogClient, LogType } from '../utils/ESLogClient';
import ConfigManager from '../config/ConfigManager';

const getUUID = () => {
    function s4() {
        return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

describe('ElasticSearch', () => {

    it('save to es', () => {
        const configManager = new ConfigManager("./test/config.yaml");

        const esClient = new ESLogClient(configManager)

        esClient.putLog({nodeName:getUUID(), message:"testMessage"})

        esClient.searchLog({nodeName:"testNode"}).then((value) => {
            console.log(JSON.stringify(value))
        })
        assert.ok(true)
        // eventHandlers.NodeCondition(event1, nodes);
        // assert.notDeepStrictEqual(nodes.get("ip-10-0-0-11"), event1)
    });

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