[CmdletBinding()]
param(
    [string]$PluginRoot = '',
    [string]$SkillRoot = '',
    [string]$DistRoot = '',
    [string]$PluginValidator = '',
    [switch]$SkipStdio,
    [switch]$SkipDist
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $PluginRoot) { $PluginRoot = Join-Path $scriptDir '..\healthy-fitness-coach-plugin' }
if (-not $SkillRoot) { $SkillRoot = Join-Path $scriptDir '..\healthy-fitness-coach' }
if (-not $DistRoot) { $DistRoot = Join-Path $scriptDir '..\dist\healthy-fitness-coach-plugin' }
if (-not $PluginValidator) {
    $codexRoot = $env:CODEX_HOME
    if ([string]::IsNullOrWhiteSpace($codexRoot)) {
        $codexRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex'
    }
    $PluginValidator = Join-Path $codexRoot 'skills\.system\plugin-creator\scripts\validate_plugin.py'
}
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Get-AbsolutePath {
    param([string]$Path)
    return [IO.Path]::GetFullPath($Path)
}

function Test-StrictChild {
    param([string]$Root, [string]$Candidate)
    $rootFull = (Get-AbsolutePath $Root).TrimEnd('\', '/')
    $candidateFull = Get-AbsolutePath $Candidate
    return $candidateFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}

function Get-Inventory {
    param([string]$Root, [switch]$ExcludeNodeModules)
    $rootFull = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/')
    $inventory = @{}
    Get-ChildItem -LiteralPath $rootFull -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
        if ($ExcludeNodeModules -and $relative.Split('/') -contains 'node_modules') { return }
        $inventory[$relative] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
    return $inventory
}

function Assert-InventoryMatch {
    param([hashtable]$Expected, [hashtable]$Actual, [string]$Label)
    Assert-True ($Expected.Count -eq $Actual.Count) "$Label file count differs"
    foreach ($relative in $Expected.Keys) {
        Assert-True ($Actual.ContainsKey($relative)) "$Label missing $relative"
        if ($Actual.ContainsKey($relative)) {
            Assert-True ($Expected[$relative] -eq $Actual[$relative]) "$Label hash differs: $relative"
        }
    }
}

$pluginRootFull = Get-AbsolutePath $PluginRoot
$skillRootFull = Get-AbsolutePath $SkillRoot
$distRootFull = Get-AbsolutePath $DistRoot
$PluginValidator = Get-AbsolutePath $PluginValidator
$authorName = [string]([char]0x6885) + [char]0x4E43 + [char]0x4E39
$chineseTerms = @(
    ([string]([char]0x4E0D) + [char]0x8981 + [char]0x628A + [char]0x5BC6 + [char]0x94A5 + [char]0x7C98 + [char]0x8D34 + [char]0x5230 + [char]0x804A + [char]0x5929),
    ([string]([char]0x65E5) + [char]0x671F),
    ([string]([char]0x53EA) + [char]0x8BFB),
    ([string]([char]0x4E91) + [char]0x6570 + [char]0x636E + [char]0x5E93),
    ([string]([char]0x5220) + [char]0x9664),
    ([string]([char]0x4EA7) + [char]0x54C1 + [char]0x7248 + [char]0x672C)
)
$manifestPath = Join-Path $pluginRootFull '.codex-plugin\plugin.json'
$mcpPath = Join-Path $pluginRootFull '.mcp.json'
$readmePath = Join-Path $pluginRootFull 'README.md'
$pluginSkillRoot = Join-Path $pluginRootFull 'skills\healthy-fitness-coach'
$validationToolPath = Join-Path $scriptDir 'validate_plugin.ps1'

if (Test-Path -LiteralPath $validationToolPath -PathType Leaf) {
    $validationToolText = Get-Content -LiteralPath $validationToolPath -Raw -Encoding UTF8
    Assert-True ($validationToolText -notmatch '(?im)\[string\]\$PluginValidator\s*=\s*["''][A-Z]:\\') 'Validation tooling must not default PluginValidator to a machine-absolute user path'
    Assert-True ($validationToolText.Contains('$env:CODEX_HOME')) 'Validation tooling must prefer CODEX_HOME when available'
    Assert-True ($validationToolText.Contains("GetFolderPath('UserProfile')")) 'Validation tooling must derive a portable UserProfile fallback'
    Assert-True ($validationToolText.Contains('validate_plugin.py')) 'Validation tooling must derive the official validator script path'
    Assert-True ($validationToolText.Contains('Test-Path -LiteralPath $PluginValidator -PathType Leaf')) 'Validation tooling must validate the resolved official validator path'
}

$windowsUserPathPattern = '[A-Z]:' + [regex]::Escape([string][char]92) + 'Users' + [regex]::Escape([string][char]92)
$slash = [string][char]47
$percent = [string][char]37
$absoluteUserPathPattern = '(?im)(?:' + $windowsUserPathPattern + '|' + $slash + 'Users' + $slash + '|' + $slash + 'home' + $slash + '|' + $percent + 'USERPROFILE' + $percent + ')'
$portabilityFiles = @()
if (Test-Path -LiteralPath $validationToolPath -PathType Leaf) { $portabilityFiles += Get-Item -LiteralPath $validationToolPath }
foreach ($root in @($pluginRootFull, $distRootFull)) {
    if (Test-Path -LiteralPath $root -PathType Container) {
        $portabilityFiles += Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.Extension -in @('.json', '.js', '.md', '.ps1', '.yaml', '.yml') }
    }
}
foreach ($file in $portabilityFiles) {
    $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    Assert-True ($text -notmatch $absoluteUserPathPattern) "Machine-absolute user path included: $($file.FullName)"
}

