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
    const result = await runNode('scripts/extract-training-dna.js', ['--input', input, '--output', output], root);
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
