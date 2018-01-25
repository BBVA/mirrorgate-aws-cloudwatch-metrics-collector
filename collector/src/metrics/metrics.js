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

const getTemplate = require('./metricsRequestTemplate.js').getTemplate;

const metrics = [
  {MetricName: 'HTTPCode_ELB_4XX_Count'},
  {MetricName: 'HTTPCode_ELB_5XX_Count'},
  {MetricName: 'HTTPCode_Target_5XX_Count'},
  {MetricName: 'HTTPCode_Target_4XX_Count'},
  {MetricName: 'RequestCount'},
  {MetricName: 'HealthyHostCount', Period: 600},
  {MetricName: 'TargetResponseTime', Statistics: ['Sum', 'SampleCount']}
];

exports.getMetrics = function () {
  return metrics.map((m) => Object.assign({}, getTemplate(), m));
};
