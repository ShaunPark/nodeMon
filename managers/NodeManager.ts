import { MessagePort } from "worker_threads"
import { Logger } from "../logger/Logger";
import express from "express"
import { NodeCondition, NodeEvent } from "../types/Type";
import equal from 'deep-equal'
const { workerData, parentPort } = require('worker_threads');

interface NodeConditionEvent {
    kind: string,
    nodeName: string,
    conditions: Array<NodeCondition>
}
interface NodeEventsEvent {
    kind: string,
    nodeName: string,
    conditions: Array<NodeEvent>
}
class NodeManager {
    private application : express.Application;
    private nodes = new Map<string, Map<string, NodeCondition>>()

    constructor(private interval:number, private host:string, private port:MessagePort, private loggerPort:MessagePort) {
        parentPort.addEventListener("message", this.initMessageHandler)
        this.application = express();
    }

    private initMessageHandler = (event:MessageEvent) => {
        const ePort:MessagePort = event.data.port;

        if( event.data.type === "parent" ) {
            ePort.addListener("message", this.onEvent);
        } else {
            Logger.initLoggerForNodeManager( ePort );
        }
    }

    private onEvent = (event:any) => {
        console.log(`--- onEvent : ${JSON.stringify(event)}`)

        if(event.kind === "NodeCondition") {
            const nodeCondition = event as NodeConditionEvent
            const conditionMap = this.nodes.get(nodeCondition.nodeName)
            if( conditionMap ) {
                const conditions:Array<NodeCondition> = nodeCondition.conditions;
                // conditions.map( condition => {
                //     const tempCondition = conditionMap.get(condition.type)
                //     if( tempCondition ) {
                //         if( equal(tempCondition, condition)) {
                //         } else {
                //             console.log("value changed !!! ")
                //             conditionMap.set( condition.type, condition);
                //         }
                //     } else {
                //         conditionMap.set( condition.type, condition);
                //     }
                // })

                conditions.filter( (condition) => {
                    const tempCondition = conditionMap.get(condition.type)
                    if( tempCondition ) {
                        if( equal(tempCondition, condition)) {
                            return false;
                        }
                    }
                    return true;
                }).map( condition => conditionMap.set( condition.type, condition))
                
                this.nodes.set(event.nodeName, conditionMap)
            } else {
                const newMap = new Map<string, NodeCondition>();
                const conditions:Array<NodeCondition> = nodeCondition.conditions;
                conditions.map( condition => {
                    newMap.set( condition.type, condition);
                })
                this.nodes.set(event.nodeName, newMap)
            }

        } else if(event.kind === "NodeEvent") {
            const nodeEvent = event as NodeEventsEvent
            console.log(`receive node events : ${nodeEvent.nodeName}`)
        }
    }

    public run() {
        setInterval(this.checkNodeStatus, 10000)

        this.application.get('/', (request, response) => {
            response.send(this.nodes)
        })

        this.application.listen(8880, () => {
            console.log("express started")
        })
    }

    private checkNodeStatus = () => {
        console.log("NodeManager started.")
        // run routine 

        // run daily routine
        Logger.sendEventToES("messsage from nodemanager")
    }

    private dayCheckStartTime:Date = new Date();
    private lastDay:Date = new Date();

    private dailyRoutine() {
        if( this.isFirstTimeOfDay() ) {
            this.lastDay = new Date();
        }
    }

    private isFirstTimeOfDay():boolean {
        return false;
    }
}

const nodeManager = new NodeManager(workerData.interval, workerData.host, workerData.port, workerData.loggerPort)
nodeManager.run()