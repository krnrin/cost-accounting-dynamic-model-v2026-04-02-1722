param(
    [int]$TotalRuns = 1000
)

$ProjectDir = "C:\Users\lyvee\OneDrive\文档\GitHub\cost-accounting-dynamic-model-v2026-04-02-1722"
$ClaudeCodeDir = "C:\Users\lyvee\source\cloud-code"
$BunExe = "C:\Users\lyvee\.bun\bin\bun.exe"
$SprintFiles = @(
    (Join-Path $ProjectDir "sprint2_tasks.json"),
    (Join-Path $ProjectDir "sprint3_tasks.json"),
    (Join-Path $ProjectDir "sprint4_tasks.json")
)
$LogDir = Join-Path $ProjectDir "automation-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("sprints-automation-" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".log")

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

function Get-PendingTaskCount($TaskFile) {
    if (Test-Path $TaskFile) {
        $content = Get-Content $TaskFile -Raw
        return ([regex]::Matches($content, '"status":\s*"pending"')).Count
    }
    return 0
}

function Get-CurrentSprintTaskFile {
    foreach ($file in $SprintFiles) {
        if ((Get-PendingTaskCount $file) -gt 0) {
            return $file
        }
    }
    return $null
}

if (-not (Test-Path $ProjectDir)) {
    Write-Log "ERROR" "ProjectDir not found: $ProjectDir"
    exit 1
}

foreach ($taskFile in $SprintFiles) {
    if (-not (Test-Path $taskFile)) {
        Write-Log "ERROR" "Sprint task file not found: $taskFile"
        exit 1
    }
}

Write-Log "INFO" "Project root verified: $ProjectDir"
Write-Log "INFO" "CLAUDE.md/app_spec.md will be read by Claude via Read tool inside the task prompt"

Write-Log "INFO" "Start Sprint 2/3/4 unified automation loop"

for ($run = 1; $run -le $TotalRuns; $run++) {
    $currentTaskFile = Get-CurrentSprintTaskFile
    if (-not $currentTaskFile) {
        Write-Log "SUCCESS" "All Sprint 2/3/4 tasks completed"
        break
    }

    $taskName = Split-Path $currentTaskFile -Leaf
    $remaining = Get-PendingTaskCount $currentTaskFile
    Write-Log "PROGRESS" ("Round " + $run + " / " + $TotalRuns + " | current task file: " + $taskName + " | pending: " + $remaining)

    $Prompt = "You are in $ProjectDir. This is a COST ACCOUNTING ENGINE REFACTOR project. Read CLAUDE.md and the current sprint task file $taskName. Find the next pending task whose depends_on are all done. Work ONLY on that single task. Respect target_files and done_definition. Implement it fully, run relevant tests/build, update progress.txt, mark the task as done in $taskName, and commit changes. Complete ONE task then exit."

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

Write-Log "SUCCESS" "Unified sprint automation finished"
