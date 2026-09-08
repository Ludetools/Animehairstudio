$ErrorActionPreference = "Stop"

$cursor = Get-Item -LiteralPath $PSScriptRoot
$projectRoot = $null
while ($null -ne $cursor) {
  if (Test-Path -LiteralPath (Join-Path $cursor.FullName "AGENTS.md")) {
    $projectRoot = $cursor.FullName
    break
  }
  $cursor = $cursor.Parent
}

if (-not $projectRoot) {
  throw "Could not locate the Anime Hair Studio project root."
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "scripts\verify-project.ps1") @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
