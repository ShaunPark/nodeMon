import ConfigManager from "../config/ConfigManager";
import AWSReboot from "./AWSReboot";
import SSHReboot from "./SSHReboot";


export class Rebooter {
    constructor(private configManager:ConfigManager){}
    
    public run(ipAddress: string) {
        const config = this.configManager.config

        if (config.useSSH !== undefined && config.useSSH === false) {
            const aws: AWSReboot = new AWSReboot(this.configManager)
            aws.run([ipAddress])
        } else {
            const ssh: SSHReboot = new SSHReboot(this.configManager)
            ssh.run([ipAddress])
        }
    }
}