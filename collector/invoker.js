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

const config = require('./src/config.js');
const metrics = require('./src/metrics/metrics.js');
const template = require('./src/metrics/metricsRequestTemplate.js');
const APICaller = require('./src/API/APICaller.js');
var AWS = require('aws-sdk');
var sts = new AWS.STS();
var cloudWatch;

AWS.config.update({region:'eu-west-1'});

function assumeAWSRole(accountId){
  var params = {
    DurationSeconds: 900,
    RoleArn: "arn:aws:iam::"+accountId+":role/test_delegated_cloudwatch_metrics_role",
    RoleSessionName: "MirrorGate"
  };
  return sts.assumeRole(params).promise();
}

function metricsCallback(err, data){
  if (err) {
    console.log(err, err.stack);
  } else {
    console.log(data);
  }
}

function addDimensions(template, metricName, loadBalancer){
  var AWSBalancer = Object.assign({}, template);

  AWSBalancer.Dimensions =  [{
      "Name": "LoadBalancer",
      "Value": loadBalancer}];

  AWSBalancer.MetricName = metricName;
  console.log(AWSBalancer);

  return AWSBalancer;
}

function createInput(ALBName){
  let metricInputs = [];

  metrics.metricNames.forEach(function(element){
    metricInputs.push(cloudWatch.getMetricStatistics(addDimensions(template.template, element, ALBName)).promise());
  });

  return metricInputs;
}

function isALBElement(listElement){
  return listElement.includes(config.collectorPrefix);
}

module.exports = {

  cloudWatchInvoker: () => {
    return APICaller.getAWSLoadBalancers().then((analyticsList) => {
      var listOfALBs = analyticsList.filter(isALBElement);
      listOfALBs.forEach( element => {
        var cleanALB = element.trim().replace(config.collectorPrefix, '');
        //Get account id and ALB name
        var splitLocation = cleanALB.indexOf("/");
        var accountId = cleanALB.substring(0,splitLocation);
        var albName = cleanALB.substring(splitLocation+1, cleanALB.length);

        assumeAWSRole(accountId)
          .then((element) => {
            cloudWatch = new AWS.CloudWatch({
              credentials: {
                accessKeyId: element.Credentials.AccessKeyId,
                secretAccessKey: element.Credentials.SecretAccessKey,
                sessionToken: element.Credentials.SessionToken,
              }
            });
            Promise.all(createInput(albName))
              .then(results => {
                APICaller.sendResultsToMirrorgate(results, cleanALB)
                  .then(result => {
                      console.log("Elements sent to Mirrorgate");
                      console.log(result);
                  })
                  .catch(error => {
                      console.log("POST to Mirrorgate failed!");
                      console.log(error);
                  });
              })
              .catch(error => console.log(error));
          })
          .catch(error => console.log(error));
      });
    }).catch((error) => {
      console.log(error);
    });
  }

}