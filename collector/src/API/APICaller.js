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
const config = require('../config.js');

module.exports = {

  getAWSLoadBalancers: () => {
    return new Promise((resolve, reject)=>{
      request.get(config.mirrorgateGetAnalyticViewsEndpoint,(err, res, body) => {
        if (err) {
          return reject(err);
        }
        body = JSON.parse(body);
        if(body.status >= 400) {
          return reject({
            statusCode: body.status,
            statusMessage: body.error
          });
        }
        return resolve(body);
      });
    });
  },

  sendResultsToMirrorgate: (results, viewId) => {
    return new Promise((resolve, reject)=>{
      request.post(config.mirrorgatePostAnalyticViewsEndpoint,
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
          body = JSON.parse(body);
          if(body.status >= 400) {
            return reject({
              statusCode: body.status,
              statusMessage: body.error
            });
          }
          return resolve(body);
        });
    });
}
};

function _createResponse(responses, viewId){
  let totalErrors = 0;
  let totalRequests = 0;
  let metrics = [];
  //Cloudwatch returns data with two minutes delay, so we adjust to that
  let totalErrorsDate = new Date(new Date().getTime() - 120 * 1000).getTime();
  let totalRequestsDate = new Date(new Date().getTime() - 120 * 1000).getTime();

  responses.forEach(elem => {
    if(elem.Label === 'HTTPCode_ELB_4XX_Count' ||
       elem.Label === 'HTTPCode_ELB_5XX_Count' ||
       elem.Label === 'HTTPCode_Target_5XX_Count' ||
       elem.Label === 'HTTPCode_Target_4XX_Count'){

        if(elem.Datapoints &&  elem.Datapoints.length !== 0){
          totalErrors += elem.Datapoints[0].Sum;
          totalErrorsDate = new Date(elem.Datapoints[0].Timestamp).getTime();
        }

    } else {
      if(elem.Datapoints &&  elem.Datapoints.length !== 0){
        totalRequests += elem.Datapoints[0].Sum;
        totalRequestsDate = new Date(elem.Datapoints[0].Timestamp).getTime();
      }
    }
  });

  metrics.push({
    viewId: viewId,
    platform: 'AWS',
    name: 'errorsNumber',
    value: totalErrors,
    timestamp: totalErrorsDate,
    collectorId: config.collectorId
  });

  metrics.push({
    viewId: viewId,
    platform: 'AWS',
    name: 'RequestsNumber',
    value: totalRequests,
    timestamp: totalRequestsDate,
    collectorId: config.collectorId
  });

  return metrics;
}
