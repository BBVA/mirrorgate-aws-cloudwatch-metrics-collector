
module.exports = {
  timeLapse : process.env.TIME_LAPSE || 10,
  alb : process.env.ALB || 'app/dev-mirrorgate-bg-alb/1bf910c05b34fd40',
  mirrorgateURL: process.env.MIRRORGATE || 'http://localhost:8080/mirrorgate',
  mirrorgateGetAnalyticViewsEndpoint: process.env.GET_ENDPOINT || '/api/user-metrics/analytic-views',
  mirrorgatePostAnalyticViewsEndpoint: process.env.POST_ENDPOINT ||'/api/user-metrics',
  collectorPrefix: 'AWS/'
};