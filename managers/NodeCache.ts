import equal from 'deep-equal'
import { NodeCondition, NodeEvent } from "../types/Type"
import { NodeStatus } from './NodeManager'

export interface NodeInfo {
    nodeName:string
    nodeIp:string
    nodeUnscheduleable:boolean
}

export interface NodeConditionEvent extends NodeInfo {
    kind: string,
    conditions: Array<NodeCondition>
}

export interface NodeEventsEvent extends NodeInfo {
    kind: string,
    conditions: Array<NodeEvent>
}

export type NodeConditionCache = {
    ipAddress: string
    conditions: Map<string, NodeCondition>
    lastUpdateTime: Date
    status: NodeStatus
}

export const eventHandlers = {
    NodeCondition: (event:any, nodes:Map<string, NodeConditionCache>) => {
        const nodeName = event.nodeName;
        const nodeCondition = event as NodeConditionEvent
        const node = nodes.get(nodeCondition.nodeName)
        console.log(`receive node condition : ${nodeName}`)

        if( node ) {
            nodeCondition.conditions.filter( (condition) => {
                const tempCondition = node.conditions.get(condition.type)
                if( tempCondition && equal(tempCondition, condition)) {
                    return false;
                }
                return true;
            }).map( condition => node.conditions.set( condition.type, condition))
            node.ipAddress = nodeCondition.nodeIp
            node.lastUpdateTime = new Date()
        } else {
            const newMap = new Map<string, NodeCondition>();
            const node:NodeConditionCache = { ipAddress: nodeCondition.nodeIp, conditions:newMap, lastUpdateTime: new Date(), status:"NotReady"};
            nodeCondition.conditions.map( condition => newMap.set( condition.type, condition))
            nodes.set(nodeName, node)
        }
    },
    NodeEvent: (event:any, nodes:Map<string, NodeConditionCache>) => {
        const nodeName = event.nodeName;
        console.log(`receive node events : ${nodeName}`)
        const node = nodes.get(nodeName)
        if (node == undefined) {
            console.log(`Node ${nodeName} does not exist in list. Ignore`)
        } else {
            node.status = event.reason;
            node.lastUpdateTime = event.lastTimestamp
            // reason: obj.reason, 
            // source: obj.source?.component,
            // lastTimestamp: obj.lastTimestamp 
        }
    },
    PrintNode: (nodes:Map<string, NodeConditionCache>) => {
        const arr = new Array<Object>()
        nodes.forEach( (node, key) => {
            arr.push({ name:key, ...node})
        })
        console.table(arr);
    },
    DeleteNode: (event:any, nodes:Map<string, NodeConditionCache>) => {
        nodes.forEach( (node, key) => {
            const today = new Date()
            const diffMs = node.lastUpdateTime.getTime() - today.getTime(); // milliseconds between now & Christmas
            const diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours

            if ( diffHrs > 24 ) {
                nodes.delete(key)
            }
        })
    }
}