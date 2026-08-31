const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const protocolPath = path.join(__dirname, '..', 'references', 'creator-query-protocol.md');
const cardsPath = path.join(__dirname, '..', 'references', 'creator-cards.md');
const protocol = fs.existsSync(protocolPath) ? fs.readFileSync(protocolPath, 'utf8') : '';
const cards = fs.readFileSync(cardsPath, 'utf8');

function cardBlocks(markdown) {
  return markdown.split(/^## (?=\d+\.)/m).slice(1);
}

test('creator evidence protocol defines a bounded three-way answer gate', () => {
  assert.match(protocol, /可回答/);
  assert.match(protocol, /需要检索/);
  assert.match(protocol, /未知人物/);
  assert.match(protocol, /不把人物名气当作证据/);
  assert.match(protocol, /直接陈述/);
  assert.match(protocol, /二手转述/);
  assert.match(protocol, /推断/);
});

test('all 25 creator cards expose the auditable evidence fields', () => {
  const blocks = cardBlocks(cards);
  assert.equal(blocks.length, 25);
  const required = [
    '- 来源：',
    '- 来源内容摘要：',
    '- 来源映射：',
    '- 身份/商业披露：',
    '- 角色：',
    '- 可复用原则：',
    '- 适用：',
    '- 参数：',
    '- 证据等级：',
    '- 风险：',
    '- 冲突裁决：',
  ];
  for (const block of blocks) {
    for (const marker of required) assert.match(block, new RegExp(marker));
    assert.ok((block.match(/\]\(https?:\/\//g) || []).length >= 2, block.split(/\r?\n/, 1)[0]);
  }
});

test('research ledger states the coverage boundary instead of claiming exhaustive distillation', () => {
  const ledger = fs.readFileSync(path.join(__dirname, '..', 'references', 'research-ledger.md'), 'utf8');
  assert.match(ledger, /不是对25位创作者全部内容的穷尽式抓取/);
  assert.match(ledger, /不可访问|登录受限/);
});
