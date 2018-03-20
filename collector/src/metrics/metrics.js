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

const elbMetrics = [
  {MetricName: 'HTTPCode_ELB_4XX', Namespace: 'AWS/ELB'},
  {MetricName: 'HTTPCode_ELB_5XX', Namespace: 'AWS/ELB'},
  {MetricName: 'HTTPCode_Backend_4XX', Namespace: 'AWS/ELB'},
  {MetricName: 'HTTPCode_Backend_5XX', Namespace: 'AWS/ELB'},
  {MetricName: 'RequestCount', Namespace: 'AWS/ELB'},
  {MetricName: 'HealthyHostCount', Namespace: 'AWS/ELB', Period: 600},
  {MetricName: 'Latency', Namespace: 'AWS/ELB', Statistics: ['Sum', 'SampleCount']},
];

const elbv2Metrics = [
  {MetricName: 'HTTPCode_ELB_4XX_Count', Namespace: 'AWS/ApplicationELB'},
  {MetricName: 'HTTPCode_ELB_5XX_Count', Namespace: 'AWS/ApplicationELB'},
  {MetricName: 'HTTPCode_Target_4XX_Count', Namespace: 'AWS/ApplicationELB'},
  {MetricName: 'HTTPCode_Target_5XX_Count', Namespace: 'AWS/ApplicationELB'},
  {MetricName: 'RequestCount', Namespace: 'AWS/ApplicationELB'},
  {MetricName: 'HealthyHostCount', Namespace: 'AWS/ApplicationELB', Period: 600},
  {MetricName: 'TargetResponseTime', Namespace: 'AWS/ApplicationELB', Statistics: ['Sum', 'SampleCount']},
];

const gatewayMetrics = [
  {MetricName: '4XXError', Namespace: 'AWS/ApiGateway'},
  {MetricName: '5XXError', Namespace: 'AWS/ApiGateway'},
  {MetricName: 'Count', Namespace: 'AWS/ApiGateway'},
  {MetricName: 'Latency', Namespace: 'AWS/ApiGateway', Statistics:['Sum', 'SampleCount']},  
];

exports.getElbMetrics = function () {
  return elbMetrics.map((m) => Object.assign({}, getTemplate(), m));
};

exports.getElbv2Metrics = function () {
  return elbv2Metrics.map((m) => Object.assign({}, getTemplate(), m));
};

exports.getGatewayMetrics = function () {
  return gatewayMetrics.map((m) => Object.assign({}, getTemplate(), m));
};
