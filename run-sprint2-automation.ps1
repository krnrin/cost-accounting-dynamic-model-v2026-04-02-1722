param(
    [int]$TotalRuns = 100
)

$ProjectDir = "C:\Users\lyvee\OneDrive\文档\GitHub\cost-accounting-dynamic-model-v2026-04-02-1722"
$ClaudeCodeDir = "C:\Users\lyvee\source\cloud-code"
$BunExe = "C:\Users\lyvee\.bun\bin\bun.exe"
$TaskFile = Join-Path $ProjectDir "sprint2_tasks.json"
$LogDir = Join-Path $ProjectDir "automation-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("sprint2-automation-" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".log")

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
    if (Test-Path $TaskFile) {
        $content = Get-Content $TaskFile -Raw
        return ([regex]::Matches($content, '"status":\s*"pending"')).Count
    }
    return 0
}

if (-not (Test-Path $ProjectDir)) {
    Write-Log "ERROR" "ProjectDir not found: $ProjectDir"
    exit 1
}
if (-not (Test-Path $TaskFile)) {
    Write-Log "ERROR" "sprint2_tasks.json not found"
    exit 1
}

$Prompt = "You are in $ProjectDir. This is Sprint 2 of a COST ACCOUNTING ENGINE REFACTOR. Read CLAUDE.md and sprint2_tasks.json. Find the next pending Sprint 2 task whose depends_on are all done. Work ONLY on that single Sprint 2 task. Respect target_files and done_definition. Implement it fully, run relevant tests/build, update progress.txt, mark the task as done in sprint2_tasks.json, and commit changes. Complete ONE task then exit."

Write-Log "INFO" "Start Sprint 2 automation loop"

for ($run = 1; $run -le $TotalRuns; $run++) {
    Write-Log "PROGRESS" ("Round " + $run + " / " + $TotalRuns)
    $remaining = Get-PendingTaskCount
    if ($remaining -eq 0) {
        Write-Log "SUCCESS" "All Sprint 2 tasks completed"
        break
    }

    Write-Log "INFO" ("Sprint 2 tasks remaining: " + $remaining)
    try {
        Push-Location $ClaudeCodeDir
        & $BunExe run dev -- -p $Prompt --dangerously-skip-permissions --add-dir $ProjectDir --allowed-tools "Bash Edit Read Write Glob Grep Task WebSearch WebFetch mcp__playwright__*" 2>&1 | Tee-Object -FilePath $LogFile -Append
    }
    catch {
        Write-Log "WARNING" ("Exception: " + $_)
    }
    finally {
        Pop-Location
    }

    Start-Sleep -Seconds 3
}

Write-Log "SUCCESS" "Sprint 2 automation finished"
