import ConfigManager from "../config/ConfigManager";
import AWSReboot from "./AWSReboot";
import SSHReboot from "./SSHReboot";

export default class Rebooter {
    constructor(private configManager:ConfigManager){}
    
    public run(ipAddress: string) {
        const config = this.configManager.config

        if (config.rebootThroughSSH === undefined || config.rebootThroughSSH === true) {
            const ssh: SSHReboot = new SSHReboot(this.configManager)
            ssh.run(ipAddress)
        } else {
            const aws: AWSReboot = new AWSReboot(this.configManager)
            aws.run(ipAddress)
        }
    }
}