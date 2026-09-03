'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const { buildPairedEvaluation, writePairedEvaluationArtifacts } = require('../evals/paired-evaluation.js');

test('creates an auditable static comparison for precisely evals 13 through 18', () => {
  const result = buildPairedEvaluation({ root });

  assert.equal(result.schema_version, '1.0');
  assert.equal(result.comparison_kind, 'static_source_contract');
  assert.equal(result.baseline.source_commit, '180549f30a7579d5f4c2733ee662f64229531e78');
  assert.deepEqual(result.cases.map((item) => item.eval_id), [13, 14, 15, 16, 17, 18]);
  assert.ok(result.cases.every((item) => item.model_outputs_recorded === false));
  assert.ok(result.cases.every((item) => item.manual_review.length >= 3));
  assert.ok(result.cases.every((item) => item.static_assertions.length >= 1));
  assert.ok(result.cases.every((item) => !Object.hasOwn(item, 'new_model_output') && !Object.hasOwn(item, 'old_model_output')));
});

test('marks a static assertion failed when its current source evidence is missing', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(__dirname, 'paired-evaluation-missing-'));
  const current = path.join(fixtureRoot, 'healthy-fitness-coach');
  const baseline = path.join(fixtureRoot, 'healthy-fitness-coach-workspace', 'training-os-redesign', 'skill-snapshot');
  try {
    fs.mkdirSync(path.join(current, 'evals'), { recursive: true });
    fs.mkdirSync(path.join(current, 'references'), { recursive: true });
    fs.mkdirSync(path.join(baseline, 'evals'), { recursive: true });
    fs.mkdirSync(path.join(baseline, 'references'), { recursive: true });
    fs.copyFileSync(path.join(root, 'healthy-fitness-coach', 'evals', 'evals.json'), path.join(current, 'evals', 'evals.json'));
    fs.copyFileSync(path.join(root, 'healthy-fitness-coach-workspace', 'training-os-redesign', 'skill-snapshot', 'evals', 'evals.json'), path.join(baseline, 'evals', 'evals.json'));
    fs.copyFileSync(path.join(root, 'healthy-fitness-coach', 'references', 'training-dna-engine.js'), path.join(current, 'references', 'training-dna-engine.js'));
    fs.copyFileSync(path.join(root, 'healthy-fitness-coach-workspace', 'training-os-redesign', 'skill-snapshot', 'references', 'training-dna-engine.js'), path.join(baseline, 'references', 'training-dna-engine.js'));

    const result = buildPairedEvaluation({ root: fixtureRoot });
    const simpleQuestion = result.cases.find((item) => item.eval_id === 13).static_assertions.find((item) => item.id === 'simple_question_contract');
    assert.equal(simpleQuestion.current.present, false);
    assert.equal(simpleQuestion.status, 'fail');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('writes a self-contained review page and results without secrets, personal data, or photos', () => {
  const output = writePairedEvaluationArtifacts({ root });
  const resultText = fs.readFileSync(output.results_path, 'utf8');
  const page = fs.readFileSync(output.review_page_path, 'utf8');
  const blocked = /(?:api[_ -]?key|secret|access[_ -]?token|private[_ -]?key|data:image|<img\b)/iu;

  assert.match(page, /人工审查/u);
  assert.match(page, /13[–-]18/u);
  assert.match(page, /未记录模型输出/u);
  assert.doesNotMatch(resultText, blocked);
  assert.doesNotMatch(page, blocked);
  assert.equal(path.extname(output.review_page_path), '.html');
});
