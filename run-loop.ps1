# =============================================================================
# run-loop.ps1 - Auto loop using stdin file input (mirrors SamuelQZQ approach)
# =============================================================================
# Usage: powershell -ExecutionPolicy Bypass -File run-loop.ps1 37
#
# Root cause: cloud-code's -p mode only exits when stdin closes.
# Passing prompt as CLI arg keeps stdin open -> process never exits.
# Fix: write prompt to temp file, pipe via stdin, file EOF closes stdin.
# =============================================================================

param(
    [int]$TotalRuns = 37
)

$ProjectDir = "D:\harness-project"
$ClaudeCodeDir = "C:\Users\lyvee\source\cloud-code"
$BunExe = "C:\Users\lyvee\.bun\bin\bun.exe"
$TaskFile = Join-Path $ProjectDir "task.json"

$LogDir = Join-Path $ProjectDir "automation-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-TaskCount([string]$status) {
    if (Test-Path $TaskFile) {
        $c = Get-Content $TaskFile -Raw
        return ([regex]::Matches($c, ('"status":\s*"' + $status + '"'))).Count
    }
    return 0
}

# Write prompt to a temp file (UTF-8 no BOM)
$PromptText = @"
You are in $ProjectDir. Read CLAUDE.md for project rules, then read task.json.

IMPORTANT STATE RULE: Use git log --oneline to check which tasks have already been committed. If a task has a commit like "feat(...): ... [TXX]" in git history but task.json still shows it as "pending", update task.json to mark it as "done" FIRST. Then find the next truly pending task.

Also run "git add -A && git diff --cached --stat" to check for uncommitted changes. If there are uncommitted changes from a previous session, commit them with message "chore: sync uncommitted changes from previous session" before starting new work.

After syncing state, find the next pending task (respect depends_on, pick smallest id with all deps done). Implement it fully including backend and frontend code, run tests, update progress.txt, mark task done in task.json, and git commit all changes. Complete ONE task then exit.
"@

$PromptFile = Join-Path $LogDir "prompt.txt"
[System.IO.File]::WriteAllText($PromptFile, $PromptText, (New-Object System.Text.UTF8Encoding $false))

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Harness Costing - Auto Loop (stdin)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[INFO] Pending: $(Get-TaskCount 'pending') | Done: $(Get-TaskCount 'done')" -ForegroundColor Blue
Write-Host "[INFO] Prompt file: $PromptFile" -ForegroundColor Blue
Write-Host ""

for ($round = 1; $round -le $TotalRuns; $round++) {
    $pending = Get-TaskCount "pending"
    $done = Get-TaskCount "done"

    if ($pending -eq 0) {
        Write-Host "[DONE] All tasks completed! (${done} done)" -ForegroundColor Green
        break
    }

    Write-Host "== Round ${round} / ${TotalRuns} == Pending: ${pending} | Done: ${done} ==" -ForegroundColor Cyan

    $roundStart = Get-Date
    $runLog = Join-Path $LogDir ("round-" + $round + "-" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".log")

    Write-Host "[INFO] Starting round (stdin mode)..." -ForegroundColor Blue

    # KEY FIX: Use cmd /c to pipe file content via stdin
    # When the file is fully read, stdin closes -> process exits cleanly
    try {
        cmd /c "cd /d `"$ClaudeCodeDir`" && type `"$PromptFile`" | `"$BunExe`" run dev -- -p --dangerously-skip-permissions --add-dir `"$ProjectDir`" --allowed-tools `"Bash Edit Read Write Glob Grep Task WebSearch WebFetch mcp__playwright__*`" 2>&1" | Tee-Object -FilePath $runLog
    }
    catch {
        Write-Host "[WARNING] Exception: $_" -ForegroundColor Yellow
    }

    $secs = [math]::Round(((Get-Date) - $roundStart).TotalSeconds)
    $afterPending = Get-TaskCount "pending"
    $afterDone = Get-TaskCount "done"
    $tasksDone = $afterDone - $done

    if ($tasksDone -gt 0) {
        Write-Host "[SUCCESS] Round ${round}: +${tasksDone} task(s) in ${secs} s" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Round ${round}: 0 tasks in ${secs} s" -ForegroundColor Yellow
    }
    Write-Host "[INFO] Total: ${afterDone} done, ${afterPending} pending" -ForegroundColor Blue
    Write-Host ""

    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL DONE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "[FINAL] Done: $(Get-TaskCount 'done') | Pending: $(Get-TaskCount 'pending')" -ForegroundColor Green
git -C $ProjectDir log --oneline -15

# Clean up
Remove-Item -Path $PromptFile -Force -ErrorAction SilentlyContinue
