'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
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

test('cards preserve action-level and frame-level upstream source relationships', () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const derived = catalog.exercises.filter((exercise) => exercise.attribution.source);
  assert.equal(derived.length, 76);
  for (const exercise of derived) {
    const markdown = renderExerciseCard(exercise.slug);
    assert.match(markdown, new RegExp(`动作级来源：\\[${exercise.attribution.source.name}\\]`));
    for (const frame of exercise.frames.filter((item) => item.attribution.source)) {
      assert.match(markdown, new RegExp(`第 ${frame.index} 帧来源：\\[${frame.attribution.source.name}\\]`));
      assert.ok(markdown.includes(frame.attribution.source.url));
    }
  }
});

test('third-party notice includes the complete upstream MIT license and immutable source', () => {
  const notice = fs.readFileSync(path.join(root, 'references', 'workout-guide-license.md'), 'utf8');
  const normalizedNotice = notice.replace(/\s+/g, ' ');
  assert.ok(notice.includes(`https://github.com/bryllim/workout-guide/blob/${constants.COMMIT}/LICENSE`));
  for (const requiredText of [
    'MIT License',
    'Copyright (c) 2026 Bryl Lim',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED',
    'IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM'
  ]) {
    assert.ok(normalizedNotice.includes(requiredText), `missing MIT notice text: ${requiredText}`);
  }
});

test('release privacy scanner catches local user paths without relying on wxid', () => {
  const buildScript = path.resolve(root, '..', 'quality-tests', 'build-release.py');
  const probe = String.raw`
import importlib.util
import pathlib
import sys

spec = importlib.util.spec_from_file_location("build_release", pathlib.Path(sys.argv[1]))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

users = "Us" + "ers"
wechat = "We" + "Chat"
wechat_cache = "xwechat" + "_files"
home = "ho" + "me"
backslash = chr(92)
unsafe = [
    f"C:{backslash}{users}{backslash}Daniel{backslash}Pictures{backslash}form.png",
    f"E:/{users}/daniel/Pictures/form.jpg",
    f"D:/{wechat}/daniel/photo.jpeg",
    f"D:/{wechat} Files/daniel/photo.png",
    f"cache/{wechat_cache}/daniel/photo.jpg",
    f"/{users}/daniel/Pictures/photo.png",
    f"/{home}/daniel/Pictures/photo.png",
]
safe = [
    "C:/Users/Public/Pictures/sample.png",
    "/Users/Shared/Pictures/sample.png",
    "docs/Users/daniel/example.md",
    "https://example.com/Users/daniel/photo.png",
]
assert all(module.find_private_data(item) for item in unsafe)
assert all(module.find_private_data(item) is None for item in safe)
`;
  const result = childProcess.spawnSync('python', ['-X', 'utf8', '-c', probe, buildScript], {
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
