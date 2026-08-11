[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$pluginRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mcpRoot = Join-Path $pluginRoot 'mcp\xunji'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js was not found. Install Node.js 18 or newer first.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm was not found. Check that Node.js is installed and on PATH.'
}

$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 18) {
  throw "Node.js $nodeMajor is too old. Upgrade to Node.js 18 or newer and retry."
}

Write-Host 'Installing Xunji MCP dependencies...'
& npm --prefix $mcpRoot ci --omit=dev --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed.' }

Write-Host 'Enter the Xunji Open API key. Input will not be echoed.'
& (Join-Path $mcpRoot 'scripts\set-credential.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Credential storage failed.' }

Write-Host ''
Write-Host 'Setup complete. Next, add this local plugin directory in Codex Plugins:'
Write-Host $pluginRoot
Write-Host 'Then refresh or restart Codex and test: analyze my Xunji training from the last four weeks.'
