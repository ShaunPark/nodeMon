import { MessagePort } from "worker_threads";
import { ESLog } from "../exporters/ESExporter";
import { NodeConditionCache } from "../managers/NodeManager";
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

    public static sendMessageEventToES(log: ESLog) {
        Channel.esPort.postMessage({ data: { log: log, kind: "log" } });
    }

    public static sendNodeStatusToES(node: NodeConditionCache) {
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

    public static sendEventToNodeManager(event: any) {
        Channel.nmPort.postMessage(event);
    }
}

export default Channel