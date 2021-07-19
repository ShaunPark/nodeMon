import * as chai from 'chai'
import assert from 'assert'
import NodeManager, { NodeConditionCache, NodeConditionEvent} from '../managers/NodeManager';
import ConfigManager from '../config/ConfigManager';
import { NodeCondition } from '../types/Type';

const should = chai.should;


const getList = ():{nodeName:string, memory:string}[] => {
    const arr = [
        {nodeName:"ip-10-0-0-1", memory:"500Mi"},
        // {nodeName:"ip-10-0-0-2", memory:"500Mi"},
        // {nodeName:"ip-10-0-0-3", memory:"500Mi"},
        // {nodeName:"ip-10-0-0-4", memory:"500Mi"},
        // {nodeName:"ip-10-0-0-5", memory:"0.3Gi"},
        // {nodeName:"ip-10-0-0-6", memory:"5000Mi"},
        {nodeName:"ip-10-0-0-7", memory:"12800000"},
        {nodeName:"ip-10-0-0-8", memory:"1G"},
    ]
    return  arr
}

describe('NodeManager', () => {

    NodeManager.setNode({
        lastRebootedTime: new Date("2021-07-18"),
        status: "Ready",
        lastUpdateTime: new Date(),
        ipAddress: "10.0.0.1",
        conditions: new Map<string,NodeCondition>(),
        nodeName: "ip-10-0-0-1",
        UUID: "node.UUID"
    })

    // NodeManager.setNode({
    //     lastRebootedTime: new Date("2021-07-11"),
    //     status: "Ready",
    //     lastUpdateTime: new Date(),
    //     ipAddress: "10.0.0.2",
    //     conditions: new Map<string,NodeCondition>(),
    //     nodeName: "ip-10-0-0-2",
    //     UUID: "node.UUID"
    // })

    // NodeManager.setNode({
    //     lastRebootedTime: new Date("2021-07-18"),
    //     status: "Ready",
    //     lastUpdateTime: new Date(),
    //     ipAddress: "10.0.0.3",
    //     conditions: new Map<string,NodeCondition>(),
    //     nodeName: "ip-10-0-0-3",
    //     UUID: "node.UUID"
    // })

    // NodeManager.setNode({
    //     lastRebootedTime: new Date("2021-07-18"),
    //     status: "Ready",
    //     lastUpdateTime: new Date(),
    //     ipAddress: "10.0.0.4",
    //     conditions: new Map<string,NodeCondition>(),
    //     nodeName: "ip-10-0-0-4",
    //     UUID: "node.UUID"
    // })

    // NodeManager.setNode({
    //     lastRebootedTime: new Date("2021-07-18"),
    //     status: "Ready",
    //     lastUpdateTime: new Date(),
    //     ipAddress: "10.0.0.5",
    //     conditions: new Map<string,NodeCondition>(),
    //     nodeName: "ip-10-0-0-5",
    //     UUID: "node.UUID"
    // })

    // NodeManager.setNode({
    //     lastRebootedTime: new Date("2021-07-18"),
    //     status: "Ready",
    //     lastUpdateTime: new Date(),
    //     ipAddress: "10.0.0.6",
    //     conditions: new Map<string,NodeCondition>(),
    //     nodeName: "ip-10-0-0-6",
    //     UUID: "node.UUID"
    // })

    // NodeManager.setNode({
    //     lastRebootedTime: new Date("2021-07-18"),
    //     status: "Ready",
    //     lastUpdateTime: new Date(),
    //     ipAddress: "10.0.0.7",
    //     conditions: new Map<string,NodeCondition>(),
    //     nodeName: "ip-10-0-0-7",
    //     UUID: "node.UUID"
    // })

    NodeManager.setNode({
        lastRebootedTime: new Date("2021-07-18"),
        status: "Ready",
        lastUpdateTime: new Date(),
        ipAddress: "10.0.0.8",
        conditions: new Map<string,NodeCondition>(),
        nodeName: "ip-10-0-0-8",
        UUID: "node.UUID"
    })

    NodeManager.setNode({
        lastRebootedTime: new Date("2021-07-18"),
        status: "Ready",
        lastUpdateTime: new Date(),
        ipAddress: "10.0.0.3",
        conditions: new Map<string,NodeCondition>(),
        nodeName: "ip-10-0-0-3",
        UUID: "node.UUID"
    })

    const mgr = new NodeManager("./test/config.yaml", true)


    it('node test', () => {
        console.log(JSON.stringify(mgr.findRebootNodes(new Date(), getList ))) 
        assert.ok(true)
    });

    // const configManager = new ConfigManager("./test/config.yaml");

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

    // // it('save events', () => {
    // //     eventHandlers.NodeCondition(event1, nodes, configManager);
    // //     assert.notDeepStrictEqual(nodes.get("ip-10-0-0-11"), event1)
    // // });

    // // it('update events', () => {
    // //     eventHandlers.NodeCondition(event2, nodes, configManager);
    // //     const condition = nodes.get("ip-10-0-0-11")?.conditions.get("KernelDeadlock")
    // //     assert.strictEqual(condition?.status, "True")
    // //     assert.strictEqual(condition.lastHeartbeatTime, nowDt)
    // // });

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

    // // it('add condition', () => {
    // //     eventHandlers.NodeCondition(event3, nodes, configManager);
    // //     const condition = nodes.get("ip-10-0-0-11")?.conditions
    // //     assert.strictEqual(condition?.size, 2)
    // // })

    // const event4: NodeConditionEvent =
    // {
    //     "kind": "NodeCondition",
    //     "nodeName": "ip-10-0-0-12",
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

    // // it('add new Node', () => {
    // //     eventHandlers.NodeCondition(event4, nodes, configManager);
    // //     assert.strictEqual(nodes?.size, 2)
    // // })


    // // it('check label in node ', () => {
    // //     const inform = new K8SNodeInformer()
    // //     const labels = {
    // //         "beta.kubernetes.io/arch": "amd64",
    // //         "beta.kubernetes.io/os": "linux",
    // //         "draino-enabled": "true",
    // //         "kubernetes.io/arch": "amd64",
    // //         "kubernetes.io/hostname": "ip-10-0-0-11",
    // //         "kubernetes.io/os": "linux"
    // //     }
    // //     assert.strictEqual(inform.checkValid(labels), true)
    // //     assert.strictEqual(inform.checkValid(labels), true)
    // //     assert.strictEqual(inform.checkValid(labels), false)
    // //     assert.strictEqual(inform.checkValid(labels), true)
    // //     assert.strictEqual(inform.checkValid(labels), false)


    // })
});

