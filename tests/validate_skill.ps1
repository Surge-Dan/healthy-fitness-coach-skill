param(
    [string]$SkillRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach')
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

$allMarkdown = @()
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
    foreach ($field in @('证据等级', '适用', '风险', '冲突')) {
        Assert-True ($cards.Contains($field)) "Creator cards are missing field: $field"
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
        Assert-True ($evals.evals.Count -ge 12) 'Eval set must contain at least 12 cases'
        foreach ($eval in $evals.evals) {
            Assert-True ($eval.expectations.Count -gt 0) "Eval $($eval.id) has no expectations"
        }
    } catch {
        $failures.Add("evals.json is invalid JSON: $($_.Exception.Message)")
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output "PASS: healthy-fitness-coach structure and guardrails validated"
