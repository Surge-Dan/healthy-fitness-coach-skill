$ErrorActionPreference = 'Stop'
$scanner = Join-Path $PSScriptRoot 'secret-scan.ps1'
$fixtures = Join-Path $PSScriptRoot 'fixtures\secret-scan'

foreach ($name in @('xunji-token.txt', 'bearer-token.txt', 'quoted-api-key.txt', 'unquoted-api-key.txt', 'bare-high-entropy.txt')) {
    & $scanner -Roots (Join-Path $fixtures $name) -Quiet
    if ($LASTEXITCODE -ne 1) { throw "Expected detector failure for $name" }
}
foreach ($name in @('unknown-host-url.txt', 'known-host-query-token.txt', 'known-host-query-signature.txt', 'asset-nontemplate-path.txt', 'asset-traversal-path.txt', 'asset-query-token.txt', 'asset-absolute-path.txt')) {
    & $scanner -Roots (Join-Path $fixtures $name) -Quiet
    if ($LASTEXITCODE -ne 1) { throw "Expected URL detector failure for $name" }
}

& $scanner -Roots (Join-Path $fixtures 'documented-hashes.txt') -Quiet
if ($LASTEXITCODE -ne 0) { throw 'Documented SHA-256, commit hash, and package integrity hash must be allowed' }

& $scanner -Roots (Join-Path $fixtures 'known-evidence-source-url.txt') -Quiet
if ($LASTEXITCODE -ne 0) { throw 'An exact known public evidence-source host with a path-only identifier must be allowed' }

& $scanner -Roots (Join-Path $fixtures 'structured-eval-run-id.txt') -Quiet
if ($LASTEXITCODE -ne 0) { throw 'A structured evaluator run identifier must be allowed' }

& $scanner -Roots (Join-Path $fixtures 'asset-template-path.txt') -Quiet
if ($LASTEXITCODE -ne 0) { throw 'A constrained lowercase asset template path must be allowed' }

$immutableFixture = Join-Path $fixtures 'xunji-token.txt'
$manifestPath = Join-Path $env:TEMP 'healthy-fitness-secret-scan-immutable-manifest.json'
$manifest = @{ files = @(@{ path = (Resolve-Path $immutableFixture).Path; sha256 = (Get-FileHash -LiteralPath $immutableFixture -Algorithm SHA256).Hash }) } | ConvertTo-Json
Set-Content -LiteralPath $manifestPath -Value $manifest -Encoding UTF8
& $scanner -Roots $immutableFixture -ImmutableManifest $manifestPath -Quiet
if ($LASTEXITCODE -ne 0) { throw 'Exact immutable manifest hash must allow only its verified fixture' }

$tamperedFixture = Join-Path $env:TEMP 'healthy-fitness-secret-scan-tampered-fixture.txt'
Copy-Item -LiteralPath $immutableFixture -Destination $tamperedFixture -Force
$tamperedManifestPath = Join-Path $env:TEMP 'healthy-fitness-secret-scan-tampered-manifest.json'
$tamperedManifest = @{ files = @(@{ path = (Resolve-Path $tamperedFixture).Path; sha256 = (Get-FileHash -LiteralPath $tamperedFixture -Algorithm SHA256).Hash }) } | ConvertTo-Json
[IO.File]::WriteAllText($tamperedFixture, 'harmless changed frozen evidence', [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($tamperedManifestPath, $tamperedManifest, [Text.UTF8Encoding]::new($false))
& $scanner -Roots $tamperedFixture -ImmutableManifest $tamperedManifestPath -Quiet
if ($LASTEXITCODE -ne 1) { throw 'A changed frozen-evidence file must fail its immutable hash check before being skipped' }

Write-Output 'PASS: secret scanner catches all synthetic leak shapes and permits documented hashes'
