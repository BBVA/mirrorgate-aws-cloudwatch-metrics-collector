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
const PromisesBuilder = require('./src/promises/promises.js');
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

function isAWSElement(listElement){
  return listElement.includes(config.get('COLLECTOR_PREFIX'));
}

function getMetrics(account, resourceType, resourceName, cloudWatch, elb, elbv2, costExplorer, apiGateway) {
  let promises = [];

  switch(resourceType) {
    case 'elb':
      promises.push(PromisesBuilder.buildLBPromise(account, cloudWatch, elb, resourceName));
      break;
    case 'alb':
      promises.push(PromisesBuilder.buildElbv2Promise(account, cloudWatch, elbv2, resourceName));
      break;
    case 'apigateway':
      promises.push(PromisesBuilder.buildAPIGatewayPromise(account, cloudWatch, apiGateway, resourceName));
      break;
    default:
      promises.push(PromisesBuilder.buildCostExplorerPromise(account, costExplorer));
      promises.push(PromisesBuilder.buildLBPromise(account, cloudWatch, elb, resourceName));
      promises.push(PromisesBuilder.buildElbv2Promise(account, cloudWatch, elbv2, resourceName));
      promises.push(PromisesBuilder.buildAPIGatewayPromise(account, cloudWatch, apiGateway, resourceName));
      break;
  }
  
  return Promise.all(promises);
}

module.exports = {

  cloudWatchInvoker: () => {
    return APICaller
      .getAWSAnalyticsList()
      .then((analyticsList) => {
        analyticsList
          .filter(isAWSElement)
          .forEach(AWSElement => {

            let withoutPrefix = AWSElement.trim().replace(config.get('COLLECTOR_PREFIX'), '').split('/');
            let account = config.get('COLLECTOR_PREFIX') + withoutPrefix[0];
            let accountId = withoutPrefix[0];
            let resourceType = withoutPrefix.length > 1 ? withoutPrefix[1] : undefined;
            let resourceName = withoutPrefix.length > 1 ? withoutPrefix[2] : undefined;

            assumeAWSRole(accountId)
              .then((element) => {

                let cloudWatch = new AWS.CloudWatch({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken,
                  }
                });

                let elb = new AWS.ELB({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken
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

                let apiGateway = new AWS.APIGateway({
                  credentials: {
                    accessKeyId: element.Credentials.AccessKeyId,
                    secretAccessKey: element.Credentials.SecretAccessKey,
                    sessionToken: element.Credentials.SessionToken,
                  }
                });

                return getMetrics(account, resourceType, resourceName, cloudWatch, elb, elbv2, costExplorer, apiGateway)
                  .then((results) => {
                    let metrics_combined = [];
                    results.forEach((metrics) => {
                      metrics && metrics.forEach((metric) => {
                        if(Array.isArray(metric)){
                          metrics_combined.push(...metric);
                        } else {
                          metrics_combined.push(metric);
                        }
                      });
                    });

                    let groupedMetrics = new Map(Object.entries(
                      metrics_combined.reduce(function(metricsArray, metric) {
                        (metricsArray[metric['ViewId']] = metricsArray[metric['ViewId']] || []).push(metric);
                        return metricsArray;
                      }, {})
                    ));
                  
                    groupedMetrics.forEach((resource) => {
                      APICaller
                        .sendResultsToMirrorgate(resource)
                        .then( result => console.log(`Elements sent to MirrorGate: ${JSON.stringify(result, null, '  ')}\n`))
                        .catch( err => console.error(`Error sending metrics to MirrorGate: ${JSON.stringify(err, null, '  ')}`));
                    });

                  });
              })
              .catch( err => console.error(`Error getting metrics from Amazon: ${err}`));

          });
      })
      .catch( err => console.error(`Error getting analytics list from MirrorGate: ${JSON.stringify(err, null, '  ')}`));
  },

};
