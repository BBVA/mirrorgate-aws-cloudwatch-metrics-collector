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
  getAWSLoadBalancers: function getAWSLoadBalancers(){
    return new Promise((resolve, reject)=>{
      request.get(config.mirrorgateGetAnalyticViewsEndpoint,(error, response, body) => {
        if(error){
          console.log(error);
          return reject(error);
        } else {
          console.log(response.statusCode);
          console.log(body);
          return resolve(JSON.parse(body));
        }
      });
    });
  },

  sendResultsToMirrorgate: function sendResultsToMirrorgate(results, viewId){
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
            console.log(err);
            return reject(error);
          }else {
            console.log(body);
            return resolve(JSON.parse(body));
          }
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

  console.log("Building response");
  responses.forEach(elem => {
    console.log(elem);
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
