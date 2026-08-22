'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { FileDNAStore } = require('../src/dna-store.js');
const VALID_FINGERPRINT = 'b'.repeat(64);

test('DNA store persists versioned artifacts without credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-'));
  try {
    const store = new FileDNAStore({ root, fingerprint: VALID_FINGERPRINT });
    await store.set({ version: 1, training_dna: { schema_version: '1.0' }, changes: [] });
    assert.deepEqual(await store.get(), { version: 1, training_dna: { schema_version: '1.0' }, changes: [] });
    const files = await readFile(join(root, `${VALID_FINGERPRINT}.json`), 'utf8');
    assert.doesNotMatch(files, /xjllm_|Bearer|apikey/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('DNA store returns null for a missing account artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-'));
  try {
    const store = new FileDNAStore({ root, fingerprint: VALID_FINGERPRINT });
    assert.equal(await store.get(), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('DNA store rejects an invalid fingerprint namespace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'healthy-fitness-dna-'));
  try {
    assert.throws(() => new FileDNAStore({ root, fingerprint: '../outside' }), { code: 'cache_error' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
