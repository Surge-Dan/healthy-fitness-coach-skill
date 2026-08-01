[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]]$Roots,
    [string[]]$ImmutableManifest = @(),
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$script:findings = [System.Collections.Generic.List[string]]::new()
$script:immutableHashes = @{}
$textExtensions = @('.md', '.txt', '.json', '.js', '.ps1', '.yaml', '.yml', '.html', '.xml', '.csv', '.toml')
$publicSourceHosts = @('aasm.org', 'acsm.org', 'biolayne.com', 'e3rehab.com', 'jeffnippard.com', 'nida.nih.gov', 'pamelareif.squarespace.com', 'play.google.com', 'professional.heart.org', 'pubmed.ncbi.nlm.nih.gov', 'soheefit.com', 'www.3dmusclejourney.com', 'www.barbellmedicine.com', 'www.bilibili.com', 'www.hubermanlab.com', 'www.parker.edu', 'www.strongerbyscience.com', 'www.tomsguide.com')

foreach ($manifestPath in $ImmutableManifest) {
    if (-not $manifestPath) { continue }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($entry in @($manifest.files)) {
        $path = [IO.Path]::GetFullPath([string]$entry.path)
        $hash = [string]$entry.sha256
        if ($script:immutableHashes.ContainsKey($path) -and $script:immutableHashes[$path] -ne $hash) { throw "Conflicting immutable hashes for $path" }
        $script:immutableHashes[$path] = $hash
    }
}

function Add-Finding {
    param([string]$Location, [string]$Kind)
    $script:findings.Add("$Location [$Kind]")
}

function Test-DocumentedHashContext {
    param([string]$Text, [int]$Index, [string]$Token)
    $afterIndex = $Index + $Token.Length
    if ($Index -gt 0 -and $afterIndex -lt $Text.Length -and $Text[$Index - 1] -eq '{' -and $Text[$afterIndex] -eq '}') { return $true }
    $start = [Math]::Max(0, $Index - 96)
    $context = $Text.Substring($start, $Index - $start)
    $lineStart = $Text.LastIndexOf("`n", $Index)
    if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart++ }
    $lineEnd = $Text.IndexOf("`n", $Index)
    if ($lineEnd -lt 0) { $lineEnd = $Text.Length }
    $line = $Text.Substring($lineStart, $lineEnd - $lineStart)
    foreach ($integrity in [regex]::Matches($line, '(?i)integrity\s*=\s*["'']sha(256|384|512)-[A-Za-z0-9+/=_-]+["'']')) {
        $integrityStart = $lineStart + $integrity.Index
        $integrityEnd = $integrityStart + $integrity.Length
        if ($Index -ge $integrityStart -and ($Index + $Token.Length) -le $integrityEnd) { return $true }
    }
    if ($Token -match '(?i)^sha(256|384|512)-' -and $context -match '(?i)integrity\s+$') { return $true }
    if ($Token -match '(?i)^sha(256|384|512)-' -and $context -match '(?i)"integrity"\s*:\s*"$') { return $true }
    if ($context -match '(?i)"integrity"\s*:\s*"sha(256|384|512)-[A-Za-z0-9+/=_-]*$') { return $true }
    if ($context -match '(?i)integrity\s+sha(256|384|512)-[A-Za-z0-9_-]*$') { return $true }
    if ($Token -notmatch '^[A-Fa-f0-9]{40,64}$') { return $false }
    return $context -match '(?i)(sha[-_ ]?256|commit|git[_ -]?blob|hash)\D{0,64}$'
}

function Test-StructuredEvalRunIdentifier {
    param([string]$Token)
    return $Token -cmatch '^eval-(?:fresh-)?[a-z]+(?:-[a-z]+)*(?:-with_skill|-without_skill)-run-[0-9]+$'
}

function Get-ShannonEntropy {
    param([string]$Value)
    $counts = @{}
    foreach ($character in $Value.ToCharArray()) {
        if (-not $counts.ContainsKey($character)) { $counts[$character] = 0 }
        $counts[$character]++
    }
    $entropy = 0.0
    foreach ($count in $counts.Values) {
        $probability = $count / $Value.Length
        $entropy -= $probability * [Math]::Log($probability, 2)
    }
    return $entropy
}

function Test-AllowedPublicPathIdentifier {
    param([string]$Text, [int]$Index, [string]$Token)
    $lineStart = $Text.LastIndexOf("`n", $Index)
    if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart++ }
    $lineEnd = $Text.IndexOf("`n", $Index)
    if ($lineEnd -lt 0) { $lineEnd = $Text.Length }
    $line = $Text.Substring($lineStart, $lineEnd - $lineStart)
    foreach ($url in [regex]::Matches($line, 'https?://(?<host>[A-Za-z0-9.-]+)(?<path>/[^\s\)\]]*)?')) {
        $sourceHost = $url.Groups['host'].Value.ToLowerInvariant()
        if ($publicSourceHosts -notcontains $sourceHost) { continue }
        if ($url.Value.Contains('@')) { continue }
        $absoluteStart = $lineStart + $url.Index
        $absoluteEnd = $absoluteStart + $url.Length
        if ($Index -lt $absoluteStart -or ($Index + $Token.Length) -gt $absoluteEnd) { continue }
        $queryOffset = $url.Value.IndexOf('?')
        if ($queryOffset -ge 0 -and $Index -ge ($absoluteStart + $queryOffset)) { continue }
        return $true
    }
    return $false
}

