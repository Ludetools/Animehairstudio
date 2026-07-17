param([switch]$NoOpen)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$logPath = Join-Path $root "AnimeHairStudio-launch.log"
$portPath = Join-Path $root ".anime-hair-studio-port"

function Test-AnimeHairStudioServer([int]$Port) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 1
    return $health.app -eq "anime-hair-studio" -and $health.saveAs
  } catch {
    return $false
  }
}

try {
  $nodeCandidates = @(
    @(
      (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
      (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }
  )

  if (-not $nodeCandidates.Count) {
    throw "Anime Hair Studio could not find its local runtime."
  }

  $nodePath = $nodeCandidates[0]
  $port = $null

  $knownPorts = @(5173)
  if (Test-Path $portPath) {
    $savedPort = [int](Get-Content -LiteralPath $portPath -First 1)
    if ($savedPort -ge 5173 -and $savedPort -le 5189) {
      $knownPorts = @($savedPort, 5173) | Select-Object -Unique
    }
  }
  foreach ($candidatePort in $knownPorts) {
    if (Test-AnimeHairStudioServer $candidatePort) {
      $port = $candidatePort
      break
    }
  }

  if ($null -eq $port) {
    foreach ($candidatePort in 5173..5189) {
      $startInfo = New-Object System.Diagnostics.ProcessStartInfo
      $startInfo.FileName = $nodePath
      $startInfo.Arguments = '"server.js"'
      $startInfo.WorkingDirectory = $root
      $startInfo.UseShellExecute = $false
      $startInfo.CreateNoWindow = $true
      $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
      $previousPort = $env:PORT
      $env:PORT = [string]$candidatePort
      try {
        $serverProcess = [System.Diagnostics.Process]::Start($startInfo)
      } finally {
        if ($null -eq $previousPort) {
          Remove-Item Env:PORT -ErrorAction SilentlyContinue
        } else {
          $env:PORT = $previousPort
        }
      }

      for ($attempt = 0; $attempt -lt 25; $attempt += 1) {
        Start-Sleep -Milliseconds 100
        if (Test-AnimeHairStudioServer $candidatePort) {
          $port = $candidatePort
          break
        }
        if ($serverProcess.HasExited) {
          break
        }
      }
      if ($null -ne $port) {
        break
      }
      if (-not $serverProcess.HasExited) {
        $serverProcess.Kill()
      }
    }
  }

  if ($null -eq $port) {
    throw "Anime Hair Studio could not start its save service on ports 5173 through 5189."
  }

  Set-Content -LiteralPath $portPath -Value $port -Encoding ASCII
  Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
  if ($NoOpen) {
    Write-Output "http://127.0.0.1:$port/"
  } else {
    Start-Process "http://127.0.0.1:$port/"
  }
} catch {
  $message = "Anime Hair Studio could not start.`r`n`r`n$($_.Exception.Message)`r`n`r`nDetails were written to:`r`n$logPath"
  $_ | Out-String | Set-Content -LiteralPath $logPath -Encoding UTF8
  Write-Error $message
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($message, "Anime Hair Studio", "OK", "Error") | Out-Null
  } catch {
  }
  exit 1
}
