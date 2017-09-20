const request = require('request');
const config = require('../config.js');

function getAWSLoadBalancers(){
  return new Promise((resolve, reject)=>{
    request.get(config.mirrorgateURL+config.mirrorgateGetAnalyticViewsEndpoint,(error, response, body) => {
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
}

function sendResultsToMirrorgate(results, viewId){

  request.post(config.mirrorgateURL+config.mirrorgatePostAnalyticViewsEndpoint,{
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createResponse(results, viewId))},
    (err, res, body) => {
      if (err) {
        return err;
      }else {
        console.log(body);
      }
    });
}

function createResponse(responses, viewId){
  let totalErrors = 0;
  let totalRequests = 0;
  let metrics = [];

  responses.forEach(elem => {
    if(elem.Label === 'HTTPCode_ELB_4XX_Count' || 
       elem.Label === 'HTTPCode_ELB_5XX_Count' || 
       elem.Label === 'HTTPCode_Target_5XX_Count' || 
       elem.Label === 'HTTPCode_Target_4XX_Count'){
        if(elem.Datapoints.Sum){
          totalErrors += elem.Datapoints[0].Sum;
        }
          
    } else {
      totalRequests += elem.Datapoints[0].Sum;
    }
  });

  metrics.push({
    viewId: viewId,
    platform: 'AWS',
    name: 'errorsNumber',
    value: totalErrors,
    timestamp: Date.now(),
    collectorId: 'mirrorgate-AWS-collector'
  });

  metrics.push({
    viewId: viewId,
    platform: 'AWS',
    name: 'RequestsNumber',
    value: totalRequests,
    timestamp: Date.now(),
    collectorId: 'mirrorgate-AWS-collector'
  });

  return metrics;
}

exports.getAWSLoadBalancers = getAWSLoadBalancers;
exports.sendResultsToMirrorgate = sendResultsToMirrorgate;
