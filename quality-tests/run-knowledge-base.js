'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const cards = readFileSync(join(root, 'healthy-fitness-coach', 'references', 'creator-cards.md'), 'utf8');
const domains = readFileSync(join(root, 'healthy-fitness-coach', 'references', 'training-domains.md'), 'utf8');
const researchLedger = readFileSync(join(root, 'healthy-fitness-coach', 'references', 'research-ledger.md'), 'utf8');
const visualLedger = readFileSync(join(root, 'healthy-fitness-coach', 'references', 'visual-reference-ledger.md'), 'utf8');
const skill = readFileSync(join(root, 'healthy-fitness-coach', 'SKILL.md'), 'utf8');
const pluginSkillRoot = join(root, 'healthy-fitness-coach-plugin', 'skills', 'healthy-fitness-coach');

const headings = [...cards.matchAll(/^## (\d+)\. /gmu)].map((match) => Number(match[1]));
assert.equal(headings.length, 25, 'creator-cards must contain 25 numbered source cards');
assert.deepEqual(headings, Array.from({ length: 25 }, (_, index) => index + 1));

for (const term of ['有氧基础', '阈值/节奏', '高强度间歇', '阻力/无氧训练', '功率/爆发', '混合训练']) {
  assert.match(domains, new RegExp(term.replace('/', '\\/')));
}
for (const source of ['Mike Israetel', 'Brad Schoenfeld', 'Stephen Seiler', 'Dr. Stacy Sims', 'Greg Lehman', 'Jason Koop']) {
  assert.match(cards, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(skill, /training-domains\.md/);
assert.match(researchLedger, /primary-verified/);
assert.match(researchLedger, /restricted/);
assert.match(visualLedger, /视觉DNA层/);
assert.equal(readFileSync(join(pluginSkillRoot, 'references', 'research-ledger.md'), 'utf8'), researchLedger);
assert.equal(readFileSync(join(pluginSkillRoot, 'references', 'visual-reference-ledger.md'), 'utf8'), visualLedger);
process.stdout.write('Knowledge base: 25 source cards, six training domains, and evidence ledgers passed\n');
