import { DescribeInstancesCommand, DescribeInstancesCommandInput, EC2Client, Filter, StopInstancesCommand, TerminateInstancesCommand, TerminateInstancesCommandInput } from '@aws-sdk/client-ec2';
import ConfigManager from '../config/ConfigManager';
import IConfig from "../types/ConfigType"
import Log from '../logger/Logger'

const jp = require('jsonpath')
const REGION_AP_2 = 'ap-northeast-2'
const PRIVATE_IP_ADDRESS = 'private-ip-address'
class AWSShutdown {
  private ec2: EC2Client;

  constructor(private configManager: ConfigManager) {
    const config: IConfig = this.configManager.config;
    const region: string | undefined = config.nodeManager.awsRegion;
    try {
      if (region) {
        this.ec2 = new EC2Client({ region: region });
      } else {
        this.ec2 = new EC2Client({ region: REGION_AP_2 });
      }
    } catch (err) {
      Log.error(`[AWSReboot] ${err}`)
      throw err;
    }
  }

  private checkIfValidIP(str:string) {
    // Regular expression to check if string is a IP address
    const regexExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
  
    return regexExp.test(str);
  }

  public async run(ipAddress: string) {

    Log.info(`[AWSReboot.run] Reboot for nodes( ${JSON.stringify(ipAddress)}) started`)

    const vpc = this.configManager?.config.nodeManager.awsVPC;
    const filters: Array<Filter> = new Array<Filter>()

    let jsonPath = `$.Reservations[*].Instances[?(@.PrivateIpAddress  == "${ipAddress}")].InstanceId`

    // ip 가 지정된 경우에만 
    if( this.checkIfValidIP(ipAddress)) {
      filters.push({ Name: PRIVATE_IP_ADDRESS, Values: [ipAddress] })
      jsonPath = `$.Reservations[*].Instances[?(@.PrivateIpAddress  == "${ipAddress}")].InstanceId`
    } else {
      filters.push({ Name: "private-dns-name", Values: [ipAddress] })
      jsonPath = `$.Reservations[*].Instances[?(@.PrivateDnsName == "${ipAddress}")].InstanceId`
    }

    if (vpc) {
      filters.push({ Name: 'vpc-id', Values: [vpc] })
      const param: DescribeInstancesCommandInput = { Filters: filters, DryRun: false }
      Log.debug(`[AWSReboot.run] describe instances command param : ${JSON.stringify(param)}`)

      // get instance information filtered by private ip address
      const command = new DescribeInstancesCommand(param)
      try {
        const data = await this.ec2.send(command)
        const instanceIds = jp.query(data, jsonPath) as Array<string>

        Log.info(`[AWSReboot.run] Reboot for InstanceIds ${JSON.stringify(instanceIds)} starts.`)
        this.terminateNode(instanceIds)
      } catch (err) {
        Log.error("[AWSReboot.run] Error", err.stack);
      }
    } else {
      Log.error('[AWSReboot.run] VPC is not configured in configfile. Reboot skipped.')
    }
  }

  // private async stopNode(instanceIds: string[]) {

  //   const dryRun:boolean =  (instanceIds.length > 1)?true:false;
  //   const param: StopInstancesCommandInput  = { InstanceIds: instanceIds , DryRun: dryRun}
  //   logger.info(`Reboot param : ${param}`)

  //   const data = this.sendAWSCommand(new StopInstancesCommand(param))
  //   logger.info(`Reboot request for ${instanceIds} done ${data}`)

  // }

  private async terminateNode(instanceIds: string[]) {

    const dryRun: boolean = (instanceIds.length > 1) ? true : false;
    const param: TerminateInstancesCommandInput = { InstanceIds: instanceIds, DryRun: dryRun }
    Log.debug(`[AWSReboot.terminateNode] Terminate param : ${JSON.stringify(param)}`)

    const data = this.sendAWSCommand(new TerminateInstancesCommand(param))
    Log.info(`[AWSReboot.terminateNode] Terminate request for ${instanceIds} done ${data}`)
  }

  private async sendAWSCommand(command: TerminateInstancesCommand | StopInstancesCommand): Promise<any> {
    try {
      return await this.ec2.send(command)
    } catch (err) {
      throw new Error(`[AWSReboot.sendAWSCommand] Call Instance Commanad Failed - ${err.message}`);
    }
  }
}

export default AWSShutdown;
