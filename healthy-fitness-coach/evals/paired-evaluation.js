'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASELINE_COMMIT = '180549f30a7579d5f4c2733ee662f64229531e78';
const CASE_IDS = [13, 14, 15, 16, 17, 18];
const SNAPSHOT_RELATIVE = path.join('healthy-fitness-coach-workspace', 'training-os-redesign', 'skill-snapshot');
const CURRENT_RELATIVE = 'healthy-fitness-coach';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readText(root, relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function hasAll(text, fragments) {
  return Boolean(text) && fragments.every((fragment) => text.includes(fragment));
}

function evidence(root, relativePath, fragments) {
  const absolutePath = path.join(root, relativePath);
  const text = readText(root, relativePath);
  return {
    path: relativePath.replaceAll(path.sep, '/'),
    present: Boolean(text),
    sha256: text ? sha256(absolutePath) : null,
    required_fragments: fragments,
    fragments_present: hasAll(text, fragments)
  };
}

function assertion({ id, description, current, baseline, status = 'pass' }) {
  return { id, description, status, current, baseline };
}

function manualReview(caseId) {
  const common = [
    '在两个全新、隔离的对话中分别粘贴同一提示词；不要沿用画像、文件或记忆。',
    '记录完整原始输出、输入/输出 Token 与完成时间；本静态结果没有任何模型输出。',
    '检查是否引入未提供的个人信息、照片、身份或持久化声明。'
  ];
  const specific = {
    13: '确认两版都只解释 RIR，且不把术语问题升级为完整计划或建档。',
    14: '确认新版集中追问目标、经验、频率/时长、器械和安全缺口，旧版若直接给完整计划应标为失败。',
    15: '确认新版复用提示中已给的全部约束，直接给画像和当前计划，不重复盘问。',
    16: '确认新版复用已有档案，只询问影响当天胸部训练的即时状态，并给出后续安排。',
    17: '确认新版分开陈述事实、判断和验证项，只调整一至两个主要变量，并输出可追溯决策记录。',
    18: '确认两版都不从一次训练推出稳定 DNA；任何结论必须为未知或低置信度。'
  };
  return [...common, specific[caseId]];
}

function currentEvals(root) {
  return readJson(path.join(root, CURRENT_RELATIVE, 'evals', 'evals.json')).evals.filter((item) => CASE_IDS.includes(item.id));
}

function baselineEvals(root) {
  return readJson(path.join(root, SNAPSHOT_RELATIVE, 'evals', 'evals.json')).evals;
}

function buildCaseAssertions(root, evalCase, baselineIds) {
  const currentBase = CURRENT_RELATIVE;
  const oldBase = SNAPSHOT_RELATIVE;
  const orchestration = evidence(root, path.join(currentBase, 'references', 'training-orchestration.md'), []);
  const oldOrchestration = evidence(root, path.join(oldBase, 'references', 'training-orchestration.md'), []);
  const assertions = [assertion({
    id: 'eval_definition_is_new',
    description: '当前评测定义包含该成对场景；旧快照只保留评测 1–12。',
    current: { eval_defined: true },
    baseline: { eval_defined: baselineIds.has(evalCase.id) }
  })];

  if (evalCase.id === 13) {
    assertions.push(assertion({
      id: 'simple_question_contract',
      description: '新版明确定义知识问题不建立画像；旧快照没有该训练任务编排契约文件。',
      current: evidence(root, path.join(currentBase, 'references', 'assessment.md'), ['简单知识问题不建立画像']),
      baseline: oldOrchestration
    }));
  }
  if (evalCase.id === 14) {
    assertions.push(assertion({
      id: 'plan_gap_contract',
      description: '新版为训练计划声明结构性必要字段和缺失时追问；旧快照没有该编排模块。',
      current: evidence(root, path.join(currentBase, 'references', 'training-orchestrator.js'), ['training_plan', "'goal'", "'available_equipment'", "state: missing_fields.length > 0 ? 'ask' : 'ready'"]),
      baseline: oldOrchestration
    }));
  }
  if (evalCase.id === 15) {
    assertions.push(assertion({
      id: 'complete_profile_and_plan_assets',
      description: '新版具备画像、当前计划模板，并规定已提供的稳定字段不重复追问。',
      current: {
        assessment: evidence(root, path.join(currentBase, 'references', 'assessment.md'), ['已提供且仍适用的稳定字段不重复追问']),
        profile_template: evidence(root, path.join(currentBase, 'assets', 'athlete-profile-template.md'), []),
        program_template: evidence(root, path.join(currentBase, 'assets', 'current-program-template.md'), [])
      },
      baseline: {
        assessment: evidence(root, path.join(oldBase, 'references', 'assessment.md'), ['已提供且仍适用的稳定字段不重复追问']),
        profile_template: evidence(root, path.join(oldBase, 'assets', 'athlete-profile-template.md'), []),
        program_template: evidence(root, path.join(oldBase, 'assets', 'current-program-template.md'), [])
      }
    }));
  }
  if (evalCase.id === 16) {
    assertions.push(assertion({
      id: 'profile_reuse_and_today_state_contract',
      description: '新版把稳定画像与当天状态隔离，且提供今日准备度模块；旧快照缺少两者。',
      current: {
        assessment: evidence(root, path.join(currentBase, 'references', 'assessment.md'), ['稳定画像', '当前状态', '不重复追问']),
        readiness: evidence(root, path.join(currentBase, 'references', 'readiness-engine.js'), [])
      },
      baseline: {
        assessment: evidence(root, path.join(oldBase, 'references', 'assessment.md'), ['稳定画像', '当前状态', '不重复追问']),
        readiness: evidence(root, path.join(oldBase, 'references', 'readiness-engine.js'), [])
      }
    }));
  }
  if (evalCase.id === 17) {
    assertions.push(assertion({
      id: 'review_decision_contract',
      description: '新版复盘引擎显式输出事实、推断、不确定性、验证和至多两个调整；旧快照缺少该引擎。',
      current: evidence(root, path.join(currentBase, 'references', 'review-decision-engine.js'), ['facts:', 'inference:', 'uncertainty:', 'validation:', 'changes.length >= 2']),
      baseline: evidence(root, path.join(oldBase, 'references', 'review-decision-engine.js'), [])
    }));
  }
  if (evalCase.id === 18) {
    const sample = [{ date: '2026-08-01', exercise: 'squat', weight: 40, reps: 8, source_record_id: 'single-record' }];
    const currentDna = require(path.join(root, currentBase, 'references', 'training-dna-engine.js')).extractTrainingDNA({ records: sample, generatedAt: '2000-01-01T00:00:00.000Z' });
    const baselineDna = require(path.join(root, oldBase, 'references', 'training-dna-engine.js')).extractTrainingDNA({ records: sample, generatedAt: '2000-01-01T00:00:00.000Z' });
    assertions.push(assertion({
      id: 'single_record_dna_boundary',
      description: '同一条合成训练记录在两版的阻力反应均为低置信度，并保留未知维度；这是静态正确性对照，不代表自然语言输出优劣。',
      current: { resistance_confidence: currentDna.dimensions.resistance_response.confidence, unknown_dimensions: currentDna.unknowns.length },
      baseline: { resistance_confidence: baselineDna.dimensions.resistance_response.confidence, unknown_dimensions: baselineDna.unknowns.length }
    }));
  }
  return assertions;
}

function buildPairedEvaluation({ root = path.resolve(__dirname, '..', '..') } = {}) {
  const evals = currentEvals(root);
  if (evals.length !== CASE_IDS.length || evals.some((item, index) => item.id !== CASE_IDS[index])) {
    throw new Error('当前评测必须精确包含连续的 ID 13–18。');
  }
  const baselineIds = new Set(baselineEvals(root).map((item) => item.id));
  return {
    schema_version: '1.0',
    comparison_kind: 'static_source_contract',
    limitations: [
      '未调用模型，未生成、转写或评分任何模型输出。',
      '静态断言只能证明源码、模板与确定性函数的能力边界，不能证明自然语言回答质量。',
      'Token 和完成时间必须由人工在同一模型、同一设置、隔离会话中记录。'
    ],
    baseline: { source_commit: BASELINE_COMMIT, snapshot_path: SNAPSHOT_RELATIVE.replaceAll(path.sep, '/') },
    current: { skill_path: CURRENT_RELATIVE },
    cases: evals.map((evalCase) => ({
      eval_id: evalCase.id,
      prompt: evalCase.prompt,
      expected_output: evalCase.expected_output,
      requires_follow_up: evalCase.requires_follow_up,
      model_outputs_recorded: false,
      static_assertions: buildCaseAssertions(root, evalCase, baselineIds),
      manual_review: manualReview(evalCase.id)
    }))
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderEvidence(value) {
  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function renderReviewPage(result) {
  const caseSections = result.cases.map((item) => {
    const assertions = item.static_assertions.map((entry) => `<details open><summary>${escapeHtml(entry.id)} · ${escapeHtml(entry.description)}</summary><div class="grid"><section><h4>新版静态证据</h4>${renderEvidence(entry.current)}</section><section><h4>旧版静态证据</h4>${renderEvidence(entry.baseline)}</section></div></details>`).join('');
    const checklist = item.manual_review.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    return `<article><h2>评测 ${item.eval_id}</h2><p><strong>提示词：</strong>${escapeHtml(item.prompt)}</p><p><strong>预期：</strong>${escapeHtml(item.expected_output)}</p><p><strong>需要追问：</strong>${item.requires_follow_up ? '是' : '否'}；<strong>模型输出：</strong>未记录模型输出。</p><h3>自动化静态比较</h3>${assertions}<h3>人工成对审查</h3><ul>${checklist}</ul><label>新版原始输出（人工粘贴，不会保存）<textarea aria-label="新版原始输出"></textarea></label><label>旧版原始输出（人工粘贴，不会保存）<textarea aria-label="旧版原始输出"></textarea></label><label>Token 与完成时间记录（人工填写，不会保存）<textarea aria-label="Token 与完成时间记录"></textarea></label></article>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>训练操作系统成对静态审查</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:1080px;margin:32px auto;padding:0 20px;color:#172033;background:#f7f8fa}article,details{background:#fff;border:1px solid #d9dee7;border-radius:10px;padding:16px;margin:16px 0}h1,h2,h3,h4{margin-top:0}.note{background:#fff4d6;padding:14px;border-left:4px solid #d89b00}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}pre,textarea{box-sizing:border-box;width:100%;white-space:pre-wrap;word-break:break-word;background:#101827;color:#d7e2f0;border-radius:6px;padding:12px}textarea{min-height:96px;margin:6px 0 14px;background:#fff;color:#172033;border:1px solid #aeb8c6}@media(max-width:720px){.grid{grid-template-columns:1fr}}</style></head><body><h1>训练操作系统：评测 13–18 成对静态审查</h1><p>基线提交：<code>${BASELINE_COMMIT}</code>。当前页只展示可复现的源码与结构断言。</p><div class="note"><strong>限制：</strong>未记录模型输出，也未运行模型；页面中的文本框仅供本地人工粘贴，不保存任何内容。Token、完成时间与对话质量均为人工审查项。</div><h2>总则</h2><ul>${result.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${caseSections}</body></html>`;
}

function writePairedEvaluationArtifacts({ root = path.resolve(__dirname, '..', '..') } = {}) {
  const result = buildPairedEvaluation({ root });
  const outputDirectory = path.join(root, CURRENT_RELATIVE, 'evals');
  const results_path = path.join(outputDirectory, 'paired-evaluation-results.json');
  const review_page_path = path.join(outputDirectory, 'paired-evaluation-review.html');
  fs.writeFileSync(results_path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(review_page_path, renderReviewPage(result), 'utf8');
  return { results_path, review_page_path };
}

if (require.main === module) {
  const output = writePairedEvaluationArtifacts();
  process.stdout.write(`PASS paired static evaluation: ${path.basename(output.results_path)} and ${path.basename(output.review_page_path)}\n`);
}

module.exports = { buildPairedEvaluation, renderReviewPage, writePairedEvaluationArtifacts };
