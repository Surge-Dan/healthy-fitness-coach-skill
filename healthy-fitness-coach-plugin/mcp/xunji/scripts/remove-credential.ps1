[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'HealthyFitnessCoach\credentials'))
$path = [IO.Path]::GetFullPath((Join-Path $root 'xunji-credential.dpapi'))
if (-not $path.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove a file outside the credential directory.' }
if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force }
Write-Output 'Credential removed.'
