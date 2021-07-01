import { MessagePort } from "worker_threads"
import { Logger } from "../logger/Logger";
import express from "express"
import { IConfig, NodeCondition, NodeEvent } from "../types/Type";
import equal from 'deep-equal'
import { AWSReboot } from "../utils/AWSReboot";
import ConfigManager from "../config/ConfigManager";

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

const eventHandlers = {
    NodeCondition: (event:any, nodes:Map<string, Map<string, NodeCondition>>) => {
        const nodeCondition = event as NodeConditionEvent
        const conditionMap = nodes.get(nodeCondition.nodeName)
        
        if( conditionMap ) {
            nodeCondition.conditions.filter( (condition) => {
                const tempCondition = conditionMap.get(condition.type)
                if( tempCondition ) {
                    if( equal(tempCondition, condition)) {
                        return false;
                    }
                }
                return true;
            }).map( condition => conditionMap.set( condition.type, condition))
            
            nodes.set(event.nodeName, conditionMap)
        } else {
            const newMap = new Map<string, NodeCondition>();
            nodeCondition.conditions.map( condition => newMap.set( condition.type, condition))
            nodes.set(event.nodeName, newMap)
        }
    },
    NodeEvent: (event:any, nodes:Map<string, Map<string, NodeCondition>>) => {
        const nodeEvent = event as NodeEventsEvent
        console.log(`receive node events : ${nodeEvent.nodeName}`)
    },
}

type EventTypes = "NodeCondition" | "NodeEvent"

class NodeManager {
    private application : express.Application;
    private nodes = new Map<string, Map<string, NodeCondition>>()
    private configManager:ConfigManager;

    constructor(private configFile:string) {
        parentPort.addEventListener("message", this.initMessageHandler)
        this.application = express();
        this.configManager = new ConfigManager(this.configFile);
    }

    // 스레드간 채널 연결 초기화
    private initMessageHandler = (event:MessageEvent) => {
        const ePort:MessagePort = event.data.port;

        if( event.data.type === "parent" ) {
            ePort.addListener("message", this.onEvent);
        } else {
            Logger.initLoggerForNodeManager( ePort );
        }
    }

    // Kubernetes 모니터에서 전달된 이벤트 처리


    private onEvent = (event:any) => {
        console.log(`--- onEvent : ${JSON.stringify(event)}`)
        //수신한 이벤트를 처리
        eventHandlers[event.kind as EventTypes](event, this.nodes);

        // if(event.kind === "NodeCondition") {
        //     const nodeCondition = event as NodeConditionEvent
        //     const conditionMap = this.nodes.get(nodeCondition.nodeName)
            
        //     if( conditionMap ) {
        //         nodeCondition.conditions.filter( (condition) => {
        //             const tempCondition = conditionMap.get(condition.type)
        //             if( tempCondition ) {
        //                 if( equal(tempCondition, condition)) {
        //                     return false;
        //                 }
        //             }
        //             return true;
        //         }).map( condition => conditionMap.set( condition.type, condition))
                
        //         this.nodes.set(event.nodeName, conditionMap)
        //     } else {
        //         const newMap = new Map<string, NodeCondition>();
        //         nodeCondition.conditions.map( condition => newMap.set( condition.type, condition))
        //         this.nodes.set(event.nodeName, newMap)
        //     }

        // } else if(event.kind === "NodeEvent") {
        //     const nodeEvent = event as NodeEventsEvent
        //     console.log(`receive node events : ${nodeEvent.nodeName}`)
        // }
    }

    public run() {
        const config:IConfig = this.configManager.config;
        
        let interval:number = 10000;
        if( config.nodeManager  && config.nodeManager.interval ) {
            interval = config.nodeManager.interval
        }
        //setInterval(this.checkNodeStatus, interval)

        this.checkNodeStatus();
        
        this.application.get('/', (request, response) => {
            response.send(this.nodes)
        })

        this.application.listen(8880, () => {
            console.log("express started")
        })
    }

    private checkNodeStatus = () => {
        // console.log("Node status !!! ") 
        // this.nodes.forEach( (node, nodeName) => {
        //     console.log(`${nodeName}`)
        //     node.forEach( (condition, type) => {
        //         console.log(`${type} : ${condition.status} : ${condition.reason}`)
        //     })
        // })
        
        // run routine 

        // run daily routine
        const aws:AWSReboot = new AWSReboot(this.configManager)
        aws.run(["10.0.0.13"])
        //aws.run()
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

const nodeManager = new NodeManager(workerData.config)
nodeManager.run()