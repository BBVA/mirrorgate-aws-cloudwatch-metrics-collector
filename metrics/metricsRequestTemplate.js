var config = require('../config.js');

var template = {
  Namespace: 'AWS/ApplicationELB',
  Period: 600,
  
  StartTime: new Date(new Date().getTime() - (60 * 1000 * config.timeLapse)),
  EndTime: new Date(),
  
  Statistics: ['Sum']
};

exports.template = template;