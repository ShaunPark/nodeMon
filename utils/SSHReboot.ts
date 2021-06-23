import { readFileSync } from 'fs';
import { Client } from 'ssh2';

class SSHReboot {

    public async run() {
        const conn = new Client();

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
          }).connect({
            host: 'ec2-3-34-131-154.ap-northeast-2.compute.amazonaws.com',
            port: 22,
            username: 'ubuntu',
            privateKey: readFileSync('/home/shpark/sangho.lge.test.pem')
          });
    }
}
