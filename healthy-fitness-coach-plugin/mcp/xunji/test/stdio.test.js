'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const test = require('node:test');

test('stdio initializes and lists all Xunji tools without invoking a tool', async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js'], { cwd: join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    let listed = false;
    const finish = (error) => { clearTimeout(timeout); child.kill(); error ? reject(error) : resolve(); };
    const timeout = setTimeout(() => finish(new Error('stdio initialize timeout')), 5_000);
    child.stderr.on('data', () => {});
    child.on('error', finish);
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch (error) { finish(error); return; }
        if (message.id === 1) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
        }
        if (message.id === 2) {
          assert.deepEqual(message.result.tools.map((tool) => tool.name).sort(), [
            'xunji_get_training_day', 'xunji_get_training_range', 'xunji_get_training_trends',
            'xunji_preview_training_upsert', 'xunji_upsert_training_records'
          ]);
          listed = true;
          finish();
          return;
        }
      }
    });
    child.on('exit', (code) => { if (!listed && code !== null) finish(new Error(`stdio exited ${code}`)); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } }) + '\n');
  });
});
