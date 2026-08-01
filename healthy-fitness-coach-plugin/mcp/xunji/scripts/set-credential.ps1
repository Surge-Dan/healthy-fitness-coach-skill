[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'HealthyFitnessCoach\credentials'
$path = Join-Path $root 'xunji-credential.dpapi'
$credential = Read-Host -AsSecureString 'Enter Xunji credential'
if ($credential.Length -eq 0) { throw 'Credential cannot be empty.' }
New-Item -ItemType Directory -Force -Path $root | Out-Null
$credential | ConvertFrom-SecureString | Set-Content -LiteralPath $path -Encoding Ascii -NoNewline
Write-Output 'Credential stored for the current Windows user.'
