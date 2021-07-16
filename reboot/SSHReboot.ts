import { readFileSync } from 'fs';
import { Client } from 'ssh2';
import ConfigManager from '../config/ConfigManager';
import { logger } from '../logger/Logger'

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
                    logger.debug('Client :: ready');
                    conn.exec('sudo shutdown -r now', (err: any, stream: any) => {
                        if (err) throw err;

                        stream.on('close', (code: any, signal: any) => {
                            logger.debug('Stream :: close :: code: ' + code + ', signal: ' + signal);
                            conn.end();
                        }).on('data', (data: any) => {
                            logger.debug('STDOUT: ' + data);
                        }).stderr.on('data', (data: any) => {
                            logger.debug('STDERR: ' + data);
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
                logger.info(`cert file for ssh path is not defined in config file.`)
            }
        } catch (err) {
            console.error(`Fail to reboot ${ipAddress}.`, err)
        }
    }
}

export default SSHReboot;