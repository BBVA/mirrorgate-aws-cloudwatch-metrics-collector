/*
 * Copyright 2017 Banco Bilbao Vizcaya Argentaria, S.A.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const config = require('nconf');

config.argv()
  .env()
  .file('config/config.json');

const metrics = require('./src/metrics/metrics.js');
const template = require('./src/metrics/metricsRequestTemplate.js');
const APICaller = require('./src/API/APICaller.js');
var AWS = require('aws-sdk');
var sts = new AWS.STS();
var cloudWatch;
var elbv2;

AWS.config.update({region:'eu-west-1'});

function assumeAWSRole(accountId){
  var params = {
    DurationSeconds: 900,
    RoleArn: `arn:aws:iam::${accountId}:role/${config.get('ROLE_NAME')}`,
    RoleSessionName: 'MirrorGate'
  };
  return sts.assumeRole(params).promise();
}

function addDimensions(template, metricName, loadBalancer, targetGroup){
  var AWSBalancer = Object.assign({}, template);

  AWSBalancer.Dimensions =  [
    {
      "Name": "LoadBalancer",
      "Value": loadBalancer
    },
    {
      "Name": "TargetGroup",
      "Value": targetGroup
    }
  ];

  AWSBalancer.MetricName = metricName;

  return AWSBalancer;
}

function createInput(ALBName, targetGroups){
  let metricInputs = [];

  targetGroups.forEach((tg) => {
    metrics.metricNames.forEach(function(element){
      metricInputs.push(cloudWatch.getMetricStatistics(addDimensions(template.template, element, ALBName, `targetgroup/${tg.TargetGroupArn.split('targetgroup/')[1]}`)).promise());
    });
  });

  return metricInputs;
}

function isAWSElement(listElement){
  return listElement.includes(config.get('COLLECTOR_PREFIX'));
}

function getMetrics(albName) {
  return elbv2
    .describeLoadBalancers({
      Names: [
         albName
      ]
    })
    .promise()
    .then( (data) => {
      let promises = []
      data.LoadBalancers.forEach((lb) => {
        promises.push(
          elbv2
            .describeTargetGroups({
              LoadBalancerArn: lb.LoadBalancerArn
            })
            .promise()
            .then( (data) => {
              return Promise.all(createInput(
                lb.LoadBalancerArn.split('loadbalancer/')[1],
                data.TargetGroups
              ));
            })
            .catch( err => console.error(`Error getting metrics from Amazon: ${JSON.stringify(err)}`))
          );
      });

      return Promise.all(promises);
    })
}

module.exports = {

  cloudWatchInvoker: () => {
    return APICaller
      .getAWSAnalyticsList()
      .then((analyticsList) => {

        analyticsList
          .filter(isAWSElement)
          .forEach( AWSElement => {

            //Get account id and ALB name if this exists
            let cleanALB = AWSElement.trim().replace(config.get('COLLECTOR_PREFIX'), '');
            let accountId = cleanALB.split('/')[0];
            let albName = cleanALB.split('/')[1];

            assumeAWSRole(accountId)
              .then((element) => {

                cloudWatch = new AWS.CloudWatch({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken,
                  }
                });

                elbv2 = new AWS.ELBv2({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken
                  }
                });

                return getMetrics(albName)
                  .then((results) => {
                    let metrics_combined = []
                    results.forEach((metrics) => {
                      metrics.forEach((metric) => {
                        metrics_combined.push(metric);
                      });
                    })

                    APICaller
                      .sendResultsToMirrorgate(metrics_combined, AWSElement)
                      .then( result => console.log(`Elements sent to MirrorGate: ${JSON.stringify(result, null, '  ')}`))
                      .catch( err => console.error(`Error sending metrics to MirrorGate: ${JSON.stringify(err)}`));
                  });
              })
              .catch( err => console.error(`Error getting metrics from Amazon: ${JSON.stringify(err)}`));

          });
      })
      .catch( err => console.error(`Error getting analystics list from MirrorGate: ${err}`));
  },

}
