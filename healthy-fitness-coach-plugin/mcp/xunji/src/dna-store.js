'use strict';

const { randomBytes } = require('node:crypto');
const { mkdir, readFile, rename, rm, writeFile } = require('node:fs/promises');
const { dirname, join, resolve, sep } = require('node:path');
const { connectorError } = require('./errors.js');

class FileDNAStore {
  constructor({ root, fingerprint }) {
    this.root = resolve(root);
    this.fingerprint = String(fingerprint);
  }

  path() {
    const destination = resolve(this.root, `${this.fingerprint}.json`);
    if (!destination.startsWith(`${this.root}${sep}`)) throw connectorError('cache_error');
    return destination;
  }

  async get() {
    try {
      return JSON.parse(await readFile(this.path(), 'utf8'));
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw connectorError('cache_error');
    }
  }

  async set(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw connectorError('cache_error');
    const destination = this.path();
    const prior = FileDNAStore.pending.get(destination) || Promise.resolve();
    const operation = prior.catch(() => {}).then(async () => {
      const temporary = `${destination}.${process.pid}.${Date.now()}.${randomBytes(12).toString('hex')}.tmp`;
      try {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
        await rename(temporary, destination);
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => {});
        throw connectorError('cache_error');
      }
    });
    FileDNAStore.pending.set(destination, operation);
    try { return await operation; } finally { if (FileDNAStore.pending.get(destination) === operation) FileDNAStore.pending.delete(destination); }
  }
}

FileDNAStore.pending = new Map();

module.exports = { FileDNAStore };
