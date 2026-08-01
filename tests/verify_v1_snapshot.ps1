param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach'),
    [string]$SnapshotRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach-workspace\skill-v1-snapshot'),
    [string]$MetadataPath = (Join-Path $PSScriptRoot '..\healthy-fitness-coach-workspace\skill-v1-snapshot.metadata.json')
)

$ErrorActionPreference = 'Stop'
$metadata = Get-Content -LiteralPath $MetadataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$expected = @{}
foreach ($file in $metadata.files) {
    $expected[$file.path.Replace('/', '\')] = @{ sha256 = $file.sha256; bytes = [int64]$file.bytes }
}

function Get-Inventory([string]$Root) {
    $rootPath = (Resolve-Path -LiteralPath $Root).Path
    $inventory = @{}
    Get-ChildItem -LiteralPath $rootPath -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($rootPath.Length).TrimStart('\')
        $inventory[$relative] = @{ sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash; bytes = [int64]$_.Length }
    }
    return $inventory
}

function Assert-Inventory([hashtable]$Actual, [string]$Label) {
    if ($Actual.Count -ne $expected.Count) { throw "$Label file count differs from recorded V1 manifest" }
    foreach ($path in $expected.Keys) {
        if (-not $Actual.ContainsKey($path)) { throw "$Label is missing $path" }
        if ($Actual[$path].sha256 -ne $expected[$path].sha256 -or $Actual[$path].bytes -ne $expected[$path].bytes) {
            throw "$Label differs from recorded V1 bytes: $path"
        }
    }
}

Assert-Inventory (Get-Inventory $SourceRoot) 'V1 source'
Assert-Inventory (Get-Inventory $SnapshotRoot) 'V1 snapshot'
Write-Output 'PASS: V1 source and snapshot both match the recorded byte manifest'
