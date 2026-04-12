<# 
  migrate-root-files.ps1
  将根目录的 g281_* 文件迁移到模块化目录结构
  用法: 在项目根目录执行 .\scripts\migrate-root-files.ps1
#>
$ErrorActionPreference = 'Stop'

Write-Host '=== Step 1: 创建目标目录 ===' -ForegroundColor Cyan
@('engine', 'ui', 'ui/modals', 'core', 'data', 'scripts') | ForEach-Object {
  if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}

Write-Host '=== Step 2: JS 业务逻辑 → engine/ ===' -ForegroundColor Cyan
$engineMoves = @{
  'g281_bom_alignment_engine.js' = 'engine/bom_alignment_engine.js'
  'g281_bom_diff_engine.js'      = 'engine/bom_diff_engine.js'
  'g281_bom_io.js'               = 'engine/bom_io.js'
  'g281_bom_semantic_repo.js'    = 'engine/bom_semantic_repo.js'
  'g281_bom_template_runtime.js' = 'engine/bom_template_runtime.js'
}
$engineMoves.GetEnumerator() | ForEach-Object {
  if (Test-Path $_.Key) {
    git mv $_.Key $_.Value
    Write-Host "  $($_.Key) → $($_.Value)" -ForegroundColor Green
  }
}

Write-Host '=== Step 3: JS 数据仓库 → core/ ===' -ForegroundColor Cyan
$coreMoves = @{
  'g281_factor_version_repo.js' = 'core/factor_version_repo.js'
  'g281_scenario_repo.js'       = 'core/scenario_repo.js'
}
$coreMoves.GetEnumerator() | ForEach-Object {
  if (Test-Path $_.Key) {
    git mv $_.Key $_.Value
    Write-Host "  $($_.Key) → $($_.Value)" -ForegroundColor Green
  }
}

Write-Host '=== Step 4: JS UI 视图 → ui/ ===' -ForegroundColor Cyan
$uiMoves = @{
  'g281_bom_validation_view.js'       = 'ui/bom_validation_view.js'
  'g281_capital_validation_view.js'    = 'ui/capital_validation_view.js'
  'g281_labor_validation_view.js'      = 'ui/labor_validation_view.js'
  'g281_packaging_validation_view.js'  = 'ui/packaging_validation_view.js'
  'g281_factory_efficiency_view.js'    = 'ui/factory_efficiency_view.js'
  'g281_operating_labor_rate_data.js'  = 'ui/operating_labor_rate_data.js'
}
$uiMoves.GetEnumerator() | ForEach-Object {
  if (Test-Path $_.Key) {
    git mv $_.Key $_.Value
    Write-Host "  $($_.Key) → $($_.Value)" -ForegroundColor Green
  }
}

Write-Host '=== Step 5: CSS → ui/ ===' -ForegroundColor Cyan
$cssMoves = @{
  'g281_bom_validation.css'         = 'ui/bom_validation.css'
  'g281_factory_efficiency_view.css' = 'ui/factory_efficiency_view.css'
}
$cssMoves.GetEnumerator() | ForEach-Object {
  if (Test-Path $_.Key) {
    git mv $_.Key $_.Value
    Write-Host "  $($_.Key) → $($_.Value)" -ForegroundColor Green
  }
}

Write-Host '=== Step 6: JSON 数据文件 → data/ ===' -ForegroundColor Cyan
Get-ChildItem -Path '.' -Filter 'g281_data_*.json' | ForEach-Object {
  $dest = "data/$($_.Name)"
  git mv $_.Name $dest
  Write-Host "  $($_.Name) → $dest" -ForegroundColor Green
}

Write-Host '=== Step 7: Python 脚本 → scripts/ ===' -ForegroundColor Cyan
Get-ChildItem -Path '.' -Filter 'g281_generate_*.py' | ForEach-Object {
  $dest = "scripts/$($_.Name)"
  git mv $_.Name $dest
  Write-Host "  $($_.Name) → $dest" -ForegroundColor Green
}
@('g281_apply_version_seed_data.py', 'g281_merge_version_seed_data.py',
  'g281_sync_connector_initial_quotes.py', 'e281_sync_wire_prices.py',
  'g281_build_runtime_bundle.ps1', 'g281_publish_versioned_release.ps1') | ForEach-Object {
  if (Test-Path $_) {
    $dest = "scripts/$_"
    git mv $_ $dest
    Write-Host "  $_ → $dest" -ForegroundColor Green
  }
}

Write-Host '=== Step 8: 清理 AI 会话产物 ===' -ForegroundColor Cyan
@('MEMORY.md', 'AGENTS.md') | ForEach-Object {
  if (Test-Path $_) {
    git rm $_
    Write-Host "  已删除 $_" -ForegroundColor Yellow
  }
}
@('.agents', '.trellis', 'memory') | ForEach-Object {
  if (Test-Path $_) {
    git rm -r $_
    Write-Host "  已删除 $_ (目录)" -ForegroundColor Yellow
  }
}

Write-Host '=== Step 9: 移动大型生成文件 ===' -ForegroundColor Cyan
if (Test-Path 'g281_data_bundle.js') {
  git mv 'g281_data_bundle.js' 'data/g281_data_bundle.js'
  Write-Host '  g281_data_bundle.js → data/g281_data_bundle.js' -ForegroundColor Green
}

Write-Host '=== Step 10: 移动规划文档 ===' -ForegroundColor Cyan
if (Test-Path 'g281_profit_model_plan.md') {
  git mv 'g281_profit_model_plan.md' 'docs/profit_model_plan.md'
  Write-Host '  g281_profit_model_plan.md → docs/profit_model_plan.md' -ForegroundColor Green
}

Write-Host "`n✅ 文件迁移完成！" -ForegroundColor Green
Write-Host '接下来你需要：' -ForegroundColor Yellow
Write-Host '  1. 手动更新 ui/dashboard.html 中的 <script> 和 <link> 路径'
Write-Host '  2. 搜索替换所有 ../g281_ 引用为新路径'
Write-Host '  3. git add -A && git commit -m "chore: migrate root g281_* files to modular directories"'
Write-Host '  4. 本地测试 dashboard.html 是否正常加载'
