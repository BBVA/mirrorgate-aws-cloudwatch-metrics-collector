
const CloudwatchInvoker = require('./invoker.js');

exports.handler = (event, context) => {
  
    context.callbackWaitsForEmptyEventLoop = false;

    CloudwatchInvoker.cloudWatchInvoker();
};
