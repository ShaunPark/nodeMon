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
            const sshFile = this.configManager.config.nodeManager.sshPemFile;
            const sshUser = this.configManager.config.nodeManager.sshUser;
            const conn = new Client();

            Log.info(`[SSHReboot.reboot]Start reboot '${ipAddress}'. `)

            if (sshFile) {
                conn
                    .on('error', (err) => { Log.error(err) })
                    .on('end', () => { Log.info("[SSHReboot.reboot] Connection ended") })
                    .on('close', () => { Log.info("[SSHReboot.reboot] Connection closed") })
                    .on('ready', () => {
                        Log.info(`[SSHReboot.reboot] '${ipAddress}' connected. SShClient ready.`);
                        try {
                            conn.exec('sudo shutdown -r now', (err: any, stream: any) => {
                                if (err !== undefined) {
                                    Log.error(`[SSHReboot.reboot] ${err}`)
                                }
                                stream.on('close', (code: any, signal: any) => {
                                    conn.end();
                                });
                            });
                        } catch (err) {
                            Log.error(`[SSHReboot.reboot] ${err}-`)
                        }
                    })
                    .connect({
                        host: ipAddress,
                        port: 22,
                        username: sshUser,
                        privateKey: readFileSync(sshFile)
                    });

            } else {
                Log.info(`[SSHReboot.reboot]cert file for ssh path is not defined in config file.`)
            }
        } catch (err) {
            Log.error(`[SSHReboot.reboot]Fail to reboot ${ipAddress}.`, err)
            throw err
        }
    }
}

export default SSHReboot;