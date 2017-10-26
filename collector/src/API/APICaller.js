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

const request = require('request');
const fs = require('fs');
const config = require('nconf');
const path = require('path');

config.argv()
  .env()
  .file(path.resolve(__dirname, '../../config/config.json'));

module.exports = {

  getAWSAnalyticsList: () => {
    return new Promise((resolve, reject)=>{
      request.get(`${config.get('MIRRORGATE_ENDPOINT')}/api/user-metrics/analytic-views`,(err, res, body) => {
        if (err) {
          return reject(err);
        }

        if(res.statusCode >= 400) {
          return reject({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
          });
        }

        return resolve(JSON.parse(body));
      });
    });
  },

  sendResultsToMirrorgate: (results, viewId) => {
    return new Promise((resolve, reject)=>{
      request.post(`${config.get('MIRRORGATE_ENDPOINT')}/api/user-metrics`,
        {
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(_createResponse(results, viewId))
        },
        (err, res, body) => {
          if (err) {
            return reject(err);
          }

          if(res.statusCode >= 400) {
            return reject({
              statusCode: res.statusCode,
              statusMessage: res.statusMessage
            });
          }

          return resolve(JSON.parse(body));
        });
    });
  }
};

function _createResponse(responses, viewId){

  let metrics = [];

  let totalErrors = 0;
  let totalRequests = 0;
  let totalPositivieHealthyChecks = 0;
  let totalZeroHealthyChecks = 0;
  let responseTimeSampleCount = 0;
  let responseTimeAccumulated = 0;

  //Cloudwatch returns data with two minutes delay, so we adjust to that
  let totalErrorsDate = new Date(new Date().getTime() - 120 * 1000).getTime();
  let totalRequestsDate = new Date(new Date().getTime() - 120 * 1000).getTime();
  let totalHealthyChecksDate = new Date(new Date().getTime() - 120 * 1000).getTime();
  let responseTimeDate = new Date(new Date().getTime() - 120 * 1000).getTime();

  responses.forEach(elem => {

    if(elem.Label === 'HTTPCode_ELB_4XX_Count' ||
       elem.Label === 'HTTPCode_ELB_5XX_Count' ||
       elem.Label === 'HTTPCode_Target_5XX_Count' ||
       elem.Label === 'HTTPCode_Target_4XX_Count'){

        if(elem.Datapoints &&  elem.Datapoints.length !== 0){
          totalErrors += elem.Datapoints[0].Sum;
          totalErrorsDate = new Date(elem.Datapoints[0].Timestamp).getTime();
        }
        return;
    }

    if(elem.Label === 'RequestCount' && elem.Datapoints &&  elem.Datapoints.length !== 0){
      totalRequests += elem.Datapoints[0].Sum;
      totalRequestsDate = new Date(elem.Datapoints[0].Timestamp).getTime();
      return;
    }

    if(elem.Label === 'HealthyHostCount' && elem.Datapoints &&  elem.Datapoints.length !== 0) {
      elem.Datapoints.forEach(data => data.Sum > 0 ? totalPositivieHealthyChecks++ : totalZeroHealthyChecks++);
      totalHealthyChecksDate = new Date(elem.Datapoints[0].Timestamp).getTime();
      return;
    }

    if(elem.Label === 'TargetResponseTime' && elem.Datapoints &&  elem.Datapoints.length !== 0){
      elem.Datapoints.forEach((data) => {
        if (!data.SampleCount) {
          return;
        }
        responseTimeSampleCount += data.SampleCount;
        responseTimeAccumulated += data.Sum;

      });
      responseTimeDate = new Date(elem.Datapoints[0].Timestamp).getTime();
      return;
    }
  });

  let template = {
    viewId: viewId,
    platform: 'AWS',
    collectorId: config.get('COLLECTOR_ID')
  }

  let availabilityRate = parseFloat((totalPositivieHealthyChecks * 100/(totalPositivieHealthyChecks + totalZeroHealthyChecks)).toFixed(2));
  let responseTime = responseTimeSampleCount ? parseFloat(responseTimeAccumulated/responseTimeSampleCount).toFixed(2) : undefined;

  metrics = [
    { name: 'errorsNumber', value: totalErrors, timestamp: totalErrorsDate },
    { name: 'requestsNumber', value: totalRequests, timestamp: totalRequestsDate },
    { name: 'availabilityRate', value: availabilityRate, timestamp: totalHealthyChecksDate },
    { name: 'responseTime', value: responseTime, timestamp: responseTimeDate }
  ].map((m) => Object.assign({}, template, m));

  return metrics;
}