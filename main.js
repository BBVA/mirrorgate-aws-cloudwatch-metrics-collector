
const config = require('./config.js');
const metrics = require('./metrics/metrics.js');
const template = require('./metrics/metricsRequestTemplate.js');
const APICaller = require('./API/APICaller.js');

var AWS = require('aws-sdk');

AWS.config.update({region:'eu-west-1'});

var cloudWatch = new AWS.CloudWatch();

function metricsCallback(err, data){
  if (err) {
    console.log(err, err.stack); 
  } else {
    console.log(data);
  }    
}

function addDimensions(AWSRequest, metricName, loadBalancer){
  delete AWSRequest.Dimensions;
  delete AWSRequest.MetricName;

  AWSRequest.Dimensions =  [{
      "Name": "LoadBalancer",
      "Value": loadBalancer}];

  AWSRequest.MetricName = metricName;
  return AWSRequest;
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

function main(){
  APICaller.getAWSLoadBalancers()
    .then((analyticsList) => {
      var ALBList = analyticsList.filter(isALBElement);
      ALBList.forEach( element => {
        var cleanALB = element.trim().replace(config.collectorPrefix, '');
        Promise.all(createInput(cleanALB))
          .then(results => { 
            APICaller.sendResultsToMirrorgate(results, cleanALB);
          }).catch(error => console.log(error));
      });
    }).catch((error) => {
      console.log(error);
    });
}

main();
