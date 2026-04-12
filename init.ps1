# =============================================================================
# init.ps1 - 项目环境初始化脚本
# =============================================================================
# 每个 Claude Code session 开始时运行
# 安装依赖 + 启动前后端开发服务器
# =============================================================================

Write-Host "正在初始化 高压线束精算引擎 开发环境..." -ForegroundColor Yellow

# 创建必要目录
$dirs = @("test-screenshots", "automation-logs", "frontend", "backend", "e2e")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "  创建目录: $dir" -ForegroundColor Gray
    }
}

# 后端初始化
if (Test-Path "backend\requirements.txt") {
    Write-Host "安装后端依赖..." -ForegroundColor Blue
    Push-Location backend
    
    # 创建 venv（如果不存在）
    if (-not (Test-Path "venv")) {
        python -m venv venv
    }
    
    # 激活 venv 并安装依赖
    & .\venv\Scripts\pip.exe install -r requirements.txt -q
    
    # 启动 FastAPI（后台运行）
    Write-Host "启动 FastAPI 后端 (http://localhost:8000)..." -ForegroundColor Blue
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        & .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    }
    Write-Host "  后端 PID: $($backendJob.Id)" -ForegroundColor Gray
    
    Pop-Location
} else {
    Write-Host "[跳过] backend/requirements.txt 不存在，跳过后端初始化" -ForegroundColor Yellow
}

# 前端初始化
if (Test-Path "frontend\package.json") {
    Write-Host "安装前端依赖..." -ForegroundColor Blue
    Push-Location frontend
    npm install --silent
    
    # 启动 Vite（后台运行）
    Write-Host "启动 Vite 前端 (http://localhost:5173)..." -ForegroundColor Blue
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run dev
    }
    Write-Host "  前端 PID: $($frontendJob.Id)" -ForegroundColor Gray
    
    Pop-Location
} else {
    Write-Host "[跳过] frontend/package.json 不存在，跳过前端初始化" -ForegroundColor Yellow
}

# 等待服务器启动
Write-Host "等待服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查服务状态
$backendOk = $false
$frontendOk = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) { $backendOk = $true }
} catch {}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) { $frontendOk = $true }
} catch {}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  初始化完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if ($backendOk) {
    Write-Host "  ✅ 后端运行中: http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  后端未启动（可能还在加载或尚未创建）" -ForegroundColor Yellow
}

if ($frontendOk) {
    Write-Host "  ✅ 前端运行中: http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  前端未启动（可能还在加载或尚未创建）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "准备就绪，可以开始开发。" -ForegroundColor Green