Assert-True (Test-Path -LiteralPath $PluginRoot -PathType Container) "Plugin root is missing: $PluginRoot"
foreach ($path in @($manifestPath, $mcpPath, $readmePath, (Join-Path $pluginSkillRoot 'SKILL.md'))) {
    Assert-True (Test-Path -LiteralPath $path -PathType Leaf) "Required Plugin file is missing: $path"
}

$manifest = $null
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    try { $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $failures.Add("plugin.json is invalid JSON: $($_.Exception.Message)") }
}
if ($manifest) {
    $allowedManifestKeys = @('name', 'version', 'description', 'author', 'skills', 'mcpServers', 'interface')
    foreach ($key in @($manifest.psobject.Properties.Name)) { Assert-True ($allowedManifestKeys -contains $key) "Unsupported or fabricated plugin.json field: $key" }
    Assert-True ($manifest.name -eq 'healthy-fitness-coach-plugin') 'Manifest name must match plugin root'
    Assert-True ($manifest.version -eq '0.2.0') 'Manifest version must be strict semver 0.2.0'
    Assert-True ($manifest.version -match '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') 'Manifest version is not strict semver'
    Assert-True ($manifest.description -is [string] -and $manifest.description.Trim().Length -gt 0) 'Manifest description is required'
    Assert-True ($manifest.author.name -eq $authorName) 'Manifest author must match the declared developer'
    Assert-True ($manifest.author.psobject.Properties.Name.Count -eq 1) 'Manifest must not fabricate author contact fields'
    Assert-True ($manifest.skills -eq './skills/') 'Manifest skills must be ./skills/'
    Assert-True ($manifest.mcpServers -eq './.mcp.json') 'Manifest mcpServers must be ./.mcp.json'
    $interface = $manifest.interface
    foreach ($field in @('displayName', 'shortDescription', 'longDescription', 'developerName', 'category')) {
        Assert-True ($interface.$field -is [string] -and $interface.$field.Trim().Length -gt 0) "Interface field is missing: $field"
    }
    Assert-True ($interface.displayName -match '[\u4e00-\u9fff]') 'Interface displayName must be Chinese'
    Assert-True ($interface.shortDescription -match '[\u4e00-\u9fff]') 'Interface shortDescription must be Chinese'
    Assert-True ($interface.longDescription -match '[\u4e00-\u9fff]') 'Interface longDescription must be Chinese'
    Assert-True ($interface.developerName -eq $authorName) 'Interface developerName must match the declared developer'
    Assert-True ($interface.category -eq 'Health & Fitness') 'Interface category must be Health & Fitness'
    Assert-True ($interface.capabilities -is [array] -and $interface.capabilities.Count -gt 0 -and @($interface.capabilities | Where-Object { $_ -isnot [string] -or $_.Trim().Length -eq 0 }).Count -eq 0) 'Interface capabilities must be non-empty implemented strings'
    Assert-True ($interface.defaultPrompt -is [string] -and $interface.defaultPrompt.Trim().Length -gt 0 -and $interface.defaultPrompt.Length -le 128) 'Interface must include one concise defaultPrompt'
    foreach ($forbidden in @('websiteURL', 'privacyPolicyURL', 'termsOfServiceURL', 'hooks', 'apps', 'assets')) {
        Assert-True (-not ($manifest.psobject.Properties.Name -contains $forbidden) -and -not ($interface.psobject.Properties.Name -contains $forbidden)) "Manifest includes unsupported or fabricated field: $forbidden"
    }
}

