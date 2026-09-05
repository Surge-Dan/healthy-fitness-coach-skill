'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'assets', 'workout-guide-catalog.json');
const { matchExercise, renderExerciseCard, constants } = require('../references/workout-guide');

test('catalog preserves all 302 upstream entries and real three-frame paths', () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert.equal(catalog.source.commit, constants.COMMIT);
  assert.equal(catalog.exercises.length, 302);
  for (const exercise of catalog.exercises) {
    assert.equal(exercise.frames.length, 3);
    exercise.frames.forEach((frame, index) => {
      assert.equal(frame.index, index + 1);
      assert.match(frame.path, new RegExp(`^assets/${exercise.slug}/frame-${index + 1}\\.svg$`));
      assert.match(frame.displayPath, new RegExp(`^assets/${exercise.slug}/frame-${index + 1}\\.png$`));
      assert.equal(frame.attribution.license, 'CC BY-SA 4.0');
    });
  }
});

test('exact id, slug, English name and specific Chinese aliases resolve one exercise', () => {
  for (const query of ['exercise-bench-press', 'bench-press', 'Bench Press', '杠铃卧推']) {
    const result = matchExercise(query);
    assert.equal(result.status, 'match');
    assert.equal(result.exercise.slug, 'bench-press');
  }
  assert.equal(matchExercise('罗马尼亚硬拉').exercise.slug, 'romanian-deadlift');
  assert.equal(matchExercise('高位下拉').exercise.slug, 'lat-pulldown');
  assert.equal(matchExercise('保加利亚分腿蹲').exercise.slug, 'bulgarian-split-squat');
  assert.ok(constants.CHINESE_ALIASES.size >= 20);
});

test('broad Chinese names return candidates without collapsing equipment or angle variants', () => {
  const bench = matchExercise('卧推');
  assert.equal(bench.status, 'ambiguous');
  assert.ok(bench.candidates.some((item) => item.slug === 'bench-press'));
  assert.ok(bench.candidates.some((item) => item.slug === 'dumbbell-bench-press'));
  const row = matchExercise('划船');
  assert.equal(row.status, 'ambiguous');
  assert.ok(row.candidates.length > 3);
});

test('unknown and hostile input cannot enter generated Markdown', () => {
  assert.equal(matchExercise('不存在的动作').status, 'no_match');
  assert.equal(matchExercise('![x](javascript:alert(1))').status, 'no_match');
  assert.throws(() => renderExerciseCard('![x](javascript:alert(1))'), /明确动作/);
  for (const prototypeKey of ['constructor', '__proto__', 'toString']) {
    assert.doesNotThrow(() => matchExercise(prototypeKey));
    assert.equal(matchExercise(prototypeKey).status, 'no_match');
  }
});

test('card uses ordered immutable image URLs and complete attribution', () => {
  const markdown = renderExerciseCard('杠铃卧推');
  const urls = [1, 2, 3].map((n) => `${constants.RAW_BASE}/assets/bench-press/frame-${n}.png`);
  assert.ok(markdown.includes('# 杠铃卧推'));
  assert.ok(markdown.includes('原始动作名：Bench Press'));
  assert.ok(markdown.includes('器械：Barbell'));
  assert.ok(markdown.includes('CC BY-SA 4.0'));
  assert.ok(markdown.includes('Everkinetic'));
  assert.ok(markdown.includes('https://github.com/everkinetic/data/blob/main/dist/svg/0042-tension.svg'));
  assert.ok(markdown.includes(constants.COMMIT));
  assert.ok(urls.every((url) => markdown.includes(url)));
  assert.ok(markdown.indexOf(urls[0]) < markdown.indexOf(urls[1]));
  assert.ok(markdown.indexOf(urls[1]) < markdown.indexOf(urls[2]));
  assert.ok(markdown.includes('图片加载失败'));
  assert.doesNotMatch(markdown, /个性化动作评估/);
});
