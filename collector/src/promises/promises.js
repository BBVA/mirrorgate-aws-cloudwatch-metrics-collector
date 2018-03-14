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
const APICaller = require('../API/APICaller.js');
const Metrics = require('../metrics/metrics.js');
const config = require('nconf');
const path = require('path');

config.argv()
  .env()
  .file(path.resolve(__dirname, '../../config/config.json'));

function _checkCostDaily(AWSElement){
  return new Promise((resolve, reject) => {
    APICaller.getCollectorMetrics().then((metrics) => {
      let infrastructureCostMetrics = metrics.filter((metric) => metric.name.localeCompare("infrastructureCost") === 0 && metric.viewId.localeCompare(AWSElement) === 0);

      if (infrastructureCostMetrics.length != 0){
        infrastructureCostMetrics.forEach((metric) => {
          var dayBefore = new Date().setDate(new Date().getDate()-1);
          return resolve (metric.timestamp < dayBefore);
        });
      } else {
        return resolve(true);
      }
    })
    .catch( err => {
      console.error(`Error getting collector metrics: ${err}`);
    });
  });
}

function _addAPIGatewayDimension(_metric, APIName){
  let metric = Object.assign({}, _metric);

  metric.Dimensions =  [];

  metric.Dimensions.push({
    "Name": "ApiName",
    "Value": APIName,
  });

  return metric;
}

function _addDimensions(_metric, loadBalancer, targetGroup){

  let metric = Object.assign({}, _metric);

  metric.Dimensions =  [];

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

function _createInput(cloudWatch, ALBName, targetGroups){
  let metricInputs = [];

  targetGroups.forEach((tg) => {
    Metrics.getMetrics().forEach((metric) => {
      metricInputs.push(cloudWatch.getMetricStatistics(_addDimensions(metric, ALBName, `targetgroup/${tg.TargetGroupArn.split('targetgroup/')[1]}`)).promise());
    });
  });

  return metricInputs;
}

function _createAPIGatewayInput(cloudWatch, APIDescriptions){
  let metricInputs = [];

  if(APIDescriptions.items){
    APIDescriptions.items.forEach((description) =>{
      Metrics.getGatewayMetrics().forEach((metric) => {
        metricInputs.push(cloudWatch.getMetricStatistics(_addAPIGatewayDimension(metric, description.name)).promise());
      });
    });
  }

  return metricInputs;
}

function _formatDate(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

module.exports = {
  buildCostExplorerPromise: (AWSElement, costExplorer) => {
    return _checkCostDaily(AWSElement).then((checkCost) => {
      if(checkCost){
        return costExplorer.getCostAndUsage({
            Granularity: 'MONTHLY',
            TimePeriod: {
              Start: _formatDate(new Date().setDate(new Date().getDate()-config.get('COST_FROM_DAYS_BEFORE'))),
              End: _formatDate(new Date()),
            },
            Metrics: ['BlendedCost']
          }).promise()
            .then( (data) => {
              return [{
                Label: 'InfrastructureCost',
                Value: data
              }];
            })
            .catch( err => console.error(`Error getting infrastructure cost from Amazon: ${err}`));
      }
    });
  },

  buildElbv2Promise: (elbv2, albName, cloudWatch) => {
    elbv2Array = [];

    return elbv2.describeLoadBalancers({
      Names: [
         albName
      ]
    })
    .promise()
    .then( (data) => {
      data.LoadBalancers.forEach((lb) => {
        elbv2Array.push(elbv2
                .describeTargetGroups({
                  LoadBalancerArn: lb.LoadBalancerArn
                })
            .promise()
            .then( (data) => {
              return Promise.all(_createInput(
                cloudWatch,
                lb.LoadBalancerArn.split('loadbalancer/')[1],
                data.TargetGroups
              ));
            })
            .catch( err => console.error(`Error getting metrics from ELB: ${err}`))
          );
      });
      return Promise.all(elbv2Array);
    });
  },

  buildAPIGatewayPromise: (cloudwatch, apiGateway) => {
    return apiGateway.getRestApis({})
      .promise()
      .then((APIDescriptions) => {
        return Promise.all(_createAPIGatewayInput(cloudwatch, APIDescriptions));
      }).catch(err => console.error(`Error getting metrics fro APIGateway: ${err}`));
  },

};
