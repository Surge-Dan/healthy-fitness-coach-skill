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

for (const failureMode of ['missing file', 'missing fragment', 'nested missing file']) {
test(`marks JSON and HTML failed for ${failureMode}`, () => {
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

    if (failureMode === 'missing fragment') {
      fs.writeFileSync(path.join(current, 'references', 'assessment.md'), 'Synthetic assessment without required contract.');
    }
    if (failureMode === 'nested missing file') {
      fs.writeFileSync(path.join(current, 'references', 'assessment.md'), '已提供且仍适用的稳定字段不重复追问');
      fs.mkdirSync(path.join(current, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(current, 'assets', 'athlete-profile-template.md'), 'Synthetic profile');
    }
    const output = writePairedEvaluationArtifacts({ root: fixtureRoot });
    const result = JSON.parse(fs.readFileSync(output.results_path, 'utf8'));
    const assertionId = failureMode === 'nested missing file' ? 'complete_profile_and_plan_assets' : 'simple_question_contract';
    const entry = result.cases.flatMap((item) => item.static_assertions).find((item) => item.id === assertionId);
    assert.equal(entry.status, 'fail');
    if (failureMode === 'missing fragment') {
      assert.equal(entry.current.present, true);
      assert.equal(entry.current.fragments_present, false);
    } else if (failureMode === 'nested missing file') {
      assert.equal(entry.current.assessment.fragments_present, true);
      assert.equal(entry.current.profile_template.present, true);
      assert.equal(entry.current.program_template.present, false);
    } else {
      assert.equal(entry.current.present, false);
    }
    const page = fs.readFileSync(output.review_page_path, 'utf8');
    assert.match(page, new RegExp(`<summary><span class="status fail">FAIL</span> ${assertionId}`));
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
}

test('writes a self-contained review page and results without secrets, personal data, or photos', () => {
  const output = writePairedEvaluationArtifacts({ root });
  const resultText = fs.readFileSync(output.results_path, 'utf8');
  const page = fs.readFileSync(output.review_page_path, 'utf8');
  const blocked = /(?:api[_ -]?key|secret|access[_ -]?token|private[_ -]?key|data:image|<img\b)/iu;

  assert.match(page, /人工审查/u);
  assert.match(page, /13[–-]18/u);
  assert.match(page, /未记录模型输出/u);
  assert.match(page, /<span class="status pass">PASS<\/span>/);
  assert.doesNotMatch(resultText, blocked);
  assert.doesNotMatch(page, blocked);
  assert.equal(path.extname(output.review_page_path), '.html');
});
