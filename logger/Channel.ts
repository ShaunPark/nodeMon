import { MessagePort } from "worker_threads";
import { ESLog } from "../exporters/ESExporter";
import { NodeConditionCache } from "../managers/NodeManager";
class Channel {
    private static esPort:MessagePort;
    private static nmPort:MessagePort;

    public static initLogger(esPort:MessagePort, nmPort:MessagePort) {
        Channel.esPort = esPort;
        Channel.nmPort = nmPort;
    }

    public static initLoggerForNodeManager(esPort:MessagePort) {
        Channel.esPort = esPort;
    }

    public static sendMessageEventToES(log:ESLog) {
        const logJSON = JSON.parse(JSON.stringify(log))
        Channel.esPort.postMessage({data:{log:logJSON, kind:"log"}});
    }

    public static sendNodeStatusToES(node:NodeConditionCache) {
        const nodeJson = JSON.parse(JSON.stringify(node))
        Channel.esPort.postMessage({data:{kind:"status", status:nodeJson}});
    }

    public static sendEventToNodeManager(event:any) {
        Channel.nmPort.postMessage(event);
    }
}

export default Channel