
module.exports = {
  timeLapse : process.env.TIME_LAPSE || 10,
  alb : process.env.ALB || 'app/dev-mirrorgate-bg-alb/1bf910c05b34fd40',
  mirrorgateURL: process.env.MIRRORGATE || 'http://localhost:8080/mirrorgate/api/aws-balancers'
};