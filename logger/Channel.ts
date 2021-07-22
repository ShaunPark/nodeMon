import { MessagePort } from "worker_threads";
import { ESLog } from "../elasticsearch/ESExporter";
import { NodeConditionCache } from "../managers/NodeManager";
import logger from "./Logger";
class Channel {
    private static esPort: MessagePort;
    private static nmPort: MessagePort;

    public static initLogger(esPort: MessagePort, nmPort: MessagePort) {
        Channel.esPort = esPort;
        Channel.nmPort = nmPort;
    }

    public static initLoggerForNodeManager(esPort: MessagePort) {
        Channel.esPort = esPort;
    }

    public static info(nodeName: string, message: string) {
        this.sendMessageEventToES({ logType: "Info", node: nodeName, message: message })
    }

    public static warn(nodeName: string, message: string) {
        this.sendMessageEventToES({ logType: "Warning", node: nodeName, message: message })
    }

    public static error(nodeName: string, message: string) {
        this.sendMessageEventToES({ logType: "Error", node: nodeName, message: message })
    }

    private static sendMessageEventToES(log: ESLog) {
        if (Channel.esPort === undefined) {
            logger.info(`${log.node} : ${log.message}`)
        } else {
            Channel.esPort.postMessage({ data: { log: log, kind: "log" } });
        }
    }

    public static sendNodeStatusToES(node: NodeConditionCache) {
        if (Channel.esPort === undefined) {
            logger.info(`${node.nodeName} : ${JSON.stringify(node)}`)
        } else {
            const nodeJson = {
                ipAddress: node.ipAddress,
                lastUpdateTime: node.lastUpdateTime,
                status: node.status,
                lastRebootedTime: node.lastRebootedTime,
                nodeName: node.nodeName,
                UUID: node.UUID
            }
            Channel.esPort.postMessage({ data: { kind: "status", status: nodeJson } });
        }

    }

    public static sendEventToNodeManager(event: any) {
        Channel.nmPort.postMessage(event);
    }
}

export default Channel