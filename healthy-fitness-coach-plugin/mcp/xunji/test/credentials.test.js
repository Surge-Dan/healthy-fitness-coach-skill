'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const { credentialPath, isCredentialValue } = require('../src/credentials.js');

test('credential helper only accepts non-empty in-memory values and uses LocalAppData path shape', () => {
  assert.equal(isCredentialValue('FAKE_TEST_CREDENTIAL'), true);
  assert.equal(isCredentialValue(''), false);
  assert.match(credentialPath('C:\\Temp'), /HealthyFitnessCoach[\\/]credentials[\\/]xunji-credential\.dpapi$/);
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
