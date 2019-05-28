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

function _checkCostDaily(account){
  return new Promise((resolve, reject) => {
    APICaller.getCollectorMetrics().then((metrics) => {
      let infrastructureCostMetrics = metrics.filter((metric) => metric.name.localeCompare("infrastructureCost") === 0 && metric.viewId.localeCompare(account) === 0);

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
      console.error(`Error getting collector metrics: ${JSON.stringify(err, null, '  ')}`);
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

function _addElbDimensions(_metric, loadBalancer){
  let metric = Object.assign({}, _metric);

  metric.Dimensions =  [];

  metric.Dimensions.push({
    "Name": "LoadBalancerName",
    "Value": loadBalancer
  });

  return metric;
}

function _addElbv2Dimensions(_metric, loadBalancer, targetGroup){

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

function _createElbInput(account, cloudWatch, ELBName){
  let metricInputs = [];

  Metrics.getElbMetrics().forEach((metric) => {
    metricInputs.push(
      cloudWatch.getMetricStatistics(_addElbDimensions(metric, ELBName))
      .promise()
      .then((data) => {
        data.ViewId = `${account}/elb/${ELBName}`;
        data.Type = 'elb';
        return data;
      })
    );
  });

  return metricInputs;
}

function _createElbv2Input(account, cloudWatch, ALBName, targetGroups){
  let metricInputs = [];

  targetGroups.forEach((tg) => {
    Metrics.getElbv2Metrics().forEach((metric) => {
      metricInputs.push(
        cloudWatch.getMetricStatistics(_addElbv2Dimensions(metric, ALBName, `targetgroup/${tg.TargetGroupArn.split('targetgroup/')[1]}`))
          .promise()
          .then((data) => {
            data.ViewId = `${account}/alb/${ALBName.split('app/')[1].split('/')[0]}/${tg.TargetGroupArn.split('targetgroup/')[1].split('/')[0]}`;
            data.Type = 'alb';
            return data;
          })
        );
    });
  });

  return metricInputs;
}

function _createAPIGatewayInput(account, cloudWatch, APIDescriptions){
  let metricInputs = [];

  if(APIDescriptions){
    APIDescriptions.forEach((description) =>{
      Metrics.getGatewayMetrics().forEach((metric) => {
        metricInputs.push(
          cloudWatch.getMetricStatistics(_addAPIGatewayDimension(metric, description.name)).promise()
          .then((data) => {
            data.ViewId = account + '/apigateway/' + description.name;
            data.Type = 'apigateway';
            return data;
          })
        );
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
  buildCostExplorerPromise: (account, costExplorer) => {
    return _checkCostDaily(account).then((checkCost) => {
      if(checkCost){
        return costExplorer.getCostAndUsage({
            Granularity: 'MONTHLY',
            TimePeriod: {
              Start: _formatDate(new Date().setDate(new Date().getDate()-config.get('COST_FROM_DAYS_BEFORE'))),
              End: _formatDate(new Date()),
            },
            Metrics: ['BlendedCost']
          }).promise()
            .then((data) => {
              return [{
                Label: 'InfrastructureCost',
                Value: data,
                ViewId: account,
                Type: 'billing'
              }];
            })
            .catch( err => console.error(`Error getting infrastructure cost from Amazon: ${err}`));
      }
    });
  },

  buildELBPromise: (account, cloudWatch, elb, elbName) => {
    let elbArray = [];

    return elb.describeLoadBalancers({
      LoadBalancerNames: [
        elbName
      ]
    })
    .promise()
    .then( (data) => {
      data.LoadBalancerDescriptions.forEach((lb) => {
        elbArray.push(Promise.all(_createElbInput(
                account,
                cloudWatch,
                lb.LoadBalancerName
              )
        ));
      });
      return Promise.all(elbArray);
    })
    .catch(function(err){
      if(err.code !== "LoadBalancerNotFound"){ // We don't stop the execution if the load balancer is not found (because we don't know if it is an ELB or ALB)
        console.error(err);
      }
    });
  },

  buildELBv2Promise: (account, cloudWatch, elbv2) => {
    let elbv2Array = [];

    return elbv2.describeLoadBalancers({
      Names: []
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
              return Promise.all(_createElbv2Input(
                account,
                cloudWatch,
                lb.LoadBalancerArn.split('loadbalancer/')[1],
                data.TargetGroups
              ));
            })
            .catch( err => console.error(`Error getting metrics from ALB: ${err}`))
          );
      });
      return Promise.all(elbv2Array);
    })
    .catch(function(err){
      if(err.code !== "LoadBalancerNotFound"){ // We don't stop the execution if the load balancer is not found (because we don't know if it is an ELB or ALB)
        console.error(err);
      }
    });
  },

  buildAPIGatewayPromise: (account, cloudWatch, apiGateway, apiName) => {
    return apiGateway.getRestApis({})
      .promise()
      .then((APIDescriptions) => {
        if(apiName){
          APIDescriptions = APIDescriptions.items.filter(function(restApi){
            return restApi.name === apiName;
          });
        }else{
          APIDescriptions = APIDescriptions.items;
        }
        return Promise.all(_createAPIGatewayInput(account, cloudWatch, APIDescriptions));
      }).catch(err => console.error(`Error getting metrics fro APIGateway: ${err}`));
  },

};