function Test-ExistingMarkdownReference {
    param([string]$Text, [int]$Index, [string]$Token, [string]$Location, [System.Collections.Generic.HashSet[string]]$ArchiveEntries)
    $lineStart = $Text.LastIndexOf("`n", $Index)
    if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart++ }
    $lineEnd = $Text.IndexOf("`n", $Index)
    if ($lineEnd -lt 0) { $lineEnd = $Text.Length }
    $line = $Text.Substring($lineStart, $lineEnd - $lineStart)
    $referencePattern = '(?<![A-Za-z0-9_./:\\-])(?<relative>(?:assets|references)/(?:[a-z]+(?:-[a-z]+)*/)*[a-z]+(?:-[a-z]+)*\.md)(?![A-Za-z0-9_./?#: @\\-])'
    foreach ($reference in [regex]::Matches($line, $referencePattern)) {
        $relative = $reference.Groups['relative'].Value
        $filename = [IO.Path]::GetFileNameWithoutExtension($relative)
        $tokenStart = $lineStart + $reference.Index + $relative.Length - 3 - $filename.Length
        if ($Index -ne $tokenStart -or $Token.Length -ne $filename.Length) { continue }
        if ($ArchiveEntries) { return $ArchiveEntries.Contains($relative) }
        $directory = Split-Path -Parent $Location
        for ($level = 0; $level -lt 6 -and $directory; $level++) {
            if (Test-Path -LiteralPath (Join-Path $directory $relative) -PathType Leaf) { return $true }
            $parent = Split-Path -Parent $directory
            if ($parent -eq $directory) { break }
            $directory = $parent
        }
    }
    return $false
}

function Test-SecretText {
    param([string]$Text, [string]$Location, [System.Collections.Generic.HashSet[string]]$ArchiveEntries)
    $patterns = @(
        @{ Kind = 'xunji_token'; Pattern = '(?i)\bxjllm_[A-Za-z0-9_-]{16,}\b' },
        @{ Kind = 'bearer_token'; Pattern = '(?i)\bBearer\s+[A-Za-z0-9._~-]{20,}\b' },
        @{ Kind = 'labelled_secret'; Pattern = '(?i)\b(?:api[-_ ]?key|token|secret)\b\s*[:=]\s*["'']?[A-Za-z0-9._~-]{16,}' }
    )
    foreach ($item in $patterns) {
        if ([regex]::IsMatch($Text, $item.Pattern)) { Add-Finding $Location $item.Kind }
    }

    foreach ($match in [regex]::Matches($Text, '\b[A-Za-z0-9_-]{32,}\b')) {
        $token = $match.Value
        if (Test-DocumentedHashContext $Text $match.Index $token) { continue }
        if (Test-StructuredEvalRunIdentifier $token) { continue }
        if (Test-AllowedPublicPathIdentifier $Text $match.Index $token) { continue }
        if (Test-ExistingMarkdownReference $Text $match.Index $token $Location $ArchiveEntries) { continue }
        $classes = 0
        if ($token -cmatch '[a-z]') { $classes++ }
        if ($token -cmatch '[A-Z]') { $classes++ }
        if ($token -match '\d') { $classes++ }
        if ($token -match '[_-]') { $classes++ }
        if ($classes -ge 3 -and (Get-ShannonEntropy $token) -ge 3.5) { Add-Finding $Location 'bare_high_entropy' }
    }
}

function Scan-TextFile {
    param([IO.FileInfo]$File, [string]$Label)
    $fullPath = [IO.Path]::GetFullPath($File.FullName)
    if ($script:immutableHashes.ContainsKey($fullPath)) {
        $actual = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
        if ($actual -eq $script:immutableHashes[$fullPath]) { return }
        Add-Finding $Label 'immutable_hash_mismatch'
        return
    }
    $text = [IO.File]::ReadAllText($File.FullName, [Text.Encoding]::UTF8)
    Test-SecretText $text $Label
}

function Scan-SkillArchive {
    param([IO.FileInfo]$File)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($File.FullName)
    try {
        $archiveEntries = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
        foreach ($entry in $zip.Entries) { [void]$archiveEntries.Add($entry.FullName) }
        foreach ($entry in $zip.Entries) {
            if ($textExtensions -notcontains ([IO.Path]::GetExtension($entry.FullName).ToLowerInvariant())) { continue }
            $reader = New-Object IO.StreamReader($entry.Open(), [Text.Encoding]::UTF8, $true)
            try { Test-SecretText $reader.ReadToEnd() "$($File.Name):$($entry.FullName)" $archiveEntries } finally { $reader.Dispose() }
        }
    } finally { $zip.Dispose() }
}

foreach ($root in $Roots) {
    if (-not (Test-Path -LiteralPath $root)) { throw "Scan root does not exist: $root" }
    $item = Get-Item -LiteralPath $root
    $files = if ($item.PSIsContainer) { Get-ChildItem -LiteralPath $item.FullName -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' } } else { @($item) }
    foreach ($file in $files) {
        if ($file.Extension -eq '.skill') { Scan-SkillArchive $file; continue }
        if ($textExtensions -contains $file.Extension.ToLowerInvariant()) { Scan-TextFile $file $file.FullName }
    }
}

if ($script:findings.Count -gt 0) {
    if (-not $Quiet) { $script:findings | Sort-Object -Unique | ForEach-Object { Write-Error $_ } }
    exit 1
}

if (-not $Quiet) { Write-Output 'PASS: no credential-shaped text detected' }
exit 0
