import * as AWS from 'aws-sdk';
import ConfigManager from '../config/ConfigManager';
import { IConfig } from '../types/Type';
const jp = require('jsonpath')

const JSON_PATH_INSTANCE_ID = '$..Instances[*].InstanceId'
const REGION_AP_2 = 'ap-northeast-2'
const FILTER = 'Filters'
const PRIVATE_IP_ADDRESS = 'private-ip-address'
export class AWSReboot {
  private ec2: any;

  constructor(private configManager: ConfigManager) {
    const config: IConfig = this.configManager.config;
    const region: string | undefined = config.nodeManager?.awsRegion;
    try {
      if (region) {
        AWS.config.update({ region: region });
      } else {
        AWS.config.update({ region: REGION_AP_2 });
      }
      this.ec2 = new AWS.EC2();

    } catch (err) {
      console.error(err)
      throw err;
    }
  }


  public run(ipAddress: string[]) {

    const vpc = this.configManager?.config?.nodeManager?.awsVPC;

    const param: EC2ListParam = { Filters: [], DryRun: false }

    // ip 가 지정된 경우에만 
    if (ipAddress && ipAddress.length > 0) {
      param.Filters.push({ Name: PRIVATE_IP_ADDRESS, Values: ipAddress })
    } else {
      throw new Error();
    }

    if( vpc ) {
      param.Filters.push({Name:'vpc-id', Values: [vpc]})
    }

    console.log(JSON.stringify(param))
    // get instance information filtered by private ip address
    this.ec2.describeInstances(param).promise()
    .then( (data:AWS.EC2.DescribeInstancesResult) => {
      const instanceIds = jp.query(data, JSON_PATH_INSTANCE_ID) as Array<string>
      this.rebootNode(instanceIds)

      console.log(JSON.stringify(instanceIds))
    })
    .catch((err:Error) => {
      console.log("Error", err.stack);
      throw err;
    })
  }

  private rebootNode(instanceIds: string[]) {
    const rebootParam: EC2ReBootParam = { InstanceIds: instanceIds }
    if (instanceIds.length > 1) {
      rebootParam['DryRun'] = true;
    } else {
      rebootParam['DryRun'] = false;
    }

    console.log(`Reboot param : ${rebootParam}`)
    let startData: AWS.EC2.RebootInstancesRequest;
    this.ec2.RebootInstances(rebootParam).promise()
      .then(async (data: AWS.EC2.RebootInstancesRequest) => {
        startData = data
        return await this.ec2.waitFor("instanceRunning", rebootParam).promise()
      })
      .then((wait: any) => {
        console.log(wait)
        if (!startData.InstanceIds) {
          return new Error("Reboot Instance Error");
        }
      })
      .catch((error: Error) => {
        return new Error(`Reboot Instance Error - ${error.message}`);
      })
  }
}

type EC2ReBootParam = {
  DryRun?: boolean,
  InstanceIds: Array<string>
}

type EC2ListParam = {
  DryRun?: boolean,
  Filters: Array<EC2Filter>
}

type EC2Filter = {
  Name: string,
  Values: Array<string>
}


