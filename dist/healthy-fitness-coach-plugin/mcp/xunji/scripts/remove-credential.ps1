[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param()

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA is required.' }
$dataRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'HealthyFitnessCoach'))
$credentialRoot = [IO.Path]::GetFullPath((Join-Path $dataRoot 'credentials'))
$path = [IO.Path]::GetFullPath((Join-Path $credentialRoot 'xunji-credential.dpapi'))
if (-not $credentialRoot.StartsWith($dataRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or -not $path.StartsWith($credentialRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to remove a file outside HealthyFitnessCoach credentials.' }
if (Test-Path -LiteralPath $path -PathType Leaf -and $PSCmdlet.ShouldProcess($path, 'Remove encrypted Xunji credential')) { Remove-Item -LiteralPath $path -Force }
Write-Output 'Credential deletion request completed.'
