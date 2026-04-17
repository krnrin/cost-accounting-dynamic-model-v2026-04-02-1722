# =============================================================================
# init.ps1 - 项目环境初始化脚本
# =============================================================================
# 每个 Claude Code session 开始时运行
# 安装依赖 + 启动前后端开发服务器
# =============================================================================

Write-Host "正在初始化 高压线束精算引擎 开发环境..." -ForegroundColor Yellow

# 创建必要目录
$dirs = @("test-screenshots", "automation-logs", "server\prisma\data")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "  创建目录: $dir" -ForegroundColor Gray
    }
}

$backendJob = $null
$frontendJob = $null

# 后端初始化
if (Test-Path "server\package.json") {
    Write-Host "安装后端依赖..." -ForegroundColor Blue
    Push-Location server
    npm install --silent

    Write-Host "执行数据库初始化 (generate + migrate deploy + seed)..." -ForegroundColor Blue
    npm run db:init

    # 启动 Express 后端（后台运行）
    Write-Host "启动 Express 后端 (http://localhost:3001)..." -ForegroundColor Blue
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run dev
    }
    Write-Host "  后端 PID: $($backendJob.Id)" -ForegroundColor Gray

    Pop-Location
} else {
    Write-Host "[跳过] server/package.json 不存在，跳过后端初始化" -ForegroundColor Yellow
}

# 前端初始化
if (Test-Path "app\package.json") {
    Write-Host "安装前端依赖..." -ForegroundColor Blue
    Push-Location app
    npm install --silent

    # 启动 Vite（后台运行）
    Write-Host "启动 Vite 前端 (http://localhost:5173)..." -ForegroundColor Blue
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run dev -- --host 0.0.0.0
    }
    Write-Host "  前端 PID: $($frontendJob.Id)" -ForegroundColor Gray

    Pop-Location
} else {
    Write-Host "[跳过] app/package.json 不存在，跳过前端初始化" -ForegroundColor Yellow
}

# 等待服务器启动
Write-Host "等待服务器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查服务状态
$backendOk = $false
$frontendOk = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) { $backendOk = $true }
} catch {}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) { $frontendOk = $true }
} catch {}

if ($backendJob -and -not $backendOk) {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "  后端启动日志:" -ForegroundColor Yellow
    Receive-Job -Job $backendJob -Keep | Select-Object -Last 20
}

if ($frontendJob -and -not $frontendOk) {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "  前端启动日志:" -ForegroundColor Yellow
    Receive-Job -Job $frontendJob -Keep | Select-Object -Last 20
}

Write-Host "" -ForegroundColor Green
Write-Host "数据库文件: server/prisma/data/harness_cost.db" -ForegroundColor Gray
Write-Host "" -ForegroundColor Green
try {
    $migrationStatus = & npm --prefix server run db:status 2>&1
    Write-Host $migrationStatus
} catch {
    Write-Host "  ⚠️  无法读取 migration 状态: $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
    $seedOutput = & npm --prefix server run seed 2>&1
    Write-Host $seedOutput
} catch {
    Write-Host "  ⚠️  种子重复执行检查失败: $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
    $seedOutput = & npm --prefix server run seed 2>&1
    Write-Host $seedOutput
} catch {
    Write-Host "  ⚠️  第二次种子重复执行检查失败: $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
    $statusOutput = & npm --prefix server run db:status 2>&1
    Write-Host $statusOutput
} catch {
    Write-Host "  ⚠️  最终 migration 状态检查失败: $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
    if (Test-Path "server\prisma\data\harness_cost.db") {
        $dbFile = Get-Item "server\prisma\data\harness_cost.db"
        Write-Host ("  DB 文件大小: " + $dbFile.Length + " bytes") -ForegroundColor Gray
    }
} catch {}

try {
    if (Test-Path "server\data\harness_cost.db") {
        Remove-Item "server\data\harness_cost.db" -Force -ErrorAction SilentlyContinue
        Write-Host "  已清理旧路径 server/data/harness_cost.db" -ForegroundColor Gray
    }
} catch {}

try {
    if (Test-Path "server\prisma\dev.db") {
        Remove-Item "server\prisma\dev.db" -Force -ErrorAction SilentlyContinue
        Write-Host "  已清理旧路径 server/prisma/dev.db" -ForegroundColor Gray
    }
} catch {}

try {
    if (Test-Path "server\prisma\dev.db-journal") {
        Remove-Item "server\prisma\dev.db-journal" -Force -ErrorAction SilentlyContinue
    }
} catch {}

try {
    if (Test-Path "server\data") {
        $legacyFiles = Get-ChildItem "server\data" -File -ErrorAction SilentlyContinue
        if ($legacyFiles.Count -eq 0) {
            Remove-Item "server\data" -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}

try {
    if (Test-Path "server\prisma\data") {
        $dbList = Get-ChildItem "server\prisma\data" -Filter "*.db" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
        if ($dbList) {
            Write-Host ("  Prisma data 目录数据库: " + ($dbList -join ', ')) -ForegroundColor Gray
        }
    }
} catch {}

try {
    $health = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host ("  Health 响应: " + $health.Content) -ForegroundColor Gray
} catch {}

try {
    $login = Invoke-WebRequest -Uri "http://localhost:3001/api/users" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($login.StatusCode) {
        Write-Host ("  /api/users 状态: " + $login.StatusCode) -ForegroundColor Gray
    }
} catch {}

try {
    $frontendCheck = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($frontendCheck.StatusCode) {
        Write-Host ("  Frontend 状态: " + $frontendCheck.StatusCode) -ForegroundColor Gray
    }
} catch {}

try {
    Write-Host "  提示: 后端默认会在启动前自动执行 db:init，保证空库可启动。" -ForegroundColor Gray
} catch {}

try {
    Write-Host "  提示: 可重复执行命令 npm --prefix server run db:init / seed 做初始化收口验证。" -ForegroundColor Gray
} catch {}

try {
    Write-Host "" -ForegroundColor Green
} catch {}

try {
    Write-Host "  初始化校验完成。" -ForegroundColor Green
} catch {}

try {
    Write-Host "" -ForegroundColor Green
} catch {}

try {
    Write-Host "  后端 URL: http://localhost:3001" -ForegroundColor Green
} catch {}

try {
    Write-Host "  前端 URL: http://localhost:5173" -ForegroundColor Green
} catch {}

try {
    Write-Host "" -ForegroundColor Green
} catch {}

try {
    Write-Host "准备继续开发。" -ForegroundColor Green
} catch {}

return

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
