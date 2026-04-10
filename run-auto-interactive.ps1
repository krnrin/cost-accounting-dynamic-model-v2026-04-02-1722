# =============================================================================
# run-auto-interactive.ps1 - Auto-type into interactive mode (real-time output)
# =============================================================================
# Usage: powershell -ExecutionPolicy Bypass -File run-auto-interactive.ps1 38
# This script launches cloud-code in interactive mode, auto-sends the prompt,
# waits for completion, then repeats for the next task.
# =============================================================================

param(
    [int]$TotalRuns = 38
)

$ProjectDir = "D:\harness-project"
$ClaudeCodeDir = "C:\Users\lyvee\source\cloud-code"
$BunExe = "C:\Users\lyvee\.bun\bin\bun.exe"

$LogDir = Join-Path $ProjectDir "automation-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("auto-interactive-" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".log")

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
    Write-Log "ERROR" "D:\harness-project not found!"
    exit 1
}

foreach ($file in @("task.json", "CLAUDE.md", "app_spec.md")) {
    if (-not (Test-Path (Join-Path $ProjectDir $file))) {
        Write-Log "ERROR" "$file not found!"
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path (Join-Path $ProjectDir "test-screenshots") | Out-Null

$InitialTasks = Get-PendingTaskCount

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Harness Costing - Auto Interactive" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Log "INFO" "Planned $TotalRuns rounds, $InitialTasks tasks remaining"
Write-Log "INFO" "Log: $LogFile"

$Prompt = "You are in $ProjectDir. Read CLAUDE.md for project rules, then read task.json. Find the next pending task (respect depends_on, pick smallest id with all deps done). Implement it fully including backend and frontend code, run tests, update progress.txt, mark task done in task.json, and git commit all changes. Complete ONE task then type /exit."

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

    Write-Log "INFO" "Launching interactive session..."

    # Create process with stdin/stdout redirection
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $BunExe
    $psi.Arguments = "run dev -- --dangerously-skip-permissions --add-dir `"$ProjectDir`" --allowed-tools `"Bash Edit Read Write Glob Grep Task WebSearch WebFetch mcp__playwright__*`""
    $psi.WorkingDirectory = $ClaudeCodeDir
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $false
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $process = $null
    try {
        $process = [System.Diagnostics.Process]::Start($psi)

        # Wait for CLI to initialize
        Write-Log "INFO" "Waiting for CLI startup..."
        Start-Sleep -Seconds 8

        # Send prompt
        Write-Log "INFO" "Sending prompt..."
        $process.StandardInput.WriteLine($Prompt)
        $process.StandardInput.Flush()

        # Read output in real-time with timeout
        $outputBuilder = New-Object System.Text.StringBuilder
        $timeoutMinutes = 30
        $deadline = (Get-Date).AddMinutes($timeoutMinutes)
        $lastActivity = Get-Date

        while (-not $process.HasExited -and (Get-Date) -lt $deadline) {
            # Read available stdout
            while (-not $process.StandardOutput.EndOfStream) {
                $line = $null
                $readTask = $process.StandardOutput.ReadLineAsync()
                if ($readTask.Wait(2000)) {
                    $line = $readTask.Result
                }
                if ($null -ne $line) {
                    Write-Host $line
                    [void]$outputBuilder.AppendLine($line)
                    $lastActivity = Get-Date
                } else {
                    break
                }
            }

            # Check for inactivity timeout (5 min no output = probably stuck)
            if (((Get-Date) - $lastActivity).TotalMinutes -gt 5) {
                Write-Log "WARNING" "No output for 5 minutes, sending /exit..."
                try { $process.StandardInput.WriteLine("/exit") } catch {}
                Start-Sleep -Seconds 5
                break
            }

            Start-Sleep -Milliseconds 500
        }

        # If still running after timeout, kill it
        if (-not $process.HasExited) {
            Write-Log "WARNING" "Process timeout, killing..."
            try { $process.Kill() } catch {}
        }

        # Save output to run log
        $outputBuilder.ToString() | Set-Content -Path $runLog -Encoding UTF8
    }
    catch {
        Write-Log "WARNING" ("Exception: " + $_)
    }
    finally {
        if ($null -ne $process) {
            try { $process.Dispose() } catch {}
        }
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
