'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { FileCache, credentialFingerprint } = require('../src/cache.js');

test('file cache uses a one-way credential fingerprint and atomic date entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xunji-cache-test-'));
  try {
    const fingerprint = credentialFingerprint('FAKE_TEST_CREDENTIAL');
    assert.equal(fingerprint.includes('FAKE_TEST_CREDENTIAL'), false);
    const cache = new FileCache({ root, fingerprint });
    await cache.set('2026-08-01', { fetched_at: 1, records: [], warnings: [] });
    const value = await cache.get('2026-08-01');
    assert.equal(value.fetched_at, 1);
    const onDisk = await readFile(cache.pathFor('2026-08-01'), 'utf8');
    assert.equal(onDisk.includes('FAKE_TEST_CREDENTIAL'), false);
    await cache.delete('2026-08-01');
    assert.equal(await cache.get('2026-08-01'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('cache rejects invalid dates and malformed entries before writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xunji-cache-test-'));
  try {
    const cache = new FileCache({ root, fingerprint: 'abc' });
    await assert.rejects(cache.set('2026-02-30', { fetched_at: 1, records: [] }), { code: 'invalid_date' });
    await assert.rejects(cache.set('2026-08-01', { records: 'not-array' }), { code: 'cache_error' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('corrupt cache reads are cache_error rather than a network-miss signal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xunji-cache-test-'));
  try {
    const cache = new FileCache({ root, fingerprint: 'abc' });
    await cache.set('2026-08-01', { fetched_at: 1, records: [], warnings: [] });
    await writeFile(cache.pathFor('2026-08-01'), '{corrupt', 'utf8');
    await assert.rejects(cache.get('2026-08-01'), { code: 'cache_error' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('concurrent writes use collision-safe temporary names', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xunji-cache-test-'));
  try {
    const cache = new FileCache({ root, fingerprint: 'abc' });
    await Promise.all(Array.from({ length: 20 }, (_, index) => cache.set('2026-08-01', { fetched_at: index, records: [], warnings: [] })));
    assert.ok(Number.isInteger((await cache.get('2026-08-01')).fetched_at));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
