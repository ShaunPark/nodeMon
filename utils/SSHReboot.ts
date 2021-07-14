import { readFileSync } from 'fs';
import { Client } from 'ssh2';
import ConfigManager from '../config/ConfigManager';
import { logger } from '../logger/Logger'

class SSHReboot {

    constructor(private configManager: ConfigManager) { }

    public async run(ipAddress: string[]) {
        ipAddress.forEach(ip => this.reboot(ip))
    }

    private reboot(ipAddress: string) {
        try {
            const sshFile = this.configManager.config.nodeManager?.sshPemFile;
            const conn = new Client();

            if (sshFile) {
                conn.on('ready', () => {
                    logger.info('Client :: ready');
                    conn.exec('sudo shutdown -r now', (err: any, stream: any) => {
                        if (err) throw err;

                        stream.on('close', (code: any, signal: any) => {
                            logger.info('Stream :: close :: code: ' + code + ', signal: ' + signal);
                            conn.end();
                        }).on('data', (data: any) => {
                            logger.info('STDOUT: ' + data);
                        }).stderr.on('data', (data: any) => {
                            logger.info('STDERR: ' + data);
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