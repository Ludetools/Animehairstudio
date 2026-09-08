param(
  [Parameter(Mandatory = $true)]
  [string]$TestNamePattern,
  [switch]$IncludeLocalization
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCandidates = @(
  @(
    (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
)

if (-not $nodeCandidates.Count) {
  throw "Could not find Node.js on PATH or in the bundled Codex runtime."
}

$nodePath = $nodeCandidates[0]

function Invoke-NodeStep([string]$Name, [string[]]$Arguments) {
  Write-Output "[verify] $Name"
  & $nodePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

Push-Location $projectRoot
try {
  Invoke-NodeStep "Run focused DOM contract" @(
    "--test",
    "--test-name-pattern=$TestNamePattern",
    "tests/dom-contract.test.mjs"
  )
  if ($IncludeLocalization) {
    Invoke-NodeStep "Run localization contracts" @("--test", "tests/localization.test.mjs")
  }
  Write-Output "[verify] Focused micro-UI checks passed."
} finally {
  Pop-Location
}