// // const node1:V1Node = {
//     "kind": "Node",
//     "apiVersion": "v1",
//     "metadata": {
//         "name": "ip-10-0-0-11",
//         "uid": "e60c78b9-a070-4b18-9cbb-2596d9fcfb14",
//         "resourceVersion": "436050",
//         "creationTimestamp": new Date("2021-06-30T07:25:51Z"),
//         "labels": {
//             "beta.kubernetes.io/arch": "amd64",
//             "beta.kubernetes.io/os": "linux",
//             "draino-enabled": "true",
//             "kubernetes.io/arch": "amd64",
//             "kubernetes.io/hostname": "ip-10-0-0-11",
//             "kubernetes.io/os": "linux"
//         },
//         "annotations": {
//             "kubeadm.alpha.kubernetes.io/cri-socket": "/var/run/dockershim.sock",
//             "node.alpha.kubernetes.io/ttl": "0",
//             "volumes.kubernetes.io/controller-managed-attach-detach": "true"
//         },
//         "managedFields": [
//             {
//                 "manager": "kubeadm",
//                 "operation": "Update",
//                 "apiVersion": "v1",
//                 "time":  new Date("2021-06-30T07:25:51Z"),
//                 "fieldsType": "FieldsV1",
//                 "fieldsV1": {
//                     "f:metadata": {
//                         "f:annotations": {
//                             "f:kubeadm.alpha.kubernetes.io/cri-socket": {}
//                         }
//                     }
//                 }
//             },
//             {
//                 "manager": "kube-utils",
//                 "operation": "Update",
//                 "apiVersion": "v1",
//                 "time":  new Date("2021-06-30T07:25:51Z"),
//                 "fieldsType": "FieldsV1",
//                 "fieldsV1": {
//                     "f:status": {
//                         "f:conditions": {
//                             "k:{\"type\":\"NetworkUnavailable\"}": {
//                                 ".": {},
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {},
//                                 "f:type": {}
//                             }
//                         }
//                     }
//                 }
//             },
//             {
//                 "manager": "kubectl-label",
//                 "operation": "Update",
//                 "apiVersion": "v1",
//                 "time":  new Date("2021-06-30T07:25:51Z"),
//                 "fieldsType": "FieldsV1",
//                 "fieldsV1": {
//                     "f:metadata": {
//                         "f:labels": {
//                             "f:draino-enabled": {}
//                         }
//                     }
//                 }
//             },
//             {
//                 "manager": "kubelet",
//                 "operation": "Update",
//                 "apiVersion": "v1",
//                 "time":  new Date("2021-06-30T07:25:51Z"),
//                 "fieldsType": "FieldsV1",
//                 "fieldsV1": {
//                     "f:metadata": {
//                         "f:annotations": {
//                             ".": {},
//                             "f:volumes.kubernetes.io/controller-managed-attach-detach": {}
//                         },
//                         "f:labels": {
//                             ".": {},
//                             "f:beta.kubernetes.io/arch": {},
//                             "f:beta.kubernetes.io/os": {},
//                             "f:kubernetes.io/arch": {},
//                             "f:kubernetes.io/hostname": {},
//                             "f:kubernetes.io/os": {}
//                         }
//                     },
//                     "f:status": {
//                         "f:allocatable": {
//                             "f:ephemeral-storage": {},
//                             "f:memory": {}
//                         },
//                         "f:capacity": {
//                             "f:ephemeral-storage": {},
//                             "f:memory": {}
//                         },
//                         "f:conditions": {
//                             "k:{\"type\":\"DiskPressure\"}": {
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {}
//                             },
//                             "k:{\"type\":\"MemoryPressure\"}": {
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {}
//                             },
//                             "k:{\"type\":\"PIDPressure\"}": {
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {}
//                             },
//                             "k:{\"type\":\"Ready\"}": {
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {}
//                             }
//                         },
//                         "f:images": {},
//                         "f:nodeInfo": {
//                             "f:bootID": {}
//                         }
//                     }
//                 }
//             },
//             {
//                 "manager": "node-problem-detector",
//                 "operation": "Update",
//                 "apiVersion": "v1",
//                 "time":  new Date("2021-06-30T07:25:51Z"),
//                 "fieldsType": "FieldsV1",
//                 "fieldsV1": {
//                     "f:status": {
//                         "f:conditions": {
//                             "k:{\"type\":\"CorruptDockerOverlay2\"}": {
//                                 ".": {},
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {},
//                                 "f:type": {}
//                             },
//                             "k:{\"type\":\"KernelDeadlock\"}": {
//                                 ".": {},
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {},
//                                 "f:type": {}
//                             },
//                             "k:{\"type\":\"ReadonlyFilesystem\"}": {
//                                 ".": {},
//                                 "f:lastHeartbeatTime": {},
//                                 "f:lastTransitionTime": {},
//                                 "f:message": {},
//                                 "f:reason": {},
//                                 "f:status": {},
//                                 "f:type": {}
//                             }
//                         }
//                     }
//                 }
//             },
//             {
//                 "manager": "kube-controller-manager",
//                 "operation": "Update",
//                 "apiVersion": "v1",
//                 "time":  new Date("2021-06-30T07:25:51Z"),
//                 "fieldsType": "FieldsV1",
//                 "fieldsV1": {
//                     "f:metadata": {
//                         "f:annotations": {
//                             "f:node.alpha.kubernetes.io/ttl": {}
//                         }
//                     }
//                 }
//             }
//         ]
//     },
//     "spec": {},
//     "status": {
//         "capacity": {
//             "cpu": "2",
//             "ephemeral-storage": "16197480Ki",
//             "hugepages-2Mi": "0",
//             "memory": "4027256Ki",
//             "pods": "110"
//         },
//         "allocatable": {
//             "cpu": "2",
//             "ephemeral-storage": "14927597544",
//             "hugepages-2Mi": "0",
//             "memory": "3924856Ki",
//             "pods": "110"
//         },
//         "conditions": [
//             {
//                 "type": "ReadonlyFilesystem",
//                 "status": "False",
//                 "lastHeartbeatTime":  new Date("2021-06-30T07:25:51Z"),
//                 "lastTransitionTime":  new Date("2021-06-30T07:25:51Z"),
//                 "reason": "FilesystemIsNotReadOnly",
//                 "message": "Filesystem is not read-only"
//             },
//             {
//                 "type": "CorruptDockerOverlay2",
//                 "status": "False",
//                 "lastHeartbeatTime":  new Date("2021-06-30T07:25:51Z"),
//                 "lastTransitionTime":  new Date("2021-06-30T07:25:51Z"),
//                 "reason": "NoCorruptDockerOverlay2",
//                 "message": "docker overlay2 is functioning properly"
//             },
//             {
//                 "type": "KernelDeadlock",
//                 "status": "False",
//                 "lastHeartbeatTime":  new Date("2021-06-30T07:25:51Z"),
//                 "lastTransitionTime":  new Date("2021-06-30T07:25:51Z"),
//                 "reason": "KernelHasNoDeadlock",
//                 "message": "kernel has no deadlock"
//             },
//             {
//                 "type": "NetworkUnavailable",
//                 "status": "False",
//                 "lastHeartbeatTime": "2021-07-06T04:38:06Z",
//                 "lastTransitionTime": "2021-07-06T04:38:06Z",
//                 "reason": "WeaveIsUp",
//                 "message": "Weave pod has set this"
//             },
//             {
//                 "type": "MemoryPressure",
//                 "status": "False",
//                 "lastHeartbeatTime": "2021-07-07T05:00:57Z",
//                 "lastTransitionTime": "2021-07-05T07:56:31Z",
//                 "reason": "KubeletHasSufficientMemory",
//                 "message": "kubelet has sufficient memory available"
//             },
//             {
//                 "type": "DiskPressure",
//                 "status": "False",
//                 "lastHeartbeatTime": "2021-07-07T05:00:57Z",
//                 "lastTransitionTime": "2021-07-05T07:56:31Z",
//                 "reason": "KubeletHasNoDiskPressure",
//                 "message": "kubelet has no disk pressure"
//             },
//             {
//                 "type": "PIDPressure",
//                 "status": "False",
//                 "lastHeartbeatTime": "2021-07-07T05:00:57Z",
//                 "lastTransitionTime": "2021-07-05T07:56:31Z",
//                 "reason": "KubeletHasSufficientPID",
//                 "message": "kubelet has sufficient PID available"
//             },
//             {
//                 "type": "Ready",
//                 "status": "True",
//                 "lastHeartbeatTime": "2021-07-07T05:00:57Z",
//                 "lastTransitionTime": "2021-07-05T07:56:31Z",
//                 "reason": "KubeletReady",
//                 "message": "kubelet is posting ready status. AppArmor enabled"
//             }
//         ],
//         "addresses": [
//             {
//                 "type": "InternalIP",
//                 "address": "10.0.0.11"
//             },
//             {
//                 "type": "Hostname",
//                 "address": "ip-10-0-0-11"
//             }
//         ],
//         "daemonEndpoints": {
//             "kubeletEndpoint": {
//                 "Port": 10250
//             }
//         },
//         "nodeInfo": {
//             "machineID": "4590515272fb465aa380f65a8c329e75",
//             "systemUUID": "ec24fa10-2c20-e213-4634-d8f976b3496f",
//             "bootID": "7ecfbcff-a2e6-42cf-8ff4-103348868f4c",
//             "kernelVersion": "5.8.0-1038-aws",
//             "osImage": "Ubuntu 20.04.2 LTS",
//             "containerRuntimeVersion": "docker://20.10.7",
//             "kubeletVersion": "v1.21.2",
//             "kubeProxyVersion": "v1.21.2",
//             "operatingSystem": "linux",
//             "architecture": "amd64"
//         },
//         "images": [
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:b246870a903c4d4162172819833995f44889fbd33f864d93c621c1efd2e045ce",
//                     "coolage/node-mon:latest"
//                 ],
//                 "sizeBytes": 436614231
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:e7b2d58f3c16a17de8a3b4773242b934bc3a82e9a74ef348bfcc530752a13a5d"
//                 ],
//                 "sizeBytes": 436611623
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:762a165ffc671a934094b85f082dba7f15af3ca74fcec2b70593707a64610860"
//                 ],
//                 "sizeBytes": 381456676
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:c00f408ec5b5b54a0b93c2d8d67400357da8b622836ad166b151bef4af5227b7"
//                 ],
//                 "sizeBytes": 381440299
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:a346c969ef3ad036337ee8e9e2a1f1e834e699764646d6193a69ec6be4090d0b"
//                 ],
//                 "sizeBytes": 381437201
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:e4884c6ad7909bf5626fd5270d187fe9a9a7838d6012a100e1ff6edf276d1e9a"
//                 ],
//                 "sizeBytes": 381434392
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:0ac76078590f1a613ff69eb2b61cda1ac9c05c928af56bb5511dda956ae62131"
//                 ],
//                 "sizeBytes": 381431576
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:f9cf2107a9b78644e8cecad414d264e24451bc348ffd0a261a623167d81d8c74"
//                 ],
//                 "sizeBytes": 381428237
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:1ff18aef71fd40ca3c0351e64cf86ae3768e551b4cd82f8e34609cfb81efe067"
//                 ],
//                 "sizeBytes": 381422158
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:f060a85b585624e6e75b9bffa60425b89bf0f80ac2df1402cb5dedf5ffef98b4"
//                 ],
//                 "sizeBytes": 381412387
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:5b0f78c3247beeee0e2ee7ce89c2bd61eb7b1a239b48870d7c6224994f5c2a00"
//                 ],
//                 "sizeBytes": 381409106
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:f74fab0f066d2f61aee68946a6bc9c327c5ccebdc40b697e66ab27dead484aef"
//                 ],
//                 "sizeBytes": 381406755
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:6f81b7c9f9c090c0548c64eb154e727fa047e6adf0a4a8184af598f05a7033ce"
//                 ],
//                 "sizeBytes": 367709586
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:0fc87fb469bf8b0abc548084fb210e69b34b56a848bd2158a1414d1037eba156"
//                 ],
//                 "sizeBytes": 367705432
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:3edcee7f1b428ee56787397b63b74e34e0869ab688186526140785d1fabee3a4"
//                 ],
//                 "sizeBytes": 367698714
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:29eb23c97fb636bcd71c945244493208a1cfb9d13ce1fa49d5c384450f8ebf78"
//                 ],
//                 "sizeBytes": 367696482
//             },
//             {
//                 "names": [
//                     "coolage/node-mon@sha256:da23299588ef000fee174f687aae8931d83481f75db632998df0e3af169669e8"
//                 ],
//                 "sizeBytes": 367692121
//             },
//             {
//                 "names": [
//                     "k8s.gcr.io/kube-proxy@sha256:3ee783402715225d6bc483b3a2f8ea11adcb997d00fb5ca2f74734023ade0561",
//                     "k8s.gcr.io/kube-proxy:v1.21.2"
//                 ],
//                 "sizeBytes": 130869239
//             },
//             {
//                 "names": [
//                     "k8s.gcr.io/node-problem-detector/node-problem-detector@sha256:072be07890487b187ddf181f9418b4ff92979b70e5acf5a98e39b7dfbfc0ee08",
//                     "k8s.gcr.io/node-problem-detector/node-problem-detector:v0.8.8"
//                 ],
//                 "sizeBytes": 119307664
//             },
//             {
//                 "names": [
//                     "weaveworks/weave-kube@sha256:d797338e7beb17222e10757b71400d8471bdbd9be13b5da38ce2ebf597fb4e63",
//                     "weaveworks/weave-kube:2.8.1"
//                 ],
//                 "sizeBytes": 89037656
//             },
//             {
//                 "names": [
//                     "gcr.io/kubernetes-e2e-test-images/dnsutils@sha256:b31bcf7ef4420ce7108e7fc10b6c00343b21257c945eec94c21598e72a8f2de0",
//                     "gcr.io/kubernetes-e2e-test-images/dnsutils:1.3"
//                 ],
//                 "sizeBytes": 64623474
//             },
//             {
//                 "names": [
//                     "planetlabs/draino@sha256:2677c0ca5b1dc4713422f47ef6e48f88ab089890e0ae431f3372b3c6a4812059",
//                     "planetlabs/draino:latest"
//                 ],
//                 "sizeBytes": 44413996
//             },
//             {
//                 "names": [
//                     "planetlabs/draino@sha256:b3b22d6972cba9f255c575b618a92ba0547f825b203fff4fee8b228e2b0a7e2e",
//                     "planetlabs/draino:5e07e93"
//                 ],
//                 "sizeBytes": 44215776
//             },
//             {
//                 "names": [
//                     "weaveworks/weave-npc@sha256:38d3e30a97a2260558f8deb0fc4c079442f7347f27c86660dbfc8ca91674f14c",
//                     "weaveworks/weave-npc:2.8.1"
//                 ],
//                 "sizeBytes": 39273789
//             },
//             {
//                 "names": [
//                     "k8s.gcr.io/pause@sha256:6c3835cab3980f11b83277305d0d736051c32b17606f5ec59f1dda67c9ba3810",
//                     "k8s.gcr.io/pause:3.4.1"
//                 ],
//                 "sizeBytes": 682696
//             },
//             {
//                 "names": [
//                     "hello-world@sha256:9f6ad537c5132bcce57f7a0a20e317228d382c3cd61edae14650eec68b2b345c",
//                     "hello-world:latest"
//                 ],
//                 "sizeBytes": 13336
//             }
//         ]
//     }
// }