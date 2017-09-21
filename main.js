
const config = require('./src/config.js');
const metrics = require('./src/metrics/metrics.js');
const template = require('./src/metrics/metricsRequestTemplate.js');
const APICaller = require('./src/API/APICaller.js');

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

function addDimensions(template, metricName, loadBalancer){
  var AWSBalancer = Object.assign({}, template);

  AWSBalancer.Dimensions =  [{
      "Name": "LoadBalancer",
      "Value": loadBalancer}];

  AWSBalancer.MetricName = metricName;
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

function invoke(){
  APICaller.getAWSLoadBalancers()
    .then((analyticsList) => {
      var ALBList = analyticsList.filter(isALBElement);
      ALBList.forEach( element => {
        var cleanALB = element.trim().replace(config.collectorPrefix, '');
        Promise.all(createInput(cleanALB))
          .then(results => { 
            APICaller.sendResultsToMirrorgate(results, cleanALB).then(result => {
              console.log("Elements sent to Mirrorgate");
              console.log(result);
            }).catch(error => {
              console.log("POST to Mirrorgate failed!");
              console.log(error);
            });
          }).catch(error => console.log(error));
      });
    }).catch((error) => {
      console.log(error);
    });
}

exports.invoke = invoke;
