import { MessagePort } from "worker_threads";
export class Logger {
    private static esPort:MessagePort;
    private static nmPort:MessagePort;
    
    public static initLogger(esPort:MessagePort, nmPort:MessagePort) {
        Logger.esPort = esPort;
        Logger.nmPort = nmPort;
    }

    public static sendEventToES(event:any) {
        Logger.esPort.postMessage(event);
    }

    public static sendEventToNodeManager(event:any) {
        Logger.nmPort.postMessage(event);
    }
}