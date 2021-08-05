import { MessagePort } from "worker_threads";
import { ESLog } from "../elasticsearch/ESExporter";
import { ESNodeStatus } from "../elasticsearch/ESStatusClient";
import { BaseEvent, NodeConditionCache, NodeEvent, NodeInfo } from "../types/Type";
import Log from "./Logger";
class Channel {
    private static esPort: MessagePort
    private static nmPort: MessagePort
    private static clusterName: string

    public static initLogger(esPort: MessagePort, nmPort: MessagePort, clusterName: string) {
        Channel.esPort = esPort;
        Channel.nmPort = nmPort;
    }

    public static initLoggerForNodeManager(esPort: MessagePort, clusterName: string) {
        Channel.esPort = esPort;
        this.clusterName = clusterName
    }

    public static info(nodeName: string, message: string) {
        this.sendMessageEventToES({ logType: "Info", node: nodeName, message: message, clusterName: this.clusterName })
    }

    public static warn(nodeName: string, message: string) {
        this.sendMessageEventToES({ logType: "Warning", node: nodeName, message: message, clusterName: this.clusterName })
    }

    public static error(nodeName: string, message: string) {
        this.sendMessageEventToES({ logType: "Error", node: nodeName, message: message, clusterName: this.clusterName })
    }

    private static sendMessageEventToES(log: ESLog) {
        if (Channel.esPort === undefined) {
            Log.error(`${log.node} : ${log.message}`)
        } else {
            Channel.esPort.postMessage({ data: { log: log, kind: "log" } });
        }
    }

    public static sendNodeStatusToES(node: NodeConditionCache) {
        if (Channel.esPort === undefined) {
            Log.error(`${node.nodeName} : ${JSON.stringify(node)}`)
        } else {
            const nodeJson: ESNodeStatus = {
                clusterName: this.clusterName,
                ipAddress: node.ipAddress,
                lastUpdateTime: new Date(node.lastUpdateTime),
                status: node.status,
                lastRebootedTime: new Date(node.lastRebootedTime),
                nodeName: node.nodeName,
                UUID: node.UUID
            }
            Channel.esPort.postMessage({ data: { kind: "status", status: nodeJson } });
        }
    }

    public static sendEventToNodeManager(event: BaseEvent | NodeInfo | NodeEvent) {
        Channel.nmPort.postMessage(event);
    }
}

export default Channel