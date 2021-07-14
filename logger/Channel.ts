import { MessagePort } from "worker_threads";
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

    public static sendMessageEventToES(event:{node?:string|"node-mon", message:string|""}) {
        Channel.esPort.postMessage({data:event});
    }

    public static sendEventToNodeManager(event:any) {
        Channel.nmPort.postMessage(event);
    }
}

export default Channel