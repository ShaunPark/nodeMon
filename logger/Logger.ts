import { MessagePort } from "worker_threads";
export class Logger {
    private static port:MessagePort;
    public static initLogger(port:MessagePort) {
        Logger.port = port;
    }

    public static log(message:string) {
        const dateStr = Date.now().toString();
        console.log(message)
        Logger.port.postMessage(`${dateStr}:${message}`);
    }

    public static event(ev:string) {
        const dateStr = Date.now().toString();
        console.log(ev)
        Logger.port.postMessage({type:'event', message:ev});
    }
}