$mcp = $null
if (Test-Path -LiteralPath $mcpPath -PathType Leaf) {
    try { $mcp = Get-Content -LiteralPath $mcpPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $failures.Add(".mcp.json is invalid JSON: $($_.Exception.Message)") }
}
if ($mcp) {
    Assert-True (@($mcp.psobject.Properties.Name) -join ',' -eq 'mcpServers') '.mcp.json must only declare mcpServers'
    $servers = @($mcp.mcpServers.psobject.Properties)
    Assert-True ($servers.Count -eq 1) '.mcp.json must contain exactly one MCP server'
    if ($servers.Count -eq 1) {
        $server = $servers[0].Value
        Assert-True ($server.command -eq 'node') 'MCP command must be node'
        Assert-True ($server.cwd -eq './mcp/xunji') 'MCP cwd must be ./mcp/xunji'
        Assert-True ($server.args -is [array] -and $server.args.Count -eq 1 -and $server.args[0] -eq 'src/server.js') 'MCP args must be the relative src/server.js entry point'
        Assert-True (-not ($server.psobject.Properties.Name -contains 'env')) 'MCP config must not inject credential environment variables'
        $runtimeCwd = Get-AbsolutePath (Join-Path $pluginRootFull $server.cwd)
        $runtimeEntry = Get-AbsolutePath (Join-Path $runtimeCwd $server.args[0])
        Assert-True (Test-StrictChild $pluginRootFull $runtimeCwd) 'MCP cwd escapes plugin root'
        Assert-True (Test-StrictChild $pluginRootFull $runtimeEntry) 'MCP entry point escapes plugin root'
        Assert-True (Test-Path -LiteralPath $runtimeEntry -PathType Leaf) 'MCP entry point is missing'
    }
}

if ((Test-Path -LiteralPath $PluginValidator -PathType Leaf) -and (Test-Path -LiteralPath $PluginRoot -PathType Container)) {
    & python $PluginValidator $PluginRoot
    Assert-True ($LASTEXITCODE -eq 0) 'Official plugin validator failed'
} else {
    $failures.Add("Official Plugin validator was not found at '$PluginValidator'. Install the Codex plugin-creator skill or pass -PluginValidator <path-to-validate_plugin.py>.")
}

if ((Test-Path -LiteralPath $SkillRoot -PathType Container) -and (Test-Path -LiteralPath $pluginSkillRoot -PathType Container)) {
    Assert-InventoryMatch (Get-Inventory $skillRootFull) (Get-Inventory $pluginSkillRoot) 'Plugin Skill parity'
}

