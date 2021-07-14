// type NodeEventReasons = "CordonFailed" | "DrainScheduled" | "DrainSchedulingFailed" | "DrainSucceeded" | "DrainFailed"
// const startTime: Date = new Date()

// const eventHandlerOfEvent = {
//     // CordonStarting: () => {},
//     // CordonSucceeded: () => {},
//     CordonFailed: reboot,
//     // UncordonStarting: () => {},
//     // UncordonSucceeded: () => {},
//     // UncordonFailed: () => {},
//     DrainScheduled: setTimerForReboot,
//     DrainSchedulingFailed: reboot,
//     // DrainStarting: () => {},
//     DrainSucceeded: reboot,
//     DrainFailed: reboot,
// }

// function reboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
//     // const node = nodes.get(nodeName)

//     // if (node !== undefined) {
//     //     if (node.timer !== undefined) {
//     //         clearTimeout(node.timer)
//     //     }
//     //     try {
//     //         const rebooter: Rebooter = new Rebooter(configManager)
//     //         rebooter.run(nodeName)
//     //         node.lastRebootedTime = new Date()
//     //     } catch (err) {
//     //         console.error(err)
//     //     }
//     // }
// }

// function setTimerForReboot(nodeName: string, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) {
//     const timeout = 100 * 1000;
//     const node = nodes.get(nodeName)

//     const timer = setTimeout(() => {
//         if (node !== undefined) {
//             node.timer = undefined
//         }
//         reboot(nodeName, nodes, configManager)
//     }, timeout)

//     if (node !== undefined) {
//         node.timer = timer
//     }
// }

// export const eventHandlers = {
//     NodeCondition: (event: any, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
//         const nodeName = event.nodeName;
//         const nodeCondition = event as NodeConditionEvent
//         const node = nodes.get(nodeCondition.nodeName)
//         logger.info(`receive node condition : ${nodeName}`)

//         const status = nodeCondition.status + (nodeCondition.nodeUnscheduleable ? "/Unschedulable" : "")

//         if (node) {
//             nodeCondition.conditions.filter((condition) => {
//                 const tempCondition = node.conditions.get(condition.type)
//                 if (tempCondition && equal(tempCondition, condition)) {
//                     return false;
//                 }
//                 return true;
//             }).map(condition => node.conditions.set(condition.type, condition))
//             node.ipAddress = nodeCondition.nodeIp
//             node.lastUpdateTime = new Date()
//             node.status = status
//         } else {
//             const newMap = new Map<string, NodeCondition>();
//             const node: NodeConditionCache = { ipAddress: nodeCondition.nodeIp, conditions: newMap, lastUpdateTime: new Date(), status: status };
//             nodeCondition.conditions.map(condition => newMap.set(condition.type, condition))
//             nodes.set(nodeName, node)
//         }
//     },
//     NodeEvent: (event: any, nodes: Map<string, NodeConditionCache>, configManager: ConfigManager) => {
//         const nodeName = event.nodeName;
//         logger.info(`receive events : ${nodeName}`)
//         const node = nodes.get(nodeName)
//         if (node == undefined) {
//             logger.info(`Node ${nodeName} does not exist in list. Ignore`)
//         } else {
//             // 모니터 시작전 발생한 old 이벤트는 무시
//             const eventDate = Date.parse(event.lastTimestamp)
//             const raisedTime = new Date(eventDate)

//             if (startTime.getTime() < eventDate) {
//                 node.status = event.reason;
//                 node.lastUpdateTime = raisedTime

//                 eventHandlerOfEvent[event.reason as NodeEventReasons](nodeName, nodes, configManager)
//             } else {
//                 logger.info(`Event raised at ${raisedTime}. Ignore old event.${startTime}`)
//             }
//         }
//     },
//     PrintNode: (nodes: Map<string, NodeConditionCache>) => {
//         const arr = new Array<Object>()
//         nodes.forEach((node, key) => {
//             arr.push({ name: key, ipAddress: node.ipAddress, lastUpdateTime: node.lastUpdateTime, status: node.status })
//         })
//         console.table(arr);
//     },
//     DeleteNode: (event: any, nodes: Map<string, NodeConditionCache>) => {
//         logger.info(`Node '${event.nodeName} removed from moritoring list. delete it.`)
//         nodes.delete(event.nodeName)
//     },
//     CleanNode: (nodes: Map<string, NodeConditionCache>) => {

//         // 1분동안 node update정보가 없으면 관리목록에서 제거 
//         const now = Date.now()
//         nodes.forEach((node, key) => {
//             const diffMs = node.lastUpdateTime.getTime() - now; // milliseconds between now & Christmas
//             const diffMin = diffMs / 60000; // hours

//             if (diffMin > 1) {
//                 nodes.delete(key)
//             }
//         })
//     }
// }