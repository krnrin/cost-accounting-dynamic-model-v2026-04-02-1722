# =============================================================================
# run-automation.ps1 - Windows Automated Task Loop (-p mode)
# =============================================================================
# Usage: powershell -ExecutionPolicy Bypass -File run-automation.ps1 38
# =============================================================================

param(
    [int]$TotalRuns = 38
)

$ProjectDir = "D:\harness-project"
$ClaudeCodeDir = "C:\Users\lyvee\source\cloud-code"
$BunExe = "C:\Users\lyvee\.bun\bin\bun.exe"

$LogDir = Join-Path $ProjectDir "automation-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("automation-" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".log")

function Write-Log {
    param([string]$Level, [string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $LogFile -Value "$timestamp [$Level] $Message"
    switch ($Level) {
        "INFO"     { Write-Host "[INFO] $Message" -ForegroundColor Blue }
        "SUCCESS"  { Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
        "WARNING"  { Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
        "ERROR"    { Write-Host "[ERROR] $Message" -ForegroundColor Red }
        "PROGRESS" { Write-Host "[PROGRESS] $Message" -ForegroundColor Cyan }
    }
}

function Get-PendingTaskCount {
    $taskFile = Join-Path $ProjectDir "task.json"
    if (Test-Path $taskFile) {
        $content = Get-Content $taskFile -Raw
        return ([regex]::Matches($content, '"status":\s*"pending"')).Count
    }
    return 0
}

if (-not (Test-Path $ProjectDir)) {
    Write-Log "ERROR" "D:\harness-project not found! Run: cmd /c mklink /J D:\harness-project <path>"
    exit 1
}

foreach ($file in @("task.json", "CLAUDE.md", "app_spec.md")) {
    if (-not (Test-Path (Join-Path $ProjectDir $file))) {
        Write-Log "ERROR" "$file not found in $ProjectDir!"
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path (Join-Path $ProjectDir "test-screenshots") | Out-Null

$InitialTasks = Get-PendingTaskCount

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Harness Costing Engine - Auto Dev Loop" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Log "INFO" "Planned $TotalRuns rounds, $InitialTasks tasks remaining"
Write-Log "INFO" "Log: $LogFile"

# IMPORTANT: Do NOT cat/dump file contents into the prompt.
# Let the model use its Read tool to read files - this avoids prompt size issues.
$Prompt = "You are in $ProjectDir. Read CLAUDE.md for project rules, then read task.json. Find the next pending task (respect depends_on, pick smallest id with all deps done). Implement it fully including backend and frontend code, run tests, update progress.txt, mark task done in task.json, and git commit all changes. Complete ONE task then exit."

for ($run = 1; $run -le $TotalRuns; $run++) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Log "PROGRESS" ("Round " + $run + " / " + $TotalRuns)
    Write-Host "========================================" -ForegroundColor Cyan

    $remaining = Get-PendingTaskCount
    if ($remaining -eq 0) {
        Write-Log "SUCCESS" "All tasks completed!"
        break
    }

    Write-Log "INFO" "Tasks remaining: $remaining"
    $runStart = Get-Date
    $runLog = Join-Path $LogDir ("run-" + $run + "-" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".log")

    Write-Log "INFO" "Starting round..."

    try {
        Push-Location $ClaudeCodeDir
        & $BunExe run dev -- -p $Prompt --dangerously-skip-permissions --add-dir $ProjectDir --allowed-tools "Bash Edit Read Write Glob Grep Task WebSearch WebFetch mcp__playwright__*" 2>&1 | Tee-Object -FilePath $runLog
    }
    catch {
        Write-Log "WARNING" ("Exception: " + $_)
    }
    finally {
        Pop-Location
    }

    $secs = [math]::Round(((Get-Date) - $runStart).TotalSeconds)
    $remainingAfter = Get-PendingTaskCount
    $completed = $remaining - $remainingAfter

    if ($completed -gt 0) {
        Write-Log "SUCCESS" ("Round " + $run + " done: " + $completed + " task(s) in " + $secs + "s")
    } else {
        Write-Log "WARNING" ("Round " + $run + " done: 0 tasks in " + $secs + "s")
    }

    Write-Log "INFO" "Remaining: $remainingAfter"

    if ($run -lt $TotalRuns -and $remainingAfter -gt 0) {
        Write-Log "INFO" "Waiting 3s..."
        Start-Sleep -Seconds 3
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Log "SUCCESS" "Automation finished!"
Write-Host "========================================" -ForegroundColor Green

$finalRemaining = Get-PendingTaskCount
$totalCompleted = $InitialTasks - $finalRemaining
Write-Log "INFO" ("Done: " + $totalCompleted + " | Left: " + $finalRemaining)
