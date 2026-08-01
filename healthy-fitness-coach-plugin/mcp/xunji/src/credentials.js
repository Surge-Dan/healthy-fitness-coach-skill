'use strict';

const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { connectorError } = require('./errors.js');

function credentialPath(localAppData) {
  return join(localAppData, 'HealthyFitnessCoach', 'credentials', 'xunji-credential.dpapi');
}

function isCredentialValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readWindowsCredential({ localAppData = process.env.LOCALAPPDATA, spawnProcess = spawn } = {}) {
  if (!localAppData) return Promise.reject(connectorError('missing_credentials'));
  const path = credentialPath(localAppData).replace(/'/g, "''");
  const command = `$path='${path}'; if (!(Test-Path -LiteralPath $path -PathType Leaf)) { exit 3 }; $secure=Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }`;
  return new Promise((resolve, reject) => {
    const child = spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.on('error', () => reject(connectorError('missing_credentials')));
    child.on('close', (code) => {
      const value = output.trim();
      if (code !== 0 || !isCredentialValue(value)) return reject(connectorError('missing_credentials'));
      resolve(value);
    });
  });
}

module.exports = { credentialPath, isCredentialValue, readWindowsCredential };
