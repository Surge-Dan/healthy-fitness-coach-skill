'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { routeOutput } = require('../healthy-fitness-coach/references/output-routing.js');

test('explicit trend dashboard requests route to the dashboard mode', () => {
  assert.deepEqual(routeOutput({ taskType: 'training_data_analysis', userInstruction: '生成趋势面板' }), {
    mode: 'dashboard', reason: 'explicit_command', override: 'dashboard'
  });
});
