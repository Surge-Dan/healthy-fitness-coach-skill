'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

function runNode(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = require('node:child_process').spawn(process.execPath, [script, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('standalone DNA CLI reads JSON and writes an auditable result', async () => {
  const root = join(__dirname, '..');
  const temp = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-cli-'));
  try {
    const input = join(temp, 'input.json');
    const output = join(temp, 'dna.json');
    await writeFile(input, JSON.stringify({ date_start: '2026-01-01', date_end: '2026-01-14', records: [
      { record_date: '2026-01-01', id: 'a', title: '卧推', sets: 3, reps: 8, weight: '60kg', volume: 1440 },
      { record_date: '2026-01-03', id: 'b', title: '跑步', raw_text: '2026-01-03,跑步,time:1800s,5km,140bpm' }
    ] }), 'utf8');
    const result = await runNode('scripts/extract-training-dna.js', ['--input', input, '--legacy-raw', '--output', output], root);
    assert.equal(result.code, 0, result.stderr);
    const dna = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(dna.schema_version, '1.0');
    assert.equal(dna.metrics.resistance.sessions, 1);
    assert.equal(dna.metrics.aerobic.sessions, 1);
    assert.ok(Array.isArray(dna.evidence_ledger));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('DNA CLI rejects raw records by default and requires explicit legacy mode', async () => {
  const root = join(__dirname, '..');
  const temp = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-cli-default-'));
  try {
    const input = join(temp, 'input.json');
    await writeFile(input, JSON.stringify({ records: [{ record_date: '2026-01-01', title: '卧推', sets: 3, reps: 8, weight: '60kg' }] }), 'utf8');
    const result = await runNode('scripts/extract-training-dna.js', ['--input', input], root);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /review|legacy/i);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('DNA CLI rejects an incomplete review bundle without both facts and decision', async () => {
  const root = join(__dirname, '..');
  const temp = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-cli-bundle-'));
  try {
    const input = join(temp, 'input.json');
    await writeFile(input, JSON.stringify({ review_facts: { data_range: { start: '2026-01-01', end: '2026-01-07' }, quality: { status: 'complete' } } }), 'utf8');
    const result = await runNode('scripts/extract-training-dna.js', ['--input', input], root);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /facts.*decision|decision.*facts/i);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('DNA CLI preserves every accepted decision alias for array and object facts', async () => {
  const root = join(__dirname, '..');
  const temp = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-cli-aliases-'));
  const facts = { data_range: { start: '2026-01-01', end: '2026-01-07' }, quality: { status: 'complete' }, performance: { points: [], comparisons: [] }, recovery: { status: 'not_confirmed', observations: [] } };
  const decision = { keep: ['保留CLI别名决策'], changes: [] };
  try {
    for (const factsAlias of ['facts', 'review_facts', 'reviewFacts']) {
      for (const decisionAlias of ['decision', 'review_decision', 'reviewDecision']) {
        for (const factsShape of ['object', 'array']) {
          const input = join(temp, `${factsAlias}-${decisionAlias}-${factsShape}.json`);
          const output = join(temp, `${factsAlias}-${decisionAlias}-${factsShape}.out.json`);
          await writeFile(input, JSON.stringify({ [factsAlias]: factsShape === 'array' ? [facts] : facts, [decisionAlias]: decision }), 'utf8');
          const result = await runNode('scripts/extract-training-dna.js', ['--input', input, '--output', output], root);
          assert.equal(result.code, 0, `${factsAlias}/${decisionAlias}/${factsShape}: ${result.stderr}`);
          const dna = JSON.parse(await readFile(output, 'utf8'));
          assert.deepEqual(dna.decision_ledger[0].keep, ['保留CLI别名决策'], `${factsAlias}/${decisionAlias}/${factsShape}`);
        }
      }
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('DNA CLI rejects every facts alias when its decision alias is absent', async () => {
  const root = join(__dirname, '..');
  const temp = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-cli-missing-decision-'));
  const facts = { data_range: { start: '2026-01-01', end: '2026-01-07' }, quality: { status: 'complete' } };
  try {
    for (const factsAlias of ['facts', 'review_facts', 'reviewFacts']) {
      const input = join(temp, `${factsAlias}.json`);
      await writeFile(input, JSON.stringify({ [factsAlias]: facts }), 'utf8');
      const result = await runNode('scripts/extract-training-dna.js', ['--input', input], root);
      assert.notEqual(result.code, 0, factsAlias);
      assert.match(result.stderr, /facts.*decision|decision.*facts/i, factsAlias);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
