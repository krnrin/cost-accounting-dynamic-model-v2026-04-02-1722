<#
  P3#14: workbook_viewer.js BOM 字符清除 + IIFE 统一

  执行:
    cd <repo-root>
    pwsh scripts/fix-workbook-viewer-bom.ps1

  修改内容:
    1. 移除 UTF-8 BOM (\xEF\xBB\xBF)
    2. IIFE 尾部 })(window) → })(globalThis)
    3. 末尾追加 G281UI.WorkbookViewer 命名空间别名
#>

$file = Join-Path $PSScriptRoot '..' 'ui' 'workbook_viewer.js'
if (-not (Test-Path $file)) {
  Write-Error "[P3#14] 文件不存在: $file"
  exit 1
}

Write-Host "[P3#14] 处理 workbook_viewer.js ..." -ForegroundColor Cyan

# 读取原始字节
$bytes = [System.IO.File]::ReadAllBytes($file)
$bomLen = 0
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  $bomLen = 3
  Write-Host "  [1/3] 发现 BOM 字符，将移除" -ForegroundColor Yellow
} else {
  Write-Host "  [1/3] 未发现 BOM 字符，跳过" -ForegroundColor Green
}

# 转字符串（跳过 BOM）
$content = [System.Text.Encoding]::UTF8.GetString($bytes, $bomLen, $bytes.Length - $bomLen)

# 替换 IIFE 尾部
$oldTail = '})(window);'
$newTail = '})(globalThis);'
if ($content.Contains($oldTail)) {
  $content = $content.Replace($oldTail, $newTail)
  Write-Host "  [2/3] IIFE: (window) -> (globalThis)" -ForegroundColor Yellow
} else {
  Write-Host "  [2/3] IIFE 已是 globalThis，跳过" -ForegroundColor Green
}

# 追加 G281UI 别名（如果还没有）
if (-not $content.Contains('G281UI.WorkbookViewer')) {
  # 在 global.G281WorkbookViewer = { 后面追加别名
  $aliasBlock = @"

  // G281UI 命名空间别名
  if (!global.G281UI) global.G281UI = {};
  global.G281UI.WorkbookViewer = global.G281WorkbookViewer;
"@
  $insertBefore = $newTail
  if (-not $content.Contains($newTail)) {
    $insertBefore = $oldTail
  }
  $content = $content.Replace($insertBefore, "$aliasBlock`n$insertBefore")
  Write-Host "  [3/3] 追加 G281UI.WorkbookViewer 别名" -ForegroundColor Yellow
} else {
  Write-Host "  [3/3] G281UI 别名已存在，跳过" -ForegroundColor Green
}

# 写入 UTF-8 无 BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "[P3#14] 完成 ✓" -ForegroundColor Green
Write-Host "  请运行: git diff ui/workbook_viewer.js 确认修改" -ForegroundColor DarkGray
