import * as chai from 'chai'
import assert from 'assert'
import NodeManager, { NodeConditionCache, NodeConditionEvent } from '../managers/NodeManager';
import ConfigManager from '../config/ConfigManager';
import { NodeCondition } from '../types/Type';
import K8SUtil from '../kubernetes/K8SUtil'

// const should = chai.should;


// const getList = (): { nodeName: string, memory: string }[] => {
//     const arr = [
//         { nodeName: "ip-10-0-0-1", memory: "500Mi" },
//         // {nodeName:"ip-10-0-0-2", memory:"500Mi"},
//         // {nodeName:"ip-10-0-0-3", memory:"500Mi"},
//         // {nodeName:"ip-10-0-0-4", memory:"500Mi"},
//         // {nodeName:"ip-10-0-0-5", memory:"0.3Gi"},
//         // {nodeName:"ip-10-0-0-6", memory:"5000Mi"},
//         { nodeName: "ip-10-0-0-7", memory: "12800000" },
//         { nodeName: "ip-10-0-0-8", memory: "1G" },
//     ]
//     return arr
// }

describe('NodeManager', () => {

    it('time test', () => {
        const c = new ConfigManager("./test/config.yaml");

        const k = new K8SUtil(c.config)
        k.getCordonedNodes()
        // mgr.getReloadConfigValues()()

        // const now = new Date()
        // now.setHours(9, 45, 0)
        // assert.strictEqual(mgr.getIscordonTime()(now), false)
        // assert.strictEqual(mgr.getIsRebootTime()(now), false)


        // const now2 = new Date()
        // now2.setHours(9, 25, 0)
        // assert.strictEqual(mgr.getIscordonTime()(now2), false)
        // assert.strictEqual(mgr.getIsRebootTime()(now2), true)

    });
})
