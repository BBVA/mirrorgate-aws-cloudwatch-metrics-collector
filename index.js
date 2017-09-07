var AWS = require('aws-sdk');

AWS.config.update({region:'eu-west-1'});

var cw = new AWS.CloudWatch();

/*
//Usefull to get the list of dimensions
cw.listMetrics({
    Namespace: 'AWS/ApplicationELB',
    MetricName: 'RequestCount'
}, (err, data) => {
    console.log(err)
    console.log(JSON.stringify(data, null ,2));
});
*/

cw.getMetricStatistics({
    Namespace: 'AWS/ApplicationELB',
    MetricName: 'RequestCount',
    Period: 600,
    Dimensions: [{
        "Name": "LoadBalancer",
        "Value": "app/dev-mirrorgate-bg-alb/1bf910c05b34fd40"
    },{
        "Name": "AvailabilityZone",
        "Value": "eu-west-1b"
    }],
    StartTime: new Date(new Date().getTime() - 600 * 1000),
    EndTime: new Date(),
    Statistics: ['Sum','Average']

}, (err, data) => {
    if(err) {
        console.log("Err -> " + err);
    } else {
        console.log(JSON.stringify(data, null ,2));
    }
});
