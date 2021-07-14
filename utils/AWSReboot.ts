import { DescribeInstancesCommand, DescribeInstancesCommandInput, EC2Client, Filter, StopInstancesCommand, StopInstancesCommandInput, TerminateInstancesCommand, TerminateInstancesCommandInput } from '@aws-sdk/client-ec2';
import ConfigManager from '../config/ConfigManager';
import { IConfig } from '../types/Type';
import { logger } from '../logger/Logger'

const jp = require('jsonpath')

const JSON_PATH_INSTANCE_ID = '$..Instances[*].InstanceId'
const REGION_AP_2 = 'ap-northeast-2'
const FILTER = 'Filters'
const PRIVATE_IP_ADDRESS = 'private-ip-address'
class AWSShutdown {
  private ec2: EC2Client;

  constructor(private configManager: ConfigManager) {
    const config: IConfig = this.configManager.config;
    const region: string | undefined = config.nodeManager?.awsRegion;
    try {
      if (region) {
        this.ec2 = new EC2Client({ region: region });
      } else {
        this.ec2 = new EC2Client({ region: REGION_AP_2 });
      }
    } catch (err) {
      console.error(err)
      throw err;
    }
  }

  public async run(ipAddress: string[]) {

    logger.info(`Reboot for nodes( ${JSON.stringify(ipAddress)}) started`)

    const vpc = this.configManager?.config?.nodeManager?.awsVPC;
    const filters: Array<Filter> = new Array<Filter>()

    // ip 가 지정된 경우에만 
    if (ipAddress && ipAddress.length > 0) {
      filters.push({ Name: PRIVATE_IP_ADDRESS, Values: ipAddress })
    } else {
      throw new Error();
    }

    if (vpc) {
      filters.push({ Name: 'vpc-id', Values: [vpc] })
    }

    const param: DescribeInstancesCommandInput = { Filters: filters, DryRun: false }
    logger.info(JSON.stringify(param))

    // get instance information filtered by private ip address
    const cmdParam: DescribeInstancesCommandInput = {}
    const command = new DescribeInstancesCommand(cmdParam)
    try {
      const data = await this.ec2.send(command)
      const instanceIds = jp.query(data, JSON_PATH_INSTANCE_ID) as Array<string>

      this.terminateNode(instanceIds)

      logger.info(JSON.stringify(instanceIds))
    } catch (err) {
      logger.info("Error", err.stack);
      throw err;
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
    logger.info(`Terminate param : ${param}`)

    const data = this.sendAWSCommand(new TerminateInstancesCommand(param))
    logger.info(`Terminate request for ${instanceIds} done ${data}`)

  }

  private async sendAWSCommand(command: TerminateInstancesCommand | StopInstancesCommand): Promise<any> {
    try {
      return await this.ec2.send(command)
    } catch (err) {
      throw new Error(`Call Instance Commanad Failed - ${err.message}`);
    }
  }
}

export default AWSShutdown;
