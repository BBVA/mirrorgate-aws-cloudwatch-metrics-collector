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

const Metrics = require('./src/metrics/metrics.js');
const APICaller = require('./src/API/APICaller.js');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const config = require('nconf');

config.argv()
  .env()
  .file(path.resolve(__dirname, './config/config.json'));

AWS.config.update({region:config.get('AWS_REGION')});

function assumeAWSRole(accountId){
  var params = {
    DurationSeconds: 900,
    RoleArn: `arn:aws:iam::${accountId}:role/${config.get('ROLE_NAME')}`,
    RoleSessionName: 'MirrorGate'
  };
  return new AWS.STS().assumeRole(params).promise();
}

function addDimensions(_metric, loadBalancer, targetGroup){

  let metric = Object.assign({}, _metric);

  metric.Dimensions =  []

  metric.Dimensions.push({
    "Name": "LoadBalancer",
    "Value": loadBalancer
  });

  if(targetGroup) {
    metric.Dimensions.push({
      "Name": "TargetGroup",
      "Value": targetGroup
    });
  }

  return metric;
}

function createInput(cloudWatch, ALBName, targetGroups){
  let metricInputs = [];

  targetGroups.forEach((tg) => {
    Metrics.getMetrics().forEach((metric) => {
      metricInputs.push(cloudWatch.getMetricStatistics(addDimensions(metric, ALBName, `targetgroup/${tg.TargetGroupArn.split('targetgroup/')[1]}`)).promise());
    });
  });

  return metricInputs;
}

function isAWSElement(listElement){
  return listElement.includes(config.get('COLLECTOR_PREFIX'));
}

function checkCostDaily(){
  APICaller.getCollectorMetrics().then((metrics) => {
    metrics
      .filter((metric) => metric.name.localeCompare("infrastructureCost") === 0)
      .forEach((metric) => {
        var dayBefore = new Date().setDate(new Date().getDate()-1);
        return metric.timestamp < dayBefore;
      });
  })
  .catch( err => 
    console.error(`Error getting collector metrics: ${err}`));
}

function getMetrics(albName, cloudWatch, elbv2, costExplorer) {
  let promises = [];

  costExplorer && checkCostDaily() && promises.push(
    costExplorer.getCostAndUsage({
      Granularity: 'MONTHLY',
      TimePeriod: {
        Start: formatDate(new Date().setDate(new Date().getDate()-config.get('COST_FROM_DAYS_BEFORE'))),
        End: formatDate(new Date()),
      },
      Metrics: ['BlendedCost']
    })
      .promise()
      .then( (data) => {
        return [{
          Label: 'InfrastructureCost',
          Value: data
        }];
      })
      .catch( err => console.error(`Error getting infrastructure cost from Amazon: ${err}`))
    );

  return elbv2
    .describeLoadBalancers({
      Names: [
         albName
      ]
    })
    .promise()
    .then( (data) => {
      data.LoadBalancers.forEach((lb) => {
        promises.push(
          elbv2
            .describeTargetGroups({
              LoadBalancerArn: lb.LoadBalancerArn
            })
            .promise()
            .then( (data) => {
              return Promise.all(createInput(
                cloudWatch,
                lb.LoadBalancerArn.split('loadbalancer/')[1],
                data.TargetGroups
              ));
            })
            .catch( err => console.error(`Error getting metrics from Amazon: ${err}`))
          );
      });

      return Promise.all(promises);
    })
}

function formatDate(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
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

                let cloudWatch = new AWS.CloudWatch({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken,
                  }
                });

                let elbv2 = new AWS.ELBv2({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken
                  }
                });

                let costExplorer = new AWS.CostExplorer({
                  region: 'us-east-1', // Only available in region us-east-1 yet
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken,
                  }
                });

                return getMetrics(albName, cloudWatch, elbv2, costExplorer)
                  .then((results) => {
                    let metrics_combined = [];
                    results.forEach((metrics) => {
                      metrics && metrics.forEach((metric) => {
                        metrics_combined.push(metric);
                      });
                    })

                    APICaller
                      .sendResultsToMirrorgate(metrics_combined, AWSElement)
                      .then( result => console.log(`Elements sent to MirrorGate: ${JSON.stringify(result, null, '  ')}`))
                      .catch( err => console.error(`Error sending metrics to MirrorGate: ${JSON.stringify(err, null, '  ')}`));
                  });
              })
              .catch( err => console.error(`Error getting metrics from Amazon: ${err}`));

          });
      })
      .catch( err => console.error(`Error getting analytics list from MirrorGate: ${JSON.stringify(err, null, '  ')}`));
  },

};
