'use strict';

const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

const [pluginRoot, command, cwd, ...args] = process.argv.slice(2);
if (!pluginRoot || !command || !cwd || args.length === 0) {
  throw new Error('usage: node plugin-stdio-handshake.js <plugin-root> <command> <cwd> <args...>');
}

const child = spawn(command, args, {
  cwd: resolve(pluginRoot, cwd),
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true
});
let buffer = '';
let complete = false;
const finish = (error) => {
  if (complete) return;
  complete = true;
  clearTimeout(timeout);
  child.kill();
  if (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
};
const timeout = setTimeout(() => finish(new Error('MCP stdio handshake timed out')), 5_000);

child.on('error', finish);
child.on('exit', (code) => {
  if (!complete) finish(new Error(`MCP stdio exited before tools/list (code ${code})`));
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
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
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
    }
    if (message.id === 2) {
      const names = Array.isArray(message.result?.tools) ? message.result.tools.map((tool) => tool.name).sort() : [];
      const expected = ['xunji_get_training_day', 'xunji_get_training_range'];
      if (JSON.stringify(names) !== JSON.stringify(expected)) {
        finish(new Error(`Expected exactly ${expected.join(', ')}, received ${names.join(', ')}`));
        return;
      }
      process.stdout.write(`PASS: MCP stdio lists ${names.join(', ')}\n`);
      finish();
      return;
    }
  }
});

child.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'plugin-validation', version: '0.2.0' } }
}) + '\n');
