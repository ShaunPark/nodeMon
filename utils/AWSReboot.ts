import * as AWS from 'aws-sdk';

export class AWSReboot {
  private ec2:any;

  constructor() {
    this.ec2 = new AWS.EC2();
  }

  public run() {
    this.ec2.describeInstances({DryRun: false}, (err:any, data:any) => {
      if (err) {
        console.log("Error", err.stack);
      } else {
        console.log("Success", JSON.stringify(data));
      }
    })
  }
}

// // var AWS = require('aws-sdk');
// // // Set the region 
// // AWS.config.update({region: 'REGION'});

// // Create EC2 service object
// var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});

// var params = {
//   DryRun: false
// };

// // Call EC2 to retrieve policy for selected bucket
// ec2.describeInstances(params, function(err, data) {
//   if (err) {
//     console.log("Error", err.stack);
//   } else {
//     console.log("Success", JSON.stringify(data));
//   }
// });