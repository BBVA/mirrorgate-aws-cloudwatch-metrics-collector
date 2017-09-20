const request = require('request');
const config = require('../config.js');

function getAWSLoadBalancers(){
  return new Promise((resolve, reject)=>{
    request.get(config.mirrorgateURL,(error, response, body) => {
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

exports.getAWSLoadBalancers = getAWSLoadBalancers;
