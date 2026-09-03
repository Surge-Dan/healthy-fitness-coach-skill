'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const canonical = path.join(root, 'healthy-fitness-coach');
const pluginRoot = path.join(root, 'healthy-fitness-coach-plugin');
const pluginSkill = path.join(pluginRoot, 'skills', 'healthy-fitness-coach');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listFiles(directory, relativeDirectory = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__pycache__' || entry.name === 'node_modules') continue;
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath, relativePath));
    else if (entry.isFile() && !/\.py[co]$/i.test(entry.name)) files.push(relativePath);
  }
  return files.sort();
}

function assertSameFile(sourceRelative, targetRelative = sourceRelative) {
  const source = path.join(canonical, sourceRelative);
  const target = path.join(pluginSkill, targetRelative);
  assert.ok(fs.existsSync(source), `canonical source missing: ${sourceRelative}`);
  assert.ok(fs.existsSync(target), `plugin copy missing: ${targetRelative}`);
  assert.equal(sha256(target), sha256(source), `plugin copy out of sync: ${sourceRelative}`);
}

const canonicalSkillFiles = [
  'SKILL.md',
  'agents/openai.yaml',
  'evals/evals.json',
  ...listFiles(path.join(canonical, 'assets'), 'assets'),
  ...listFiles(path.join(canonical, 'references'), 'references')
];
for (const relative of canonicalSkillFiles) assertSameFile(relative);

// Plugin root scripts intentionally rewrite the relative import prefix so they
// resolve through skills/healthy-fitness-coach/references when copied alone.
const canonicalScripts = listFiles(path.join(canonical, 'scripts'), 'scripts');
for (const relative of canonicalScripts) {
  const source = fs.readFileSync(path.join(canonical, relative), 'utf8');
  const expected = source.replaceAll('../references/', '../skills/healthy-fitness-coach/references/');
  const target = path.join(pluginRoot, relative);
  assert.ok(fs.existsSync(target), `plugin CLI script missing: ${relative}`);
  assert.equal(fs.readFileSync(target, 'utf8'), expected, `plugin CLI script out of sync: ${relative}`);
}

// Every local path advertised by the canonical entry must survive a standalone
// Plugin copy; this catches stale references and layout-only assumptions.
const pathTokens = new Set();
for (const relative of canonicalSkillFiles.filter((file) => file.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(canonical, relative), 'utf8');
  for (const code of text.matchAll(/`([^`]+)`/g)) {
    for (const match of code[1].matchAll(/(?:assets|references|scripts)\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*/g)) {
      pathTokens.add(match[0]);
    }
  }
}
for (const relative of pathTokens) {
  const base = relative.startsWith('scripts/') ? pluginRoot : pluginSkill;
  assert.ok(fs.existsSync(path.join(base, relative)), `plugin local reference missing: ${relative}`);
}

const copied = fs.mkdtempSync(path.join(os.tmpdir(), 'healthy-fitness-coach-plugin-'));
try {
  fs.cpSync(pluginRoot, copied, {
    recursive: true,
    filter: (source) => !['node_modules', '.tmp-preview', 'fitness-reports'].includes(path.basename(source))
  });
  const copiedSkill = path.join(copied, 'skills', 'healthy-fitness-coach');
  for (const relative of listFiles(path.join(copiedSkill, 'references'), 'references').filter((file) => file.endsWith('.js'))) {
    require(path.join(copiedSkill, relative));
  }
  const dnaInput = path.join(copied, 'dna-smoke-input.json');
  const dnaOutput = path.join(copied, 'dna-smoke-output.json');
  fs.writeFileSync(dnaInput, JSON.stringify({
    review_facts: { data_range: { start: '2026-01-01', end: '2026-01-07' }, quality: { status: 'complete' }, performance: { points: [], comparisons: [] }, recovery: { status: 'not_confirmed', observations: [] } },
    review_decision: { keep: ['Plugin DNA CLI smoke'], changes: [] }
  }));
  execFileSync(process.execPath, [path.join(copied, 'scripts', 'extract-training-dna.js'), '--input', dnaInput, '--output', dnaOutput], { encoding: 'utf8' });
  const dna = JSON.parse(fs.readFileSync(dnaOutput, 'utf8'));
  assert.equal(dna.schema_version, '1.0', 'copied Plugin DNA CLI must emit the versioned schema');
  assert.deepEqual(dna.decision_ledger[0].keep, ['Plugin DNA CLI smoke']);
  const recipes = execFileSync(process.execPath, [path.join(copied, 'scripts', 'compile-visual-brief.js'), '--list-recipes'], { encoding: 'utf8' });
  assert.equal(JSON.parse(recipes).length, 12, 'copied Plugin CLI must load all visual recipes');
  const modes = execFileSync(process.execPath, [path.join(copied, 'scripts', 'render-visual-assets.js'), '--list-modes'], { encoding: 'utf8' });
  assert.ok(JSON.parse(modes).length >= 1, 'copied Plugin CLI must load visual modes');
} finally {
  fs.rmSync(copied, { recursive: true, force: true });
}

process.stdout.write(`PASS plugin sync: ${canonicalSkillFiles.length} Skill files and ${canonicalScripts.length} CLI scripts are synchronized; copied-path smoke passed.\n`);
