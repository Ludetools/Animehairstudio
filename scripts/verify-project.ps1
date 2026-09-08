param(
  [switch]$IncludeServerHealth,
  [string[]]$TestFiles = @(),
  [string]$TestNamePattern = ""
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
  $temporaryModule = Join-Path ([IO.Path]::GetTempPath()) ("anime-hair-studio-app-{0}.mjs" -f [guid]::NewGuid().ToString("N"))
  Copy-Item -LiteralPath "app.js" -Destination $temporaryModule
  try {
    Invoke-NodeStep "Check browser application syntax" @("--check", $temporaryModule)
  } finally {
    Remove-Item -LiteralPath $temporaryModule -Force -ErrorAction SilentlyContinue
  }
  Invoke-NodeStep "Check local server syntax" @("--check", "server.js")
  if (-not (Test-Path -LiteralPath "node_modules/eslint/bin/eslint.js")) {
    throw "Missing development dependencies. Run pnpm install --frozen-lockfile before verifying."
  }
  Invoke-NodeStep "Check undefined JavaScript names" @("node_modules/eslint/bin/eslint.js", ".")
  $defaultTestFiles = @(Get-ChildItem -LiteralPath "tests" -Recurse -Filter "*.test.mjs" |
    Sort-Object FullName | ForEach-Object { $_.FullName })
  if (-not $defaultTestFiles.Count) { throw "No regression tests discovered." }
  $selectedTestFiles = if ($TestFiles.Count) {
    @($TestFiles | ForEach-Object { $_ -split "," } | Where-Object { $_ })
  } else {
    $defaultTestFiles
  }
  $testArguments = @("scripts/run-tests-with-timing.mjs")
  if ($TestNamePattern) {
    $testArguments += "--test-name-pattern=$TestNamePattern"
  }
  $testArguments += $selectedTestFiles
  Invoke-NodeStep "Run core and DOM regression tests" $testArguments

  if ($IncludeServerHealth) {
    $port = 5173
    $portPath = Join-Path $projectRoot ".anime-hair-studio-port"
    if (Test-Path -LiteralPath $portPath) {
      $candidate = [int](Get-Content -LiteralPath $portPath -First 1)
      if ($candidate -ge 5173 -and $candidate -le 5189) {
        $port = $candidate
      }
    }
    Write-Output "[verify] Check running server health on port $port"
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    if ($health.app -ne "anime-hair-studio" -or -not $health.saveAs) {
      throw "The running server returned an unexpected health response."
    }
  }

  Write-Output "[verify] All requested checks passed."
} finally {
  Pop-Location
}
