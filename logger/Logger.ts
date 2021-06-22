import { MessageChannel } from "worker_threads";

export class Logger {
    private static port:MessagePort;

    constructor(private port:MessagePort){
        if( !Logger.port ){
            Logger.port = port;
        }
    }

    public static log(message:string) {
        Logger.port.postMessage("message");
    }
}