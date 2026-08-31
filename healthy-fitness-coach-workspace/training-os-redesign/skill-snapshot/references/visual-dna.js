'use strict';

const RATIO_PRESETS = new Set(['1:1', '3:4', '9:16']);

const RECIPE_CATALOG = Object.freeze([
  Object.freeze({ id: 'star-trail-collage', name: '星轨训练拼贴', input: ['single-photo', 'multi-photo', 'photo-data'], grammar: 'star-scrapbook-collage', requires_photo: true, derived_style: 'premium gym scrapbook with tactile collage, sticker stars and hand annotations', preservation: 'high', description: '让照片成为主角，用错位裁切、贴纸星标和手写轨迹做成可分享的训练拼贴。' }),
  Object.freeze({ id: 'sketch-diptych', name: '原图×运动速写', input: ['single-photo', 'photo-data'], grammar: 'split-diptych', requires_photo: true, derived_style: 'expressive ink and graphite sports sketch', preservation: 'high', description: '保留原图，同时把姿态、灯光和器械转译成手绘层。' }),
  Object.freeze({ id: 'motion-comic', name: '训练漫画分镜', input: ['single-photo', 'multi-photo', 'photo-data'], grammar: 'comic-sequence', requires_photo: true, derived_style: 'clean contemporary sports comic with motion strokes', preservation: 'high', description: '用局部裁切、分镜和速度线重组训练瞬间。' }),
  Object.freeze({ id: 'risograph-zine', name: '双色训练小志', input: ['single-photo', 'multi-photo', 'photo-data'], grammar: 'print-zine', requires_photo: true, derived_style: 'two-color risograph, paper grain, imperfect registration', preservation: 'medium', description: '用双色套印、网点与纸张肌理形成独立小志。' }),
  Object.freeze({ id: 'symbol-lab', name: '健身符号实验室', input: ['single-photo', 'multi-photo', 'photo-data'], grammar: 'symbol-system', requires_photo: true, derived_style: 'abstract geometric system derived from observed gym objects', preservation: 'high', description: '把真实器械和空间形态编译成专属符号。' }),
  Object.freeze({ id: 'minimal-trajectory', name: '极简身体轨迹', input: ['single-photo', 'photo-data'], grammar: 'minimal-field', requires_photo: true, derived_style: 'minimal editorial line art with one kinetic trajectory', preservation: 'high', description: '高留白、单一运动轨迹和极少真实信息。' }),
  Object.freeze({ id: 'multi-photo-storyboard', name: '多图训练故事板', input: ['multi-photo'], grammar: 'storyboard-grid', requires_photo: true, derived_style: 'editorial contact sheet with hand-drawn connective marks', preservation: 'high', description: '按动作或时间把多张照片组织成训练叙事。' }),
  Object.freeze({ id: 'data-atlas', name: '训练数据图谱', input: ['data-only'], grammar: 'information-atlas', requires_photo: false, derived_style: 'precise editorial information design', preservation: 'none', description: '趋势、全年热力、部位分布和主动作表现。' }),
  Object.freeze({ id: 'training-rings', name: '训练年轮', input: ['data-only'], grammar: 'concentric-time', requires_photo: false, derived_style: 'concentric temporal data art', preservation: 'none', description: '把频率、容量和连续性编码成训练年轮。' }),
  Object.freeze({ id: 'muscle-constellation', name: '肌群星座', input: ['data-only'], grammar: 'network-constellation', requires_photo: false, derived_style: 'anatomy-inspired constellation diagram', preservation: 'none', description: '把训练部位和容量变成节点与连线。' }),
  Object.freeze({ id: 'strength-terrain', name: '力量地形', input: ['data-only'], grammar: 'topographic-field', requires_photo: false, derived_style: 'topographic training load landscape', preservation: 'none', description: '把周/月训练量变成等高线和地形。' }),
  Object.freeze({ id: 'action-fingerprint', name: '动作指纹', input: ['data-only'], grammar: 'radial-fingerprint', requires_photo: false, derived_style: 'radial action fingerprint', preservation: 'none', description: '把动作分布和训练节奏变成个人纹样。' })
]);

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function gcd(a, b) {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function aspectRatio(width, height) {
  const w = finite(width);
  const h = finite(height);
  if (w <= 0 || h <= 0) return 'unknown';
  const divisor = gcd(w, h);
  return `${w / divisor}:${h / divisor}`;
}

function routeVisualInput({ photos = [], images = [], trends, data } = {}) {
  const photoCount = [...photos, ...images].filter(Boolean).length;
  const evidence = trends || data;
  const hasData = Boolean(evidence && typeof evidence === 'object' && Object.keys(evidence).length);
  if (photoCount > 1) return { kind: 'multi-photo', photo_count: photoCount, has_data: hasData };
  if (photoCount === 1 && hasData) return { kind: 'photo-data', photo_count: 1, has_data: true };
  if (photoCount === 1) return { kind: 'single-photo', photo_count: 1, has_data: false };
  return { kind: 'data-only', photo_count: 0, has_data: hasData };
}

function normalizeSafeZones(zones) {
  return (Array.isArray(zones) ? zones : [])
    .filter((zone) => zone && typeof zone.id === 'string')
    .map((zone) => ({ id: zone.id, score: Math.max(0, Math.min(1, finite(zone.score, 0.5))) }))
    .sort((a, b) => b.score - a.score);
}

function normalizeImage(image = {}, index = 0) {
  const width = finite(image.width || image.image?.width);
  const height = finite(image.height || image.image?.height);
  const facts = [...new Set([...(image.visual_facts || []), ...(image.semantic_facts || [])].filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
  return {
    id: String(image.id || `image-${index + 1}`),
    path: image.path ? String(image.path) : undefined,
    width,
    height,
    aspect_ratio: image.aspect_ratio || image.image?.aspect_ratio || aspectRatio(width, height),
    orientation: image.orientation || image.image?.orientation || (width > height ? 'landscape' : height > width ? 'portrait' : width && height ? 'square' : 'unknown'),
    palette: (image.palette || []).slice(0, 8),
    region_palettes: image.region_palettes || {},
    luminance: image.luminance || 'unknown',
    contrast: image.contrast || 'unknown',
    texture: image.texture || 'unknown',
    edge_rhythm: image.edge_rhythm || 'unknown',
    focal_region: image.focal_region || 'unknown',
    negative_space: image.negative_space || 'unknown',
    safe_zones: normalizeSafeZones(image.safe_zones),
    observed_facts: facts
  };
}

function buildVisualDNA({ images = [] } = {}) {
  const normalized = images.filter(Boolean).map(normalizeImage);
  const facts = [...new Set(normalized.flatMap((image) => image.observed_facts))];
  const palette = [...new Set(normalized.flatMap((image) => image.palette))].slice(0, 8);
  return {
    schema_version: '2.0',
    source: normalized.length ? 'local-image-analysis' : 'data-only',
    privacy: { biometric_analysis: false, face_recognition: false, identity_inference: false },
    palette,
    observed_facts: facts,
    images: normalized,
    unknowns: normalized.length ? [] : ['photo_visual_signals']
  };
}

function hasFact(facts, pattern) {
  return facts.some((fact) => pattern.test(fact));
}

function mapFitnessMotifs({ observedFacts = [], trends = {} } = {}) {
  const facts = observedFacts.filter((value) => typeof value === 'string');
  const motifs = [];
  const add = (id, label, source, encoding) => motifs.push({ id, label, source, encoding });
  if (hasFact(facts, /ring[_ -]?light|halo|环形灯/i)) add('halo-cycle', '训练光环', { type: 'photo_fact', value: facts.find((fact) => /ring[_ -]?light|halo|环形灯/i.test(fact)) }, 'circular frame or cycle ring');
  if (hasFact(facts, /mirror|reflection|镜面|反射/i)) add('mirror-diptych', '镜面双联', { type: 'photo_fact', value: facts.find((fact) => /mirror|reflection|镜面|反射/i.test(fact)) }, 'split or reflected panel');
  if (hasFact(facts, /plate|weight[_ -]?disc|杠铃片|铃片/i)) add('concentric-load', '负重同心环', { type: 'photo_fact', value: facts.find((fact) => /plate|weight[_ -]?disc|杠铃片|铃片/i.test(fact)) }, 'concentric load rings');
  const axisPattern = /(?:^|[: -])barbell(?=[: -]|$)|(?:^|[: _-])rail(?=[: _-]|$)|杠铃(?!片)|导轨/i;
  if (hasFact(facts, axisPattern)) add('strength-axis', '力量轴线', { type: 'photo_fact', value: facts.find((fact) => axisPattern.test(fact)) }, 'axis and calibrated ticks');
  if (hasFact(facts, /motion|trajectory|动作轨迹|速度/i)) add('motion-trajectory', '动作轨迹', { type: 'photo_fact', value: facts.find((fact) => /motion|trajectory|动作轨迹|速度/i.test(fact)) }, 'hand-drawn motion path');
  if (Array.isArray(trends.weekly) && trends.weekly.length) add('frequency-rhythm', '频率节奏', { type: 'training_data', value: 'weekly.training_days' }, 'grid density');
  if (Array.isArray(trends.weekly) && trends.weekly.some((item) => finite(item.estimated_volume) > 0)) add('volume-density', '容量密度', { type: 'training_data', value: 'weekly.estimated_volume' }, 'stroke width and filled area');
  if (Array.isArray(trends.exercise_frequency) && trends.exercise_frequency.length) add('muscle-constellation', '肌群星座', { type: 'training_data', value: 'exercise_frequency' }, 'node size and connection weight');
  if (Array.isArray(trends.exercise_performance) && trends.exercise_performance.length) add('performance-path', '动作表现轨迹', { type: 'training_data', value: 'exercise_performance' }, 'progress path and verified breakout');
  return motifs;
}

function recipeById(id) {
  return RECIPE_CATALOG.find((recipe) => recipe.id === id);
}

function recommendVisualRecipes({ route = { kind: 'data-only' }, visualDNA = {}, preferred } = {}) {
  const compatible = RECIPE_CATALOG.filter((recipe) => recipe.input.includes(route.kind));
  const facts = visualDNA.observed_facts || [];
  const texture = visualDNA.images?.[0]?.texture;
  const score = (recipe) => {
    let value = 0;
    if (recipe.id === preferred) value += 100;
    if (route.kind === 'multi-photo' && recipe.id === 'multi-photo-storyboard') value += 50;
    if (route.kind !== 'data-only' && recipe.id === 'star-trail-collage') value += 46;
    if (hasFact(facts, /mirror|reflection|镜面/i) && recipe.id === 'sketch-diptych') value += 25;
    if (hasFact(facts, /ring[_ -]?light|plate|环形灯|铃片/i) && recipe.id === 'symbol-lab') value += 22;
    if (texture === 'fine_grain' && recipe.id === 'risograph-zine') value += 18;
    if (route.kind === 'data-only' && recipe.id === 'data-atlas') value += 30;
    if (route.kind === 'data-only' && recipe.id === 'training-rings') value += 20;
    if (route.kind === 'data-only' && recipe.id === 'strength-terrain') value += 10;
    return value;
  };
  return compatible
    .map((recipe) => ({ ...recipe, score: score(recipe) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((recipe, index) => ({ ...recipe, recommended: index === 0, reason: index === 0 ? '与输入结构和已观察视觉事实最匹配' : '提供不同构图语法的备选方向' }));
}

function validateRatio(ratio = '3:4') {
  if (!RATIO_PRESETS.has(ratio)) throw new Error(`unsupported ratio: ${ratio}`);
  return ratio;
}

module.exports = {
  RECIPE_CATALOG,
  buildVisualDNA,
  mapFitnessMotifs,
  recipeById,
  recommendVisualRecipes,
  routeVisualInput,
  validateRatio
};
