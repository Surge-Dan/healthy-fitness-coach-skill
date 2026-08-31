const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const baseCommit = '180549f30a7579d5f4c2733ee662f64229531e78';
const evalPath = path.join(root, 'healthy-fitness-coach', 'evals', 'evals.json');
const snapshotRoot = path.join(root, 'healthy-fitness-coach-workspace', 'training-os-redesign', 'skill-snapshot');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listSnapshotFiles(directory, relativeDirectory = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `快照不得包含符号链接：${relativePath}`);
    if (entry.isDirectory()) {
      files.push(...listSnapshotFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

const blockedSnapshotPath = /(^|\/)(?:\.cache|\.pytest_cache|node_modules|__pycache__|fitness-reports|personal-reports|user-reports|client-reports)(?:\/|$)|(^|\/)(?:personal|user|client|athlete)[-_ ]?(?:report|reports)(?:[-_.\/]|$)|\.(?:pyc|pyo|png|jpe?g|gif|webp|heic|heif|avif|tiff?)$/i;
const blockedSnapshotContent = /(?:^|[^A-Za-z0-9_])(?:[A-Za-z0-9]+_)*(?:api[_ -]?key|secret|access[_ -]?token|private[_ -]?key)\s*(?:[:=]|is)\s*['"]?[A-Za-z0-9][A-Za-z0-9_./+=-]{7,}/i;

function assertSafeSnapshotFile(relativePath, contents) {
  assert.ok(!blockedSnapshotPath.test(relativePath), `快照包含禁止的报告、缓存或照片文件：${relativePath}`);
  assert.ok(!blockedSnapshotContent.test(contents), `快照包含疑似 API Key 或秘密：${relativePath}`);
}

assert.throws(
  () => assertSafeSnapshotFile('snapshot-manifest.json', 'OPENAI_API_KEY=sk-example-12345678'),
  /疑似 API Key 或秘密/,
  '秘密门禁必须拒绝 manifest 中的前缀型 API Key 环境变量'
);

const current = readJson(evalPath);
assert.equal(current.evals.length, 18, '评测总数必须是保留的12条加6条训练操作系统差异评测');
assert.deepEqual(current.evals.slice(0, 12).map((item) => item.id), Array.from({ length: 12 }, (_, index) => index + 1), '原12条评测必须保留且顺序不变');

const newCases = current.evals.slice(12);
assert.deepEqual(newCases.map((item) => item.id), [13, 14, 15, 16, 17, 18], '新增评测必须使用连续ID 13至18');

const completePlanCase = newCases.find((item) => item.id === 15);
assert.match(completePlanCase.prompt, /\d+\s*岁/, '信息完整的新手计划必须给出年龄范围');
assert.match(completePlanCase.prompt, /每周\s*\d+\s*天/, '信息完整的新手计划必须给出每周训练天数');
assert.match(completePlanCase.prompt, /每次\s*\d+\s*分钟/, '信息完整的新手计划必须给出单次训练时长');
assert.match(completePlanCase.prompt, /动作限制[：:]\s*(?:无|没有)/, '信息完整的新手计划必须明确动作限制');

const requirements = new Map([
  [13, { followUp: false, markers: ['RIR', '不得强制建档'] }],
  [14, { followUp: true, markers: ['关键缺口', '集中询问'] }],
  [15, { followUp: false, markers: ['画像', '当前计划'] }],
  [16, { followUp: true, markers: ['已有档案', '今日状态'] }],
  [17, { followUp: false, markers: ['四周', '1～2个主要变量', '决策记录'] }],
  [18, { followUp: false, markers: ['训练 DNA', '低置信度'] }]
]);

for (const item of newCases) {
  assert.ok(Array.isArray(item.expected_assets) && item.expected_assets.length > 0, `评测 ${item.id} 必须声明预期资产`);
  assert.ok(Array.isArray(item.content_boundaries) && item.content_boundaries.length > 0, `评测 ${item.id} 必须声明内容边界`);
  assert.ok(Array.isArray(item.prohibited_behaviors) && item.prohibited_behaviors.length > 0, `评测 ${item.id} 必须声明禁止行为`);
  assert.equal(typeof item.requires_follow_up, 'boolean', `评测 ${item.id} 必须声明是否应追问`);
  const { followUp, markers } = requirements.get(item.id);
  assert.equal(item.requires_follow_up, followUp, `评测 ${item.id} 的追问预期错误`);
  const searchable = JSON.stringify(item);
  for (const marker of markers) {
    assert.ok(searchable.includes(marker), `评测 ${item.id} 缺少差异化约束：${marker}`);
  }
}
assert.ok(newCases.some((item) => item.requires_follow_up), '新增评测必须覆盖应追问');
assert.ok(newCases.some((item) => !item.requires_follow_up), '新增评测必须覆盖不应追问');

assert.ok(fs.existsSync(snapshotRoot), '缺少改造前 Skill 快照');
const manifestPath = path.join(snapshotRoot, 'snapshot-manifest.json');
assert.ok(fs.existsSync(manifestPath), '快照必须带可审计清单');
const manifest = readJson(manifestPath);
assert.equal(manifest.source_commit, baseCommit, '快照必须锚定任务起点提交');
assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0, '快照清单不能为空');

const manifestFiles = manifest.files.map((entry) => entry.path).sort();
assert.equal(new Set(manifestFiles).size, manifestFiles.length, '快照清单不得包含重复路径');
const allSnapshotFiles = listSnapshotFiles(snapshotRoot).sort();
assert.ok(allSnapshotFiles.includes('snapshot-manifest.json'), '完整快照安全扫描必须包含 manifest');
for (const relativePath of allSnapshotFiles) {
  const snapshotFile = path.join(snapshotRoot, relativePath);
  assertSafeSnapshotFile(relativePath, fs.readFileSync(snapshotFile, 'utf8'));
}
const actualFiles = allSnapshotFiles.filter((entry) => entry !== 'snapshot-manifest.json');
assert.deepEqual(actualFiles, manifestFiles, '快照实际文件必须与清单完全一致，禁止清单外文件');

for (const entry of manifest.files) {
  const snapshotFile = path.join(snapshotRoot, entry.path);
  assert.ok(fs.existsSync(snapshotFile), `快照缺少清单文件：${entry.path}`);
  assert.equal(sha256(snapshotFile), entry.sha256, `快照文件哈希不匹配：${entry.path}`);
  const baseContents = execFileSync('git', ['show', `${baseCommit}:healthy-fitness-coach/${entry.path}`], { cwd: root });
  assert.deepEqual(fs.readFileSync(snapshotFile), baseContents, `快照不是起点提交内容：${entry.path}`);
}

assert.deepEqual(readJson(path.join(snapshotRoot, 'evals', 'evals.json')).evals, current.evals.slice(0, 12), '快照必须保留原始12条评测，主评测仅能追加新条目');
console.log(`PASS training-os baseline: ${manifest.files.length} snapshot files; 12 legacy evals + 6 redesign evals`);
