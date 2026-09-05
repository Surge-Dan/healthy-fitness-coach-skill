#!/usr/bin/env node
'use strict';

const { matchExercise, renderExerciseCard } = require('../references/workout-guide');

const args = process.argv.slice(2);
const json = args.includes('--json');
const card = args.includes('--card');
const query = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
if (!query) {
  process.stderr.write('用法: node scripts/workout-guide.js [--json|--card] <动作名|id|slug>\n');
  process.exitCode = 2;
} else {
  const result = matchExercise(query);
  if (card && result.status === 'match') process.stdout.write(`${renderExerciseCard(query)}\n`);
  else process.stdout.write(`${JSON.stringify(result, null, json ? 2 : 0)}\n`);
  if (result.status === 'no_match') process.exitCode = 1;
  if (card && result.status !== 'match') process.exitCode = 2;
}
