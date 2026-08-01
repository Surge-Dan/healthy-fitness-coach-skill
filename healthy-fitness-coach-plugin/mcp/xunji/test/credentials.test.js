'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { credentialPath, isCredentialValue, readWindowsCredential } = require('../src/credentials.js');

test('credential helper only accepts non-empty in-memory values and uses LocalAppData path shape', () => {
  assert.equal(isCredentialValue('FAKE_TEST_CREDENTIAL'), true);
  assert.equal(isCredentialValue(''), false);
  assert.match(credentialPath('C:\\Temp'), /HealthyFitnessCoach[\\/]credentials[\\/]xunji-credential\.dpapi$/);
});

test('credential reader removes only the PowerShell line terminator', async () => {
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    queueMicrotask(() => { child.stdout.emit('data', Buffer.from('  OPAQUE VALUE  \r\n')); child.emit('close', 0); });
    return child;
  };
  const value = await readWindowsCredential({ localAppData: 'C:\\Temp', spawnProcess });
  assert.equal(value, '  OPAQUE VALUE  ');
});

test('credential scripts use DPAPI SecureString storage and scoped deletion', () => {
  const scripts = join(__dirname, '..', 'scripts');
  const setup = readFileSync(join(scripts, 'set-credential.ps1'), 'utf8');
  const remove = readFileSync(join(scripts, 'remove-credential.ps1'), 'utf8');
  assert.match(setup, /Read-Host\s+-AsSecureString/);
  assert.match(setup, /ConvertFrom-SecureString/);
  assert.match(remove, /GetFullPath/);
  assert.match(remove, /Remove-Item/);
});
