
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
    metricInputs.push(cloudWatch.getMetricStatistics(addDimensions(template.template, element, ALBName),metricsCallback));
  });

  return metricInputs;
}

function main(){
  APICaller.getAWSLoadBalancers()
    .then((ALBList) => {
      ALBList.forEach((element) => {
        console.log(element);
        Promise.all(createInput(element)).then(function(values){
          //     //Transform 
          //     //Send to backend
        });
      });
    }).catch((error) => {
      console.log("error");
      console.log(error);
    });
}

main();
