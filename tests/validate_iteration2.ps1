param(
    [string]$WorkspaceRoot = (Join-Path $PSScriptRoot '..\healthy-fitness-coach-workspace\iteration-2')
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { $script:failures.Add($Message) }
}

function Compare-Number {
    param($Left, $Right)
    return [math]::Abs(([double]$Left) - ([double]$Right)) -lt 0.000001
}

$gradingFiles = @(Get-ChildItem -LiteralPath $WorkspaceRoot -Recurse -Filter grading.json -File)
Assert-True ($gradingFiles.Count -eq 14) 'Expected exactly 14 fresh grading files (12 paired behavior runs plus 2 V2 safety runs)'

foreach ($file in $gradingFiles) {
    try {
        $grading = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $expectations = @($grading.expectations)
        $passed = @($expectations | Where-Object { $_.passed -eq $true }).Count
        $failed = @($expectations | Where-Object { $_.passed -ne $true }).Count
        Assert-True ($expectations.Count -gt 0) "No expectations in $($file.FullName)"
        Assert-True ($grading.summary.passed -eq $passed) "Passed summary mismatch: $($file.FullName)"
        Assert-True ($grading.summary.failed -eq $failed) "Failed summary mismatch: $($file.FullName)"
        Assert-True ($grading.summary.total -eq $expectations.Count) "Total summary mismatch: $($file.FullName)"
        Assert-True (Compare-Number $grading.summary.pass_rate ($passed / $expectations.Count)) "Pass-rate summary mismatch: $($file.FullName)"
        foreach ($expectation in $expectations) {
            Assert-True (-not [string]::IsNullOrWhiteSpace([string]$expectation.evidence)) "Missing grading evidence: $($file.FullName)"
        }
    } catch {
        $failures.Add("Invalid grading artifact $($file.FullName): $($_.Exception.Message)")
    }
}

$benchmarkPath = Join-Path $WorkspaceRoot 'benchmark.json'
Assert-True (Test-Path -LiteralPath $benchmarkPath -PathType Leaf) 'Missing benchmark.json'
if (Test-Path -LiteralPath $benchmarkPath -PathType Leaf) {
    try {
        $benchmark = Get-Content -LiteralPath $benchmarkPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($benchmark.metadata.runs_per_configuration -eq 1) 'Benchmark run count must be one'
        Assert-True ($benchmark.metadata.configuration_mapping.with_skill -eq 'V2 candidate') 'with_skill must map to V2 candidate'
        Assert-True ($benchmark.metadata.configuration_mapping.without_skill -eq 'V1 frozen baseline') 'without_skill must map to frozen V1 baseline'
        Assert-True (@($benchmark.runs).Count -eq 12) 'Benchmark must have 12 paired behavior runs'
        foreach ($run in @($benchmark.runs)) {
            $expectedPath = Get-ChildItem -LiteralPath $WorkspaceRoot -Recurse -Filter grading.json | Where-Object { $_.FullName -like "*eval-$($run.eval_name)*\$($run.configuration)\run-$($run.run_number)\grading.json" }
            Assert-True (@($expectedPath).Count -eq 1) "Cannot resolve benchmark run $($run.eval_id)/$($run.configuration)"
            if (@($expectedPath).Count -eq 1) {
                $grading = Get-Content -LiteralPath $expectedPath[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                Assert-True ($run.result.passed -eq $grading.summary.passed) "Benchmark passed mismatch: $($run.eval_id)/$($run.configuration)"
                Assert-True ($run.result.failed -eq $grading.summary.failed) "Benchmark failed mismatch: $($run.eval_id)/$($run.configuration)"
                Assert-True ($run.result.total -eq $grading.summary.total) "Benchmark total mismatch: $($run.eval_id)/$($run.configuration)"
                Assert-True (Compare-Number $run.result.pass_rate $grading.summary.pass_rate) "Benchmark rate mismatch: $($run.eval_id)/$($run.configuration)"
            }
        }
        foreach ($configuration in @('with_skill', 'without_skill')) {
            $values = @($benchmark.runs | Where-Object { $_.configuration -eq $configuration } | ForEach-Object { [double]$_.result.pass_rate })
            $mean = ($values | Measure-Object -Average).Average
            Assert-True (Compare-Number $benchmark.run_summary.$configuration.pass_rate.mean $mean) "Benchmark mean mismatch: $configuration"
        }
    } catch {
        $failures.Add("Invalid benchmark artifact: $($_.Exception.Message)")
    }
}

$reviewPath = Join-Path $WorkspaceRoot 'review.html'
Assert-True (Test-Path -LiteralPath $reviewPath -PathType Leaf) 'Missing official static review.html'
if (Test-Path -LiteralPath $reviewPath -PathType Leaf) {
    $review = Get-Content -LiteralPath $reviewPath -Raw -Encoding UTF8
    Assert-True ($review -match 'const EMBEDDED_DATA') 'Review page lacks embedded data'
    Assert-True ($review -notmatch '(?i)C:\\Users\\Daniel|api[_-]?key\s*[:=]\s*["'']') 'Review page contains a user path or credential-like value'
}

$mappingPath = Join-Path $WorkspaceRoot 'blind-comparisons\mapping.json'
Assert-True (Test-Path -LiteralPath $mappingPath -PathType Leaf) 'Missing blind comparison mapping'
if (Test-Path -LiteralPath $mappingPath -PathType Leaf) {
    $mapping = Get-Content -LiteralPath $mappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True (@($mapping.mappings).Count -eq 3) 'Expected three blind mappings'
    foreach ($entry in @($mapping.mappings)) {
        $comparisonPath = Join-Path (Split-Path -Parent $mappingPath) $entry.comparison_file
        Assert-True (Test-Path -LiteralPath $comparisonPath -PathType Leaf) "Missing comparison output: $($entry.comparison_file)"
        if (Test-Path -LiteralPath $comparisonPath -PathType Leaf) {
            $comparison = Get-Content -LiteralPath $comparisonPath -Raw -Encoding UTF8 | ConvertFrom-Json
            Assert-True (@('A', 'B', 'TIE') -contains $comparison.winner) "Invalid blind winner: $($entry.comparison_file)"
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PASS: iteration-2 grading, benchmark, review, and blind-comparison consistency validated'
