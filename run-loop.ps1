param([int]$MaxRounds = 30)

$ProjectDir = "D:\harness-project"
$LogDir = "$ProjectDir\automation-logs"
$PromptFile = "$LogDir\prompt.txt"
$SentinelFile = "$LogDir\ROUND_DONE"
$BunExe = "C:\Users\lyvee\.bun\bin\bun.exe"
$CliEntry = "C:\Users\lyvee\source\cloud-code\src\entrypoints\cli.tsx"

if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Count-Tasks {
    $raw = [System.IO.File]::ReadAllText("$ProjectDir\task.json", [System.Text.Encoding]::UTF8)
    $done = ([regex]::Matches($raw, '"status"\s*:\s*"done"')).Count
    $pending = ([regex]::Matches($raw, '"status"\s*:\s*"pending"')).Count
    return @{ done = $done; pending = $pending }
}

Write-Host "`n========================================"
Write-Host "Harness Auto Loop v7 (regex count)"
Write-Host "========================================"
$counts = Count-Tasks
Write-Host "[INFO] Pending: $($counts.pending) | Done: $($counts.done)"

for ($round = 1; $round -le $MaxRounds; $round++) {
    $counts = Count-Tasks
    if ($counts.pending -eq 0) {
        Write-Host "`n[DONE] All tasks completed!" -ForegroundColor Green
        break
    }

    Write-Host "`n== Round $round / $MaxRounds == Pending: $($counts.pending) | Done: $($counts.done) ==" -ForegroundColor Cyan

    if (Test-Path $SentinelFile) { Remove-Item $SentinelFile -Force }

    $prompt = [System.IO.File]::ReadAllText($PromptFile, [System.Text.Encoding]::UTF8)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $BunExe
    $psi.Arguments = "--feature=BUDDY run `"$CliEntry`" -p --dangerously-skip-permissions --add-dir `"$ProjectDir`" --allowed-tools `"Bash Edit Read Write Glob Grep Task WebSearch WebFetch mcp__playwright__*`""
    $psi.WorkingDirectory = "C:\Users\lyvee\source\cloud-code"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError = $false
    $psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8"
    $psi.EnvironmentVariables["PYTHONUTF8"] = "1"

    $proc = [System.Diagnostics.Process]::Start($psi)
    Start-Sleep -Seconds 3

    try {
        $proc.StandardInput.WriteLine($prompt)
        $proc.StandardInput.Close()
    } catch {
        Write-Host "[WARN] stdin write failed: $_" -ForegroundColor Yellow
    }

    Write-Host "[INFO] PID=$($proc.Id), polling sentinel every 5s..." -ForegroundColor Gray
    $roundStart = Get-Date
    $deadline = $roundStart.AddMinutes(30)
    $sentinelFound = $false

    while ((Get-Date) -lt $deadline) {
        if (Test-Path $SentinelFile) {
            $sentinelFound = $true
            $elapsed = [math]::Round(((Get-Date) - $roundStart).TotalMinutes, 1)
            Write-Host "[OK] Sentinel detected after ${elapsed}min." -ForegroundColor Green
            break
        }
        if ($proc.HasExited) {
            Write-Host "[INFO] Process exited (code=$($proc.ExitCode))" -ForegroundColor Gray
            break
        }
        Start-Sleep -Seconds 5
    }

    if (!$proc.HasExited) {
        Write-Host "[INFO] Killing PID=$($proc.Id)..." -ForegroundColor Yellow
        try { taskkill /F /T /PID $proc.Id 2>$null } catch {}
        Start-Sleep -Seconds 2
    }

    if (Test-Path $SentinelFile) { Remove-Item $SentinelFile -Force }

    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $status = if ($sentinelFound) { "SENTINEL" } elseif ($proc.HasExited -and !$sentinelFound) { "SELF-EXIT" } else { "TIMEOUT" }
    Add-Content "$LogDir\loop-log.txt" "$ts | Round $round | $status | exit=$($proc.ExitCode)"
    Write-Host "[LOG] $ts | Round $round | $status" -ForegroundColor Gray

    Start-Sleep -Seconds 5
}

Write-Host "`n[LOOP] Finished." -ForegroundColor Green