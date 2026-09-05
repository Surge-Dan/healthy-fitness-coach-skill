'use strict';

const fs = require('node:fs');
const path = require('node:path');

const COMMIT = 'aac599224bb9780305239607ef98540b7e0ce389';
const REPOSITORY = 'https://github.com/bryllim/workout-guide';
const RAW_BASE = `https://raw.githubusercontent.com/bryllim/workout-guide/${COMMIT}/packages/workout-guide`;
const CATALOG_PATH = path.join(__dirname, '..', 'assets', 'workout-guide-catalog.json');

const aliases = {
  '杠铃卧推': 'bench-press', '上斜杠铃卧推': 'incline-bench-press', '下斜杠铃卧推': 'decline-bench-press',
  '哑铃卧推': 'dumbbell-bench-press', '俯卧撑': 'push-up', '杠铃推举': 'overhead-press',
  '哑铃侧平举': 'lateral-raise', '高位下拉': 'lat-pulldown', '引体向上': 'pull-up',
  '杠铃划船': 'barbell-row', '单臂哑铃划船': 'one-arm-dumbbell-row', '坐姿绳索划船': 'seated-row',
  '杠铃深蹲': 'squat', '高脚杯深蹲': 'goblet-squat', '哈克深蹲': 'hack-squat',
  '腿举': 'leg-press', '保加利亚分腿蹲': 'bulgarian-split-squat', '行走弓步': 'walking-lunge',
  '传统硬拉': 'deadlift', '罗马尼亚硬拉': 'romanian-deadlift', '杠铃臀推': 'hip-thrust',
  '臀桥': 'glute-bridge', '平板支撑': 'plank', '侧平板支撑': 'side-plank',
  '卷腹': 'crunch', '反向卷腹': 'reverse-crunch', '俄罗斯转体': 'russian-twist',
  '哑铃弯举': 'bicep-curl', '锤式弯举': 'hammer-curl', '窄握卧推': 'close-grip-bench-press'
};
const broadAliases = {
  '卧推': ['bench-press', 'incline-bench-press', 'decline-bench-press', 'dumbbell-bench-press', 'smith-machine-bench-press'],
  '划船': ['barbell-row', 't-bar-row', 'dumbbell-bent-over-row', 'one-arm-dumbbell-row', 'chest-supported-row', 'seated-row', 'machine-row', 'inverted-row', 'single-arm-cable-row'],
  '深蹲': ['squat', 'front-squat', 'goblet-squat', 'hack-squat', 'smith-machine-squat', 'bodyweight-squat'],
  '硬拉': ['deadlift', 'romanian-deadlift', 'sumo-deadlift', 'trap-bar-deadlift', 'dumbbell-romanian-deadlift'],
  '下拉': ['lat-pulldown', 'close-grip-lat-pulldown', 'wide-grip-lat-pulldown', 'straight-arm-pulldown', 'banded-lat-pulldown']
};

const CHINESE_ALIASES = new Map(Object.entries(aliases));
let cachedCatalog;

function normalize(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/[\s_]+/g, '-') : '';
}

function catalog() {
  if (!cachedCatalog) cachedCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  return cachedCatalog;
}

function bySlug(slug) {
  return catalog().exercises.find((exercise) => exercise.slug === slug);
}

function compact(exercise) {
  return { id: exercise.id, slug: exercise.slug, name: exercise.name, equipment: exercise.equipment, muscles: exercise.muscles };
}

function renderSource(source) {
  return `[${source.name}](${source.url})（${source.license}）${source.changes ? `，处理说明：${source.changes}` : ''}`;
}

function matchExercise(query) {
  const raw = typeof query === 'string' ? query.normalize('NFKC').trim() : '';
  if (!raw || raw.length > 120) return { status: 'no_match', query: raw };
  if (Object.hasOwn(broadAliases, raw)) return { status: 'ambiguous', query: raw, candidates: broadAliases[raw].map(bySlug).filter(Boolean).map(compact) };
  const aliasSlug = CHINESE_ALIASES.get(raw);
  if (aliasSlug) return { status: 'match', query: raw, titleZh: raw, exercise: bySlug(aliasSlug) };
  const key = normalize(raw);
  const exact = catalog().exercises.find((exercise) =>
    normalize(exercise.id) === key || normalize(exercise.slug) === key || normalize(exercise.name) === key);
  return exact ? { status: 'match', query: raw, exercise: exact } : { status: 'no_match', query: raw };
}

function renderExerciseCard(query) {
  const result = matchExercise(query);
  if (result.status !== 'match') throw new Error('请先明确动作：歧义或未知动作不能生成图卡。');
  const exercise = result.exercise;
  const title = result.titleZh || [...CHINESE_ALIASES].find(([, slug]) => slug === exercise.slug)?.[0] || exercise.name;
  const frames = exercise.frames.slice().sort((a, b) => a.index - b.index).map((frame) =>
    `![${title} 第 ${frame.index} 帧](${RAW_BASE}/${frame.displayPath})`).join('\n\n');
  const sourcePage = `${REPOSITORY}/tree/${COMMIT}/packages/workout-guide/assets/${exercise.slug}`;
  const sourceLines = [];
  if (exercise.attribution.source) sourceLines.push(`- 动作级来源：${renderSource(exercise.attribution.source)}`);
  for (const frame of exercise.frames) {
    if (frame.attribution.source) sourceLines.push(`- 第 ${frame.index} 帧来源：${renderSource(frame.attribution.source)}`);
  }
  const derivative = sourceLines.length ? `\n\n上游衍生来源：\n${sourceLines.join('\n')}` : '';
  return `# ${title}\n\n- 原始动作名：${exercise.name}\n- 器械：${exercise.equipment}\n- 主要肌群：${exercise.muscles.primary}\n\n${frames}\n\n> 图片加载失败时仍可按文字识别动作，并打开[固定版本源页](${sourcePage})。这些静态示意图用于动作识别与顺序参考，不代表对用户动作质量的评估。\n\n图片署名：${exercise.attribution.creator}；许可：[CC BY-SA 4.0](${exercise.attribution.licenseUrl})。${derivative}\n\n图卡基于 workout-guide 固定提交 \`${COMMIT}\` 按需引用，未在发布包内复制图片。`;
}

module.exports = { matchExercise, renderExerciseCard, constants: { COMMIT, RAW_BASE, REPOSITORY, CHINESE_ALIASES } };
