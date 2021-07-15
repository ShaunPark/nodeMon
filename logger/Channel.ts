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
        Channel.esPort.postMessage({data:{log:log, kind:"log"}});
    }

    public static sendNodeStatusToES(node:NodeConditionCache) {
        Channel.esPort.postMessage({data:{kind:"status", status:node}});
    }

    public static sendEventToNodeManager(event:any) {
        Channel.nmPort.postMessage(event);
    }
}

export default Channel