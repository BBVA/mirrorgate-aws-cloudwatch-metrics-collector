
module.exports = {
  timeLapse : process.env.TIME_LAPSE || 10,
  mirrorgateGetAnalyticViewsEndpoint: process.env.MIRRORGATE_GET_ANALYTICS_ENDPOINT || 'http://localhost:8080/mirrorgate/api/user-metrics/analytic-views',
  mirrorgatePostAnalyticViewsEndpoint: process.env.MIRRORGATE_POST_ANALYTICS_ENDPOINT ||'http://localhost:8080/mirrorgate/api/user-metrics',
  collectorPrefix: 'AWS/',
  collectorId:'mirrorgate-aws-cloudwatch-metrics-collector'
};