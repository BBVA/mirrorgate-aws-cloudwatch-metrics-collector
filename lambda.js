
const CloudwatchInvoker = require('./main.js');

exports.handler = (event, context) => {
  
    context.callbackWaitsForEmptyEventLoop = false;

    CloudwatchInvoker.invoke();
};
