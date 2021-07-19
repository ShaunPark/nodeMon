import { readFileSync } from 'fs';
import { Client } from 'ssh2';
import ConfigManager from '../config/ConfigManager';
import Log from '../logger/Logger'

class SSHReboot {

    constructor(private configManager: ConfigManager) { }

    public run(ipAddress: string) {
        this.reboot(ipAddress)
    }

    private reboot(ipAddress: string) {
        try {
            const sshFile = this.configManager.config.nodeManager?.sshPemFile;
            const conn = new Client();

            if (sshFile) {
                conn.on('ready', () => {
                    Log.debug('Client :: ready');
                    conn.exec('sudo shutdown -r now', (err: any, stream: any) => {
                        if (err) throw err;

                        stream.on('close', (code: any, signal: any) => {
                            Log.debug('Stream :: close :: code: ' + code + ', signal: ' + signal);
                            conn.end();
                        }).on('data', (data: any) => {
                            Log.debug('STDOUT: ' + data);
                        }).stderr.on('data', (data: any) => {
                            Log.debug('STDERR: ' + data);
                        });
                    });
                })
                    .connect({
                        host: ipAddress,
                        port: 22,
                        username: 'ubuntu',
                        privateKey: readFileSync(sshFile)
                    });
            } else {
                Log.info(`cert file for ssh path is not defined in config file.`)
            }
        } catch (err) {
            console.error(`Fail to reboot ${ipAddress}.`, err)
        }
    }
}

export default SSHReboot;