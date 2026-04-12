# scripts/fix-wizard-bom-iife.ps1
# Fix UTF-8 BOM and IIFE wrapper in ui/new_project_wizard.js
# Same pattern as fix-workbook-viewer-bom.ps1 from PR #40
#
# Usage:  pwsh scripts/fix-wizard-bom-iife.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$file = Join-Path $PSScriptRoot '..' 'ui' 'new_project_wizard.js'
if (-not (Test-Path $file)) {
    Write-Error "File not found: $file"
    exit 1
}

$raw = [System.IO.File]::ReadAllText($file)
$changed = $false

# 1. Remove UTF-8 BOM (U+FEFF)
if ($raw.StartsWith("`u{FEFF}")) {
    $raw = $raw.Substring(1)
    Write-Host '[1/2] Removed UTF-8 BOM'
    $changed = $true
} else {
    Write-Host '[1/2] No BOM found — skipped'
}

# 2. Simplify IIFE wrapper: verbose typeof ternary -> direct globalThis
#    Before: })(typeof globalThis!=='undefined'?globalThis:typeof window!=='undefined'?window:this);
#    After:  })(globalThis);
$oldIIFE = "typeof globalThis!=='undefined'?globalThis:typeof window!=='undefined'?window:this"
if ($raw.Contains($oldIIFE)) {
    $raw = $raw.Replace($oldIIFE, 'globalThis')
    Write-Host '[2/2] Simplified IIFE wrapper to (globalThis)'
    $changed = $true
} else {
    Write-Host '[2/2] IIFE already simplified — skipped'
}

if ($changed) {
    # Write UTF-8 without BOM
    [System.IO.File]::WriteAllText($file, $raw, [System.Text.UTF8Encoding]::new($false))
    Write-Host "`nDone. Saved: $file"
} else {
    Write-Host "`nNo changes needed."
}
