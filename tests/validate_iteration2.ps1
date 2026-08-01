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

$baselineManifestPath = Join-Path $WorkspaceRoot 'baseline-evidence-manifest.json'
Assert-True (Test-Path -LiteralPath $baselineManifestPath -PathType Leaf) 'Missing immutable baseline manifest'
if (Test-Path -LiteralPath $baselineManifestPath -PathType Leaf) {
    try {
        $baselineManifest = Get-Content -LiteralPath $baselineManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($baselineManifest.baseline_commit -eq '7b0db7a') 'Baseline manifest must name the immutable pre-Task5 commit'
        Assert-True (@($baselineManifest.files).Count -eq 3) 'Baseline manifest must cover exactly three referenced files'
        foreach ($entry in @($baselineManifest.files)) {
            Assert-True (Test-Path -LiteralPath $entry.path -PathType Leaf) "Immutable baseline file is missing: $($entry.path)"
            if (Test-Path -LiteralPath $entry.path -PathType Leaf) {
                $baseBlob = (git rev-parse "$($baselineManifest.baseline_commit):$($entry.path)").Trim()
                $currentBlob = (git hash-object --no-filters $entry.path).Trim()
                $currentHash = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash
                Assert-True ($baseBlob -eq $entry.git_blob_sha1) "Baseline blob manifest mismatch: $($entry.path)"
                Assert-True ($currentBlob -eq $baseBlob) "Immutable baseline bytes changed: $($entry.path)"
                Assert-True ($currentHash -eq $entry.sha256) "Immutable baseline SHA-256 changed: $($entry.path)"
            }
        }
    } catch {
        $failures.Add("Invalid baseline manifest: $($_.Exception.Message)")
    }
}

