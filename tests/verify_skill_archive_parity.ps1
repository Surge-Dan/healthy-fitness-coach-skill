param(
    [string]$SkillRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach'),
    [string]$ArchivePath = (Join-Path $PSScriptRoot '..\dist\healthy-fitness-coach.skill')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = (Resolve-Path -LiteralPath $SkillRoot).Path
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath))
try {
    $sourceFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]evals[\\/]' })
    if ($archive.Entries.Count -ne $sourceFiles.Count) { throw "Archive entry count differs: $($archive.Entries.Count) != $($sourceFiles.Count)" }
    foreach ($file in $sourceFiles) {
        $relative = $file.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
        $entry = $archive.GetEntry("healthy-fitness-coach/$relative")
        if ($null -eq $entry) { throw "Archive is missing $relative" }
        $stream = $entry.Open()
        $algorithm = [Security.Cryptography.SHA256]::Create()
        try { $entryHash = ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '') } finally { $stream.Dispose(); $algorithm.Dispose() }
        if ($entryHash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash) { throw "Archive hash differs: $relative" }
    }
    Write-Output "PASS: archive parity $($sourceFiles.Count)/$($sourceFiles.Count)"
} finally {
    $archive.Dispose()
}
