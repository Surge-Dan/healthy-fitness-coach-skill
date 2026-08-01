[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param()

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA is required.' }
$dataRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'HealthyFitnessCoach'))
$cachePath = [IO.Path]::GetFullPath((Join-Path $dataRoot 'xunji-cache'))
if (-not $cachePath.StartsWith($dataRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove a cache path outside HealthyFitnessCoach.' }
if (Test-Path -LiteralPath $cachePath -PathType Container -and $PSCmdlet.ShouldProcess($cachePath, 'Remove date-scoped Xunji cache')) { Remove-Item -LiteralPath $cachePath -Recurse -Force }
Write-Output 'Cache deletion request completed.'