if ($manifest -and $mcp -and (Test-Path -LiteralPath $pluginSkillRoot -PathType Container)) {
    $prohibited = @('coverage', '.cache', 'credentials', 'reports', '*.dpapi')
    Get-ChildItem -LiteralPath $pluginRootFull -Force -Recurse | ForEach-Object {
        foreach ($name in $prohibited) { Assert-True (-not ($_.Name -like $name)) "Prohibited runtime/user artifact included: $($_.FullName)" }
    }
    $machinePathPattern = $absoluteUserPathPattern
    $credentialValuePattern = '(?im)(?:api[_-]?key|xunji[_-]?key|secret|token)\s*[:=]\s*["''](?:[^"'']{8,})'
    Get-ChildItem -LiteralPath $pluginRootFull -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.Extension -in @('.json', '.js', '.md', '.ps1', '.yaml', '.yml') } | ForEach-Object {
        $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        Assert-True ($text -notmatch $machinePathPattern) "Machine-absolute user path included: $($_.FullName)"
        Assert-True ($text -notmatch $credentialValuePattern) "Credential-like value included: $($_.FullName)"
    }
    $trackedNodeModules = @(git ls-files -- 'healthy-fitness-coach-plugin/**/node_modules/**')
    Assert-True ($trackedNodeModules.Count -eq 0) 'node_modules must not be tracked in Plugin source'
}

if (Test-Path -LiteralPath $readmePath -PathType Leaf) {
    $readme = Get-Content -LiteralPath $readmePath -Raw -Encoding UTF8
    foreach ($term in @('Windows', '18.14.1', 'npm --prefix', 'ci --omit=dev --ignore-scripts', 'DPAPI', 'HealthyFitnessCoach', 'Garmin', 'Hono', 'Node 20') + $chineseTerms) {
        Assert-True ($readme.Contains($term)) "README is missing required boundary: $term"
    }
}

$credentialRemoval = Join-Path $pluginRootFull 'mcp\xunji\scripts\remove-credential.ps1'
if (Test-Path -LiteralPath $credentialRemoval -PathType Leaf) {
    $removeText = Get-Content -LiteralPath $credentialRemoval -Raw -Encoding UTF8
    foreach ($term in @('SupportsShouldProcess', 'GetFullPath', 'StartsWith', '-LiteralPath', 'ShouldProcess')) {
        Assert-True ($removeText.Contains($term)) "Credential deletion helper lacks safety guard: $term"
    }
}

if (-not $SkipStdio -and $mcp -and @($mcp.mcpServers.psobject.Properties).Count -eq 1) {
    $server = @($mcp.mcpServers.psobject.Properties)[0].Value
    & node (Join-Path $PSScriptRoot 'plugin-stdio-handshake.js') $pluginRootFull $server.command $server.cwd @($server.args)
    Assert-True ($LASTEXITCODE -eq 0) 'Plugin-declared MCP stdio handshake failed'
}

if (-not $SkipDist) {
    Assert-True (Test-Path -LiteralPath $DistRoot -PathType Container) "Dist plugin directory is missing: $DistRoot"
    if ((Test-Path -LiteralPath $DistRoot -PathType Container) -and (Test-Path -LiteralPath $PluginRoot -PathType Container)) {
        Assert-InventoryMatch (Get-Inventory $pluginRootFull -ExcludeNodeModules) (Get-Inventory $distRootFull) 'Dist plugin parity'
        $distNodeModules = @(Get-ChildItem -LiteralPath $distRootFull -Recurse -Directory -Force | Where-Object { $_.Name -eq 'node_modules' })
        Assert-True ($distNodeModules.Count -eq 0) 'Dist plugin must not bundle node_modules'
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PASS: plugin schema, MCP stdio, skill parity, privacy boundaries, and dist parity validated'
