/*
 * Copyright 2017 Banco Bilbao Vizcaya Argentaria, S.A.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = {
  timeLapse : process.env.TIME_LAPSE || 10,
  mirrorgateGetAnalyticViewsEndpoint: process.env.MIRRORGATE_GET_ANALYTICS_ENDPOINT || 'http://localhost:8080/mirrorgate/api/user-metrics/analytic-views',
  mirrorgatePostAnalyticViewsEndpoint: process.env.MIRRORGATE_POST_ANALYTICS_ENDPOINT ||'http://localhost:8080/mirrorgate/api/user-metrics',
  collectorPrefix: process.env.COLLECTOR_PREFIX || 'AWS/',
  collectorId: process.env.COLLECTOR_ID || 'mirrorgate-aws-cloudwatch-metrics-collector',
  roleName: process.env.ROLE_NAME || 'delegated-cloudwatch-metrics-role'
};