$project = "C:\Users\lyvee\OneDrive\文档\GitHub\cost-accounting-dynamic-model-v2026-04-02-1722"

while ($true) {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Harness Project Automation Monitor" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host ("时间: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -ForegroundColor Yellow
    Write-Host ""

    Write-Host "[最新自动化日志]" -ForegroundColor Green
    $latestLog = Get-ChildItem "$project\automation-logs\*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
    if ($latestLog) {
        Write-Host $latestLog.FullName
    } else {
        Write-Host "未找到 automation log"
    }
    Write-Host ""

    Write-Host "[任务统计]" -ForegroundColor Green
    $taskFile = "$project\task.json"
    if (Test-Path $taskFile) {
        $raw = Get-Content $taskFile -Raw
        $done = ([regex]::Matches($raw, '"status"\s*:\s*"done"')).Count
        $pending = ([regex]::Matches($raw, '"status"\s*:\s*"pending"')).Count
        Write-Host "done    = $done"
        Write-Host "pending = $pending"
    } else {
        Write-Host "未找到 task.json"
    }
    Write-Host ""

    Write-Host "[progress.txt 最近内容]" -ForegroundColor Green
    $progressFile = "$project\progress.txt"
    if (Test-Path $progressFile) {
        Get-Content $progressFile -Tail 8
    } else {
        Write-Host "未找到 progress.txt"
    }
    Write-Host ""

    Write-Host "[最近 Git 提交]" -ForegroundColor Green
    if (Test-Path "$project\.git") {
        git -C $project log --oneline -5
    } else {
        Write-Host "当前目录不是 git 仓库"
    }
    Write-Host ""

    Write-Host "[当前 Git 状态]" -ForegroundColor Green
    if (Test-Path "$project\.git") {
        git -C $project status --short
    }
    Write-Host ""

    Write-Host "[自动化日志尾部]" -ForegroundColor Green
    if ($latestLog) {
        Get-Content $latestLog.FullName -Tail 12
    }
    Write-Host ""
    Write-Host "刷新间隔: 10 秒" -ForegroundColor DarkGray

    Start-Sleep 10
}