$frozenRoot = Join-Path $PSScriptRoot '..\healthy-fitness-coach-workspace\iteration-1'
$frozenManifestPath = Join-Path $frozenRoot 'frozen-evaluator-evidence-manifest.json'
Assert-True (Test-Path -LiteralPath $frozenManifestPath -PathType Leaf) 'Missing frozen evaluator evidence manifest'
if (Test-Path -LiteralPath $frozenManifestPath -PathType Leaf) {
    try {
        $frozenManifest = Get-Content -LiteralPath $frozenManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($frozenManifest.baseline_commit -eq '7b0db7a') 'Frozen evaluator manifest must name the immutable pre-Task5 commit'
        Assert-True (-not [string]::IsNullOrWhiteSpace([string]$frozenManifest.scope)) 'Frozen evaluator manifest must describe its restricted scope'
        $expectedFrozenPaths = @(Get-ChildItem -LiteralPath $frozenRoot -Recurse -File | Where-Object { $_.FullName -match '[\\/]outputs[\\/].*\.md$' -or $_.Name -eq 'review.html' } | ForEach-Object { $_.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/') } | Sort-Object)
        $manifestPaths = @($frozenManifest.files | ForEach-Object { [string]$_.path } | Sort-Object)
        Assert-True (($expectedFrozenPaths -join "`n") -eq ($manifestPaths -join "`n")) 'Frozen evaluator manifest has missing or extra preserved files'
        foreach ($entry in @($frozenManifest.files)) {
            Assert-True (Test-Path -LiteralPath $entry.path -PathType Leaf) "Frozen evaluator file is missing: $($entry.path)"
            if (Test-Path -LiteralPath $entry.path -PathType Leaf) {
                $baseBlob = (git rev-parse "$($frozenManifest.baseline_commit):$($entry.path)").Trim()
                $currentBlob = (git hash-object --no-filters $entry.path).Trim()
                $currentHash = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash
                Assert-True ($baseBlob -eq $entry.git_blob_sha1) "Frozen evaluator blob manifest mismatch: $($entry.path)"
                Assert-True ($currentBlob -eq $baseBlob) "Frozen evaluator bytes changed: $($entry.path)"
                Assert-True ($currentHash -eq $entry.sha256) "Frozen evaluator SHA-256 changed: $($entry.path)"
            }
        }
    } catch {
        $failures.Add("Invalid frozen evaluator manifest: $($_.Exception.Message)")
    }
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
    $dataMatch = [regex]::Match($review, '(?m)^\s*const EMBEDDED_DATA = (.+);\s*$')
    Assert-True ($dataMatch.Success) 'Review page lacks embedded data'
    if ($dataMatch.Success) {
        try {
            $embedded = $dataMatch.Groups[1].Value | ConvertFrom-Json
            $pairedRoots = @(Get-ChildItem -LiteralPath $WorkspaceRoot -Directory | Where-Object { $_.Name -like 'eval-*' -and $_.Name -notlike 'eval-fresh-*' })
            Assert-True ($pairedRoots.Count -eq 6) 'Expected six paired eval roots for review validation'
            $pairedRuns = @($embedded.runs | Where-Object { $_.id -match '-(with_skill|without_skill)-run-1$' -and $_.eval_id -in @(13, 14, 15, 16, 17, 18) })
            Assert-True ($pairedRuns.Count -eq 12) 'Review must embed exactly twelve paired behavior runs'
            foreach ($root in $pairedRoots) {
                $metadata = Get-Content -LiteralPath (Join-Path $root.FullName 'eval_metadata.json') -Raw -Encoding UTF8 | ConvertFrom-Json
                foreach ($configuration in @('with_skill', 'without_skill')) {
                    $expectedId = "$($root.Name)-$configuration-run-1"
                    $matching = @($pairedRuns | Where-Object { $_.id -eq $expectedId })
                    Assert-True ($matching.Count -eq 1) "Review missing paired run $expectedId"
                    if ($matching.Count -eq 1) {
                        Assert-True ($null -ne $matching[0].eval_id -and [int]$matching[0].eval_id -eq [int]$metadata.eval_id) "Review eval_id mismatch: $expectedId"
                        Assert-True ($matching[0].prompt -eq $metadata.prompt) "Review prompt mismatch: $expectedId"
                    }
                }
            }
        } catch {
            $failures.Add("Review embedded data is invalid or incomplete: $($_.Exception.Message)")
        }
    }
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
        $comparisonDirectory = Split-Path -Parent $comparisonPath
        $promptPath = Join-Path $comparisonDirectory 'comparator-prompt.md'
        $auditPath = Join-Path $comparisonDirectory 'audit.md'
        $provenancePath = Join-Path $comparisonDirectory 'provenance.json'
        $candidateAPath = Join-Path $comparisonDirectory 'candidate-a\submission.md'
        $candidateBPath = Join-Path $comparisonDirectory 'candidate-b\submission.md'
        Assert-True (Test-Path -LiteralPath $promptPath -PathType Leaf) "Missing blind comparator prompt: $($entry.eval_id)"
        Assert-True (Test-Path -LiteralPath $auditPath -PathType Leaf) "Missing blind comparator audit: $($entry.eval_id)"
        foreach ($candidate in @(@{ Label = 'A'; Path = $candidateAPath; Mapping = $entry.candidate_a }, @{ Label = 'B'; Path = $candidateBPath; Mapping = $entry.candidate_b })) {
            Assert-True ($null -ne $candidate.Mapping) "Missing neutral candidate mapping: eval $($entry.eval_id) $($candidate.Label)"
            Assert-True (Test-Path -LiteralPath $candidate.Path -PathType Leaf) "Missing neutral candidate input: eval $($entry.eval_id) $($candidate.Label)"
            if ($null -ne $candidate.Mapping -and (Test-Path -LiteralPath $candidate.Path -PathType Leaf)) {
                $sourcePath = Join-Path $WorkspaceRoot ([string]$candidate.Mapping.source_artifact)
                Assert-True (Test-Path -LiteralPath $sourcePath -PathType Leaf) "Mapped source artifact is missing: eval $($entry.eval_id) $($candidate.Label)"
                $candidateHash = (Get-FileHash -LiteralPath $candidate.Path -Algorithm SHA256).Hash
                Assert-True ($candidateHash -eq $candidate.Mapping.sha256) "Neutral candidate hash disagrees with mapping: eval $($entry.eval_id) $($candidate.Label)"
                if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
                    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
                    Assert-True ($candidateHash -eq $sourceHash) "Neutral candidate differs from mapped source: eval $($entry.eval_id) $($candidate.Label)"
                }
                $candidateText = Get-Content -LiteralPath $candidate.Path -Raw -Encoding UTF8
                Assert-True ($candidateText -notmatch '(?i)healthy-fitness-coach|with_skill|without_skill') "Neutral candidate contains source identity metadata: eval $($entry.eval_id) $($candidate.Label)"
            }
        }
        foreach ($blindFile in @($promptPath, $auditPath)) {
            if (Test-Path -LiteralPath $blindFile -PathType Leaf) {
                $blindText = Get-Content -LiteralPath $blindFile -Raw -Encoding UTF8
                Assert-True ($blindText -notmatch '(?i)\bmapping\b|\bV[12]\b|healthy-fitness-coach|with_skill|without_skill|eval-[a-z0-9-]+') "Blind artifact reveals hidden identity: $blindFile"
                Assert-True ($blindText -notmatch '(?i)(?:\.\./)?(?:healthy-fitness-coach-workspace|eval-[a-z0-9-]+)/(?:with_skill|without_skill)') "Blind artifact names a source output path: $blindFile"
            }
        }
        Assert-True (Test-Path -LiteralPath $provenancePath -PathType Leaf) "Missing blind comparison provenance: $($entry.eval_id)"
        if (Test-Path -LiteralPath $provenancePath -PathType Leaf) {
            try {
                $provenance = Get-Content -LiteralPath $provenancePath -Raw -Encoding UTF8 | ConvertFrom-Json
                Assert-True ([string]$provenance.generated_at_utc -match '^\d{4}-\d{2}-\d{2}T.*Z$') "Invalid provenance UTC timestamp: $($entry.eval_id)"
                Assert-True (-not [string]::IsNullOrWhiteSpace([string]$provenance.comparator_task)) "Missing comparator task identity: $($entry.eval_id)"
                Assert-True ($provenance.mapping_not_supplied -eq $true) "Provenance must declare mapping withheld: $($entry.eval_id)"
                $permitted = @($provenance.permitted_files | ForEach-Object { [string]$_ } | Sort-Object)
                Assert-True (($permitted -join "`n") -eq (@('candidate-a/submission.md', 'candidate-b/submission.md', 'comparator-prompt.md') -join "`n")) "Invalid permitted files: $($entry.eval_id)"
                Assert-True ($provenance.input_sha256.candidate_a -eq (Get-FileHash -LiteralPath $candidateAPath -Algorithm SHA256).Hash) "Candidate A provenance hash mismatch: $($entry.eval_id)"
                Assert-True ($provenance.input_sha256.candidate_b -eq (Get-FileHash -LiteralPath $candidateBPath -Algorithm SHA256).Hash) "Candidate B provenance hash mismatch: $($entry.eval_id)"
                Assert-True ($provenance.result_sha256 -eq (Get-FileHash -LiteralPath $comparisonPath -Algorithm SHA256).Hash) "Comparator result provenance hash mismatch: $($entry.eval_id)"
                $provenanceText = Get-Content -LiteralPath $provenancePath -Raw -Encoding UTF8
                Assert-True ($provenanceText -notmatch '(?i)\bV[12]\b|healthy-fitness-coach|with_skill|without_skill|(?:\.\./)?(?:healthy-fitness-coach-workspace|eval-[a-z0-9-]+)/(?:with_skill|without_skill)') "Provenance reveals hidden identity or source path: $($entry.eval_id)"
            } catch {
                $failures.Add("Invalid provenance JSON: $($entry.eval_id): $($_.Exception.Message)")
            }
        }
        if (Test-Path -LiteralPath $comparisonPath -PathType Leaf) {
            $comparison = Get-Content -LiteralPath $comparisonPath -Raw -Encoding UTF8 | ConvertFrom-Json
            Assert-True (@('A', 'B', 'TIE') -contains $comparison.winner) "Invalid blind winner: $($entry.comparison_file)"
            if ($comparison.winner -in @('A', 'B')) {
                $winningVersion = [string]$entry.("candidate_$($comparison.winner.ToLowerInvariant())").version
                Assert-True ($winningVersion -eq 'V2') "Unblinded blind winner is not the candidate: eval $($entry.eval_id)"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PASS: iteration-2 grading, benchmark, review, and blind-comparison consistency validated'
