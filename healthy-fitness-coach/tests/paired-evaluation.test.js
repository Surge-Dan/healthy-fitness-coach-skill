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
