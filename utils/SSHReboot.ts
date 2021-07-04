import { readFileSync } from 'fs';
import { Client } from 'ssh2';
import ConfigManager from '../config/ConfigManager';
import { IConfig } from '../types/Type';

class SSHReboot {
    
    constructor(private configManager: ConfigManager) {}
    
    public async run(ipAddress: string) {

        const sshFile = this.configManager.config.nodeManager?.sshPemFile;
        const conn = new Client();

        if( sshFile ) {
            conn.on('ready', () => {
                console.log('Client :: ready');
                conn.exec('sudo shutdown -r now', (err:any, stream:any) => {
                    if (err) throw err;
    
                    stream.on('close', (code:any, signal:any) => {
                        console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                        conn.end();
                    }).on('data', (data:any) => {
                        console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data:any) => {
                        console.log('STDERR: ' + data);
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
            console.log(`cert file for ssh path is not defined in config file.`)
        }
    }
}

export default SSHReboot;