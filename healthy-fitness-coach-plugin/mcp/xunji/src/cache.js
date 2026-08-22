'use strict';

const { createHash, randomBytes } = require('node:crypto');
const { mkdir, readFile, rename, rm, writeFile } = require('node:fs/promises');
const { dirname, join, resolve, sep } = require('node:path');
const { connectorError } = require('./errors.js');
const { assertCacheEntry, assertDate } = require('./schemas.js');

function credentialFingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

class FileCache {
  constructor({ root, fingerprint }) {
    this.root = resolve(root);
    this.fingerprint = String(fingerprint);
    if (!/^[a-f0-9]{64}$/.test(this.fingerprint)) throw connectorError('cache_error');
    this.writeQueues = new Map();
  }

  pathFor(date) {
    assertDate(date);
    const [year, month] = date.split('-');
    return join(this.root, this.fingerprint, year, month, `${date}.json`);
  }

  async get(date) {
    try {
      const content = await readFile(this.pathFor(date), 'utf8');
      return assertCacheEntry(JSON.parse(content));
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      if (error && error.code === 'invalid_date') throw error;
      throw connectorError('cache_error');
    }
  }

  async set(date, entry) {
    const validated = assertCacheEntry(entry);
    const destination = this.pathFor(date);
    const previous = this.writeQueues.get(destination) || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => this.writeAtomically(destination, validated));
    this.writeQueues.set(destination, operation);
    try {
      await operation;
    } finally {
      if (this.writeQueues.get(destination) === operation) this.writeQueues.delete(destination);
    }
  }

  async writeAtomically(destination, validated) {
    const directory = dirname(destination);
    const temporary = `${destination}.${process.pid}.${Date.now()}.${randomBytes(12).toString('hex')}.tmp`;
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(temporary, JSON.stringify(validated), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      throw connectorError('cache_error');
    }
  }

  async delete(date) {
    await rm(this.pathFor(date), { force: true }).catch(() => { throw connectorError('cache_error'); });
  }

  async deleteAll() {
    const target = resolve(this.root, this.fingerprint);
    if (!target.startsWith(`${this.root}${sep}`)) throw connectorError('cache_error');
    await rm(target, { recursive: true, force: true }).catch(() => { throw connectorError('cache_error'); });
  }
}

module.exports = { credentialFingerprint, FileCache };
