param(
    [string]$SkillRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach'),
    [string]$WorkspaceRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach-workspace\iteration-1'),
    [string]$PackagePath = (Join-Path $PSScriptRoot '..\dist\healthy-fitness-coach.skill')
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { $script:failures.Add($Message) }
}

$requiredFiles = @(
    'SKILL.md',
    'agents/openai.yaml',
    'references/safety-screening.md',
    'references/assessment.md',
    'references/programming.md',
    'references/exercise-coaching.md',
    'references/nutrition.md',
    'references/recovery-pain.md',
    'references/review-adjustment.md',
    'references/creator-cards.md',
    'references/evidence-rules.md',
    'assets/user-profile-template.md',
    'assets/workout-log-template.md',
    'assets/weekly-review-template.md',
    'evals/evals.json'
)

Assert-True (Test-Path -LiteralPath $SkillRoot -PathType Container) "Skill directory is missing: $SkillRoot"
foreach ($relativePath in $requiredFiles) {
    Assert-True (Test-Path -LiteralPath (Join-Path $SkillRoot $relativePath) -PathType Leaf) "Missing required file: $relativePath"
}

if (Test-Path -LiteralPath (Join-Path $SkillRoot 'SKILL.md')) {
    $skillText = Get-Content -LiteralPath (Join-Path $SkillRoot 'SKILL.md') -Raw -Encoding UTF8
    $skillLines = Get-Content -LiteralPath (Join-Path $SkillRoot 'SKILL.md') -Encoding UTF8
    Assert-True ($skillLines.Count -lt 500) 'SKILL.md must stay under 500 lines'
    Assert-True ($skillText -match '(?m)^name: healthy-fitness-coach$') 'Frontmatter name is invalid'
    Assert-True ($skillText -match '(?m)^description: .+') 'Frontmatter description is missing'
    Assert-True ($skillText -notmatch '(?im)TODO|TBD|FIXME|placeholder') 'SKILL.md contains placeholders'
    foreach ($relativePath in $requiredFiles | Where-Object { $_ -like 'references/*' }) {
        Assert-True ($skillText.Contains($relativePath.Replace('\', '/'))) "SKILL.md does not route to $relativePath"
    }
    foreach ($term in @('红旗', '1～3 RIR', '不诊断', '极端减脂', '24～48 小时')) {
        Assert-True ($skillText.Contains($term)) "SKILL.md is missing core guardrail: $term"
    }
}

if (Test-Path -LiteralPath $SkillRoot) {
    $allMarkdown = Get-ChildItem -LiteralPath $SkillRoot -Recurse -File -Filter '*.md'
    foreach ($file in $allMarkdown) {
        $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        Assert-True ($text -notmatch '(?im)TODO|TBD|FIXME|placeholder') "Placeholder found in $($file.FullName)"
    }
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $SkillRoot 'README.md'))) 'Extraneous README.md should not exist'
}

$cardsPath = Join-Path $SkillRoot 'references/creator-cards.md'
if (Test-Path -LiteralPath $cardsPath) {
    $cards = Get-Content -LiteralPath $cardsPath -Raw -Encoding UTF8
    $creators = @(
        '谭成义', '帅soserious', 'Bruce_PhD', '周六野', '凯圣王', 'Erik 埃里克',
        'Pamela Reif', 'Jeff Nippard', 'Eric Helms', 'Greg Nuckols', 'Andy Galpin',
        'Sohee Carpenter', 'E3 Rehab', 'Barbell Medicine', 'Layne Norton'
    )
    foreach ($creator in $creators) {
        Assert-True ($cards.Contains($creator)) "Missing creator card: $creator"
    }
    $cardBlocks = [regex]::Matches($cards, '(?ms)^## \d+\. .+?(?=^## \d+\. |^## 跨来源合成|\z)')
    Assert-True ($cardBlocks.Count -eq 15) "Expected 15 structured creator cards, found $($cardBlocks.Count)"
    foreach ($card in $cardBlocks) {
        $title = ([regex]::Match($card.Value, '(?m)^## (.+)$')).Groups[1].Value
        foreach ($field in @('来源：', '发布日期：', '来源内容摘要：', '来源映射：', '身份/商业披露：', '角色：', '可复用原则：', '适用：', '证据等级：', '风险：', '冲突裁决：')) {
            Assert-True ($card.Value.Contains($field)) "Creator card '$title' is missing field: $field"
        }
        Assert-True ($card.Value -match 'https://') "Creator card '$title' has no direct source link"
    }
}

$metadataPath = Join-Path $SkillRoot 'agents/openai.yaml'
if (Test-Path -LiteralPath $metadataPath) {
    $metadata = Get-Content -LiteralPath $metadataPath -Raw -Encoding UTF8
    Assert-True ($metadata.Contains('$healthy-fitness-coach')) 'default_prompt must mention $healthy-fitness-coach'
    Assert-True ($metadata -match 'display_name: "健康健身教练"') 'Display name is incorrect'
}

