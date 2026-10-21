 'use strict';
const fs = require('node:fs/promises');
const { join } = require('node:path');
class OperationStore {
  constructor(root) { this.root = root; }
  path(key) { if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid operation key'); return join(this.root, key + '.json'); }
  async get(key) { try { return JSON.parse(await fs.readFile(this.path(key), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
  async claim(key, value) { await fs.mkdir(this.root, { recursive: true }); try { await fs.writeFile(this.path(key), JSON.stringify(value), { flag: 'wx' }); return true; } catch (e) { if (e.code === 'EEXIST') return false; throw e; } }
  async set(key, value) { const path = this.path(key); const temp = path + '.tmp'; await fs.writeFile(temp, JSON.stringify(value)); await fs.rename(temp, path); }
  async remove(key) { await fs.unlink(this.path(key)); }
}
function memoryOperationStore() {
  const entries = new Map();
  return { async get(k) { return entries.get(k); }, async claim(k,v) { if(entries.has(k)) return false; entries.set(k,v); return true; }, async set(k,v) { entries.set(k,v); }, async remove(k) { entries.delete(k); } };
}
module.exports = { OperationStore, memoryOperationStore };
