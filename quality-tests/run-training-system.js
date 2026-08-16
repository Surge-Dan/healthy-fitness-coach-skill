const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const skill = path.join(root, 'healthy-fitness-coach');
const pluginSkill = path.join(root, 'healthy-fitness-coach-plugin', 'skills', 'healthy-fitness-coach');
const read = (file) => fs.readFileSync(path.join(skill, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const dna = read('references/training-dna.md');
const entry = read('SKILL.md');
const expectedAssets = [
  'assets/athlete-profile-template.md',
  'assets/training-dna-template.md',
  'assets/current-program-template.md',
  'assets/decision-log-template.md',
  'assets/exercise-playbook-template.md',
  'assets/progress-ledger-template.csv',
  'assets/dna-evidence-template.jsonl',
  'assets/dna-changelog-template.md',
];

for (const asset of expectedAssets) {
  assert(fs.existsSync(path.join(skill, asset)), `missing training-system asset: ${asset}`);
  assert(fs.existsSync(path.join(pluginSkill, asset)), `plugin copy missing training-system asset: ${asset}`);
}

for (const marker of ['Training Loop七步法', '八类训练DNA', '有氧反应DNA', '目标DNA', '依从DNA', 'DECISION_LOG.md', '事实', '推断', '未知']) {
  assert(dna.includes(marker), `training DNA reference missing marker: ${marker}`);
}
for (const marker of ['training-dna.md', 'TRAINING_DNA.md', 'CURRENT_PROGRAM.md', 'DECISION_LOG.md']) {
  assert(entry.includes(marker), `SKILL.md missing training-system routing marker: ${marker}`);
}
assert(fs.readFileSync(path.join(pluginSkill, 'SKILL.md'), 'utf8') === entry, 'plugin SKILL.md is out of sync');
assert(fs.readFileSync(path.join(pluginSkill, 'references', 'training-dna.md'), 'utf8') === dna, 'plugin training DNA reference is out of sync');
assert(fs.readFileSync(path.join(pluginSkill, 'references', 'training-dna-engine.js'), 'utf8') === fs.readFileSync(path.join(skill, 'references', 'training-dna-engine.js'), 'utf8'), 'plugin training DNA engine is out of sync');

console.log(`Training system quality gate passed (${expectedAssets.length} assets, routing and evidence markers verified).`);
