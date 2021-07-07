import * as chai from 'chai'
import assert from 'assert'
import { NodeConditionCache, NodeConditionEvent } from '../managers/NodeManager';
import { eventHandlers } from '../managers/NodeCache';


const should = chai.should;

describe('NodeManager', () => {
    const nodes: Map<string, NodeConditionCache> = new Map()
    const event1: NodeConditionEvent =
    {
        "kind": "NodeCondition",
        "nodeName": "ip-10-0-0-11",
        "nodeIp": "",
        "conditions": [
            {
                "lastHeartbeatTime": new Date("2021-07-05T00:11:05.000Z"),
                "lastTransitionTime": new Date("2021-07-04T23:36:01.000Z"),
                "message": "kernel has no deadlock",
                "reason": "KernelHasNoDeadlock",
                "status": "False",
                "type": "KernelDeadlock"
            }]
    }

    const nowDt = new Date()
    const event2: NodeConditionEvent =
    {
        "kind": "NodeCondition",
        "nodeName": "ip-10-0-0-11",
        "nodeIp": "",
        "conditions": [
            {
                "lastHeartbeatTime": nowDt,
                "lastTransitionTime": nowDt,
                "message": "kernel has no deadlock",
                "reason": "KernelHasNoDeadlock",
                "status": "True",
                "type": "KernelDeadlock"
            }]
    }

    it('save events', () => {
        eventHandlers.NodeCondition(event1,nodes);
        assert.notDeepStrictEqual(nodes.get("ip-10-0-0-11"), event1)
    });
    
    it('update events', () => {
        eventHandlers.NodeCondition(event2,nodes);
        const condition = nodes.get("ip-10-0-0-11")?.conditions.get("KernelDeadlock")
        assert.strictEqual(condition?.status, "True")
        assert.strictEqual(condition.lastHeartbeatTime, nowDt)
    });

    const event3: NodeConditionEvent =
    {
        "kind": "NodeCondition",
        "nodeName": "ip-10-0-0-11",
        "nodeIp": "",
        "conditions": [
            {
                "lastHeartbeatTime": new Date("2021-07-05T00:11:05.000Z"),
                "lastTransitionTime": new Date("2021-07-04T23:36:01.000Z"),
                "message": "new Event",
                "reason": "NewEvent",
                "status": "False",
                "type": "NewEvent"
            },
            {
                "lastHeartbeatTime": nowDt,
                "lastTransitionTime": nowDt,
                "message": "kernel has no deadlock",
                "reason": "KernelHasNoDeadlock",
                "status": "True",
                "type": "KernelDeadlock"
            }]
    }

    it('add condition', () => {
        eventHandlers.NodeCondition(event3,nodes);
        const condition = nodes.get("ip-10-0-0-11")?.conditions
        assert.strictEqual(condition?.size, 2)
    })

    const event4: NodeConditionEvent =
    {
        "kind": "NodeCondition",
        "nodeName": "ip-10-0-0-12",
        "nodeIp": "",
        "conditions": [
            {
                "lastHeartbeatTime": nowDt,
                "lastTransitionTime": nowDt,
                "message": "kernel has no deadlock",
                "reason": "KernelHasNoDeadlock",
                "status": "True",
                "type": "KernelDeadlock"
            }]
    }

    it('add new Node', () => {
        eventHandlers.NodeCondition(event4,nodes);
        assert.strictEqual(nodes?.size, 2)
    })
});