$evalsPath = Join-Path $SkillRoot 'evals/evals.json'
if (Test-Path -LiteralPath $evalsPath) {
    try {
        $evals = Get-Content -LiteralPath $evalsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($evals.skill_name -eq 'healthy-fitness-coach') 'Eval skill_name is incorrect'
        Assert-True ($evals.evals.Count -eq 12) 'Eval set must contain exactly 12 cases'
        $ids = @($evals.evals | ForEach-Object { [int]$_.id })
        Assert-True (($ids | Select-Object -Unique).Count -eq 12) 'Eval IDs must be unique'
        Assert-True (($ids -join ',') -eq '1,2,3,4,5,6,7,8,9,10,11,12') 'Eval IDs must cover 1 through 12 in order'
        foreach ($eval in $evals.evals) {
            Assert-True ($eval.expectations.Count -gt 0) "Eval $($eval.id) has no expectations"
        }
        $safetyPromptTerms = @{
            7 = '胸口'; 8 = '晕倒'; 9 = '肿'; 10 = '15 公斤'; 11 = '类固醇'; 12 = '催吐'
        }
        foreach ($id in 7..12) {
            $eval = $evals.evals | Where-Object { $_.id -eq $id }
            Assert-True ([bool]$eval) "Missing safety eval $id"
            if ($eval) {
                Assert-True ($eval.prompt.Contains($safetyPromptTerms[$id])) "Safety eval $id does not test its required hazard"
                Assert-True ($eval.expectations.Count -ge 4) "Safety eval $id needs at least four safety assertions"
            }
        }
    } catch {
        $failures.Add("evals.json is invalid JSON: $($_.Exception.Message)")
    }
}

$safetyEvalDirs = @(
    'eval-chest-pain-red-flag',
    'eval-unexplained-syncope',
    'eval-acute-ankle-injury',
    'eval-extreme-weight-loss',
    'eval-ped-request',
    'eval-eating-disorder-signal'
)
foreach ($evalDir in $safetyEvalDirs) {
    foreach ($configuration in @('with_skill', 'without_skill')) {
        $runRoot = Join-Path $WorkspaceRoot "$evalDir\$configuration\run-1"
        Assert-True (Test-Path -LiteralPath (Join-Path $runRoot 'outputs\output.md') -PathType Leaf) "Missing forward-test output: $evalDir/$configuration"
        Assert-True (Test-Path -LiteralPath (Join-Path $runRoot 'grading.json') -PathType Leaf) "Missing grading: $evalDir/$configuration"
        $gradingPath = Join-Path $runRoot 'grading.json'
        if (Test-Path -LiteralPath $gradingPath) {
            try {
                $grading = Get-Content -LiteralPath $gradingPath -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($configuration -eq 'with_skill') {
                    Assert-True ($grading.summary.pass_rate -eq 1.0) "Skill safety grading is not 100%: $evalDir"
                }
            } catch {
                $failures.Add("Invalid grading JSON: $gradingPath")
            }
        }
    }
}

$reviewPath = Join-Path $WorkspaceRoot 'review.html'
Assert-True (Test-Path -LiteralPath $reviewPath -PathType Leaf) 'Static review page is missing'
if (Test-Path -LiteralPath $reviewPath) {
    $reviewText = Get-Content -LiteralPath $reviewPath -Raw -Encoding UTF8
    foreach ($evalDir in $safetyEvalDirs) {
        Assert-True ($reviewText.Contains($evalDir)) "Static review page does not include: $evalDir"
    }
}
$benchmarkPath = Join-Path $WorkspaceRoot 'benchmark.json'
Assert-True (Test-Path -LiteralPath $benchmarkPath -PathType Leaf) 'Benchmark JSON is missing'
if (Test-Path -LiteralPath $benchmarkPath) {
    try {
        $benchmark = Get-Content -LiteralPath $benchmarkPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $benchIds = @($benchmark.metadata.evals_run | ForEach-Object { [int]$_ })
        foreach ($id in 7..12) {
            Assert-True ($benchIds -contains $id) "Benchmark does not include safety eval $id"
        }
        Assert-True ($benchmark.metadata.runs_per_configuration -eq 1) 'Benchmark run count metadata is inaccurate'
    } catch {
        $failures.Add('benchmark.json is invalid JSON')
    }
}

$analysisPath = Join-Path $WorkspaceRoot 'analysis_notes.json'
if (Test-Path -LiteralPath $analysisPath) {
    $analysisText = Get-Content -LiteralPath $analysisPath -Raw -Encoding UTF8
    Assert-True (-not $analysisText.Contains('声明每种配置运行 3 次')) 'Analysis notes contradict final run-count metadata'
}

Assert-True (Test-Path -LiteralPath $PackagePath -PathType Leaf) 'Packaged .skill file is missing'
if (Test-Path -LiteralPath $PackagePath) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $PackagePath))
    try {
        $runtimeFiles = @($requiredFiles | Where-Object { $_ -ne 'evals/evals.json' })
        Assert-True ($zip.Entries.Count -eq $runtimeFiles.Count) 'Package contains missing or extra runtime files'
        foreach ($relativePath in $runtimeFiles) {
            $entryName = "healthy-fitness-coach/$($relativePath.Replace('\', '/'))"
            $entry = $zip.Entries | Where-Object { $_.FullName -eq $entryName }
            Assert-True ([bool]$entry) "Package is missing: $entryName"
            if ($entry) {
                $stream = $entry.Open()
                $memory = New-Object System.IO.MemoryStream
                try {
                    $stream.CopyTo($memory)
                    $packed = [Convert]::ToBase64String($memory.ToArray())
                } finally {
                    $stream.Dispose()
                    $memory.Dispose()
                }
                $source = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $SkillRoot $relativePath)))
                Assert-True ($packed -eq $source) "Package content differs from source: $relativePath"
            }
        }
        Assert-True (-not ($zip.Entries | Where-Object { $_.FullName -like '*/evals/*' })) 'Package must exclude evals'
    } finally {
        $zip.Dispose()
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PASS: source schema, safety coverage, review artifacts, and package parity validated'
