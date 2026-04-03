param(
  [string]$VersionTag = ("v" + (Get-Date -Format "yyyy.MM.dd-HHmm")),
  [string]$ReleaseRoot = "releases"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspace

$releaseDir = Join-Path $workspace $ReleaseRoot
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

$requestedVersionTag = $VersionTag
$resolvedVersionTag = $requestedVersionTag
$suffix = 1
while (Test-Path -LiteralPath (Join-Path $releaseDir $resolvedVersionTag)) {
  $resolvedVersionTag = "{0}-r{1:00}" -f $requestedVersionTag, $suffix
  $suffix++
}
$VersionTag = $resolvedVersionTag
$versionDir = Join-Path $releaseDir $VersionTag

# New directory structure assets
$uiAssets = @(
  "ui/dashboard.css",
  "ui/dashboard.js",
  "ui/insights.css",
  "ui/insights.js",
  "ui/landing_workbench.css",
  "ui/landing_workbench.js",
  "ui/logic_drawer.css",
  "ui/logic_drawer.js",
  "ui/version_timeline.css",
  "ui/version_timeline.js",
  "ui/workbook_viewer.css",
  "ui/workbook_viewer.js"
)

$engineAssets = @(
  "engine/bom_schema.js",
  "engine/bom_db.js",
  "engine/bom_parser.js",
  "engine/compute_model.js",
  "engine/harness_profit.js",
  "engine/profit_shapley.js",
  "engine/target_price_solver.js",
  "engine/align_key_enhancer.js",
  "engine/config_bridge.js",
  "engine/computation_path.js"
)

$coreAssets = @(
  "core/repo.js",
  "core/config_loader.js",
  "core/storage_adapter.js"
)

$chartAssets = @(
  "charts/waterfall_causal.js",
  "charts/waterfall_causal.css"
)

$configAssets = @(
  "config/g281.project.json"
)

$rootAssets = @(
  "g281_data_bundle.js",
  "g281_bom_alignment_engine.js",
  "g281_bom_diff_engine.js",
  "g281_bom_io.js",
  "g281_bom_semantic_repo.js",
  "g281_bom_template_runtime.js",
  "g281_bom_validation.css",
  "g281_bom_validation_view.js",
  "g281_capital_validation_view.js",
  "g281_factor_version_repo.js",
  "g281_factory_efficiency_view.css",
  "g281_factory_efficiency_view.js",
  "g281_labor_validation_view.js",
  "g281_operating_labor_rate_data.js",
  "g281_packaging_validation_view.js",
  "g281_scenario_repo.js",
  "g281_version_timeline.css",
  "g281_version_timeline.js"
)

$passthroughPaths = @(
  "vendor\xlsx",
  "vendor\univer-editor"
)

function Get-VersionedName {
  param([string]$FileName, [string]$Tag)
  $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
  $ext = [System.IO.Path]::GetExtension($FileName)
  return "{0}_{1}{2}" -f $base, $Tag, $ext
}

New-Item -ItemType Directory -Path $versionDir -Force | Out-Null

# Create subdirectories
New-Item -ItemType Directory -Path (Join-Path $versionDir "ui") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $versionDir "engine") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $versionDir "core") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $versionDir "charts") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $versionDir "config") -Force | Out-Null

$htmlSource = Join-Path $workspace "ui/dashboard.html"
$htmlTargetName = "dashboard_{0}.html" -f $VersionTag
$htmlTargetPath = Join-Path $versionDir $htmlTargetName

$html = Get-Content -LiteralPath $htmlSource -Raw -Encoding UTF8
$assetMappings = @()

# Process UI assets
foreach ($asset in $uiAssets) {
  $fileName = Split-Path $asset -Leaf
  $versionedName = Get-VersionedName -FileName $fileName -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path (Join-Path $versionDir "ui") $versionedName
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    $html = $html.Replace("./$fileName", "./ui/$versionedName")
    $html = $html.Replace("../$fileName", "./ui/$versionedName")
    $assetMappings += [PSCustomObject]@{
      logicalName = $asset
      releaseName = "ui/$versionedName"
      sourcePath = $sourcePath
    }
  }
}

# Process engine assets
foreach ($asset in $engineAssets) {
  $fileName = Split-Path $asset -Leaf
  $versionedName = Get-VersionedName -FileName $fileName -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path (Join-Path $versionDir "engine") $versionedName
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    $html = $html.Replace("../engine/$fileName", "./engine/$versionedName")
    $assetMappings += [PSCustomObject]@{
      logicalName = $asset
      releaseName = "engine/$versionedName"
      sourcePath = $sourcePath
    }
  }
}

# Process core assets
foreach ($asset in $coreAssets) {
  $fileName = Split-Path $asset -Leaf
  $versionedName = Get-VersionedName -FileName $fileName -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path (Join-Path $versionDir "core") $versionedName
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    $html = $html.Replace("../core/$fileName", "./core/$versionedName")
    $assetMappings += [PSCustomObject]@{
      logicalName = $asset
      releaseName = "core/$versionedName"
      sourcePath = $sourcePath
    }
  }
}

# Process chart assets
foreach ($asset in $chartAssets) {
  $fileName = Split-Path $asset -Leaf
  $versionedName = Get-VersionedName -FileName $fileName -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path (Join-Path $versionDir "charts") $versionedName
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    $html = $html.Replace("../charts/$fileName", "./charts/$versionedName")
    $assetMappings += [PSCustomObject]@{
      logicalName = $asset
      releaseName = "charts/$versionedName"
      sourcePath = $sourcePath
    }
  }
}

# Process config assets (no renaming for config)
foreach ($asset in $configAssets) {
  $fileName = Split-Path $asset -Leaf
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path (Join-Path $versionDir "config") $fileName
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    $assetMappings += [PSCustomObject]@{
      logicalName = $asset
      releaseName = "config/$fileName"
      sourcePath = $sourcePath
    }
  }
}

# Process root assets (g281_* files still in root)
foreach ($asset in $rootAssets) {
  $fileName = Split-Path $asset -Leaf
  $versionedName = Get-VersionedName -FileName $fileName -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path $versionDir $versionedName
  if (Test-Path -LiteralPath $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    $html = $html.Replace("../$fileName", "./$versionedName")
    $html = $html.Replace("./$fileName", "./$versionedName")
    $assetMappings += [PSCustomObject]@{
      logicalName = $asset
      releaseName = $versionedName
      sourcePath = $sourcePath
    }
  }
}

# Copy vendor passthrough paths
foreach ($path in $passthroughPaths) {
  $sourcePath = Join-Path $workspace $path
  $targetPath = Join-Path $versionDir $path
  if (Test-Path -LiteralPath $sourcePath) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse -Force
  }
}

# Fix vendor paths in HTML
$html = $html.Replace("../vendor/", "./vendor/")
$html = $html.Replace("./vendor/", "./vendor/")

$html = "<!-- Release: $VersionTag -->`r`n<!-- New structure: ui/, engine/, core/, charts/, config/ -->`r`n" + $html
Set-Content -LiteralPath $htmlTargetPath -Value $html -Encoding UTF8

$publishedAt = (Get-Date).ToString("o")
$gitCommit = ""
try {
  $gitCommit = (git -C $workspace rev-parse --short HEAD).Trim()
} catch {
  $gitCommit = ""
}

$sourceFileUpdatedAtUtc = [ordered]@{}
foreach ($asset in ($uiAssets + $engineAssets + $coreAssets + $chartAssets + $configAssets + $rootAssets)) {
  $sourcePath = Join-Path $workspace $asset
  if (Test-Path -LiteralPath $sourcePath) {
    $sourceFileUpdatedAtUtc[$asset] = (Get-Item -LiteralPath $sourcePath).LastWriteTimeUtc.ToString("o")
  }
}

$timelineEvent = [ordered]@{
  id = "release/$VersionTag"
  type = "release"
  title = "release_published"
  versionTag = $VersionTag
  publishedAt = $publishedAt
  updatedAt = $publishedAt
}

$versionMetadata = [ordered]@{
  schemaVersion = 2
  versionTag = $VersionTag
  requestedVersionTag = $requestedVersionTag
  generatedAt = $publishedAt
  workspace = $workspace
  folderName = (Split-Path -Leaf $versionDir)
  folderPath = $versionDir
  mainFile = $htmlTargetName
  mainFilePath = $htmlTargetPath
  gitCommit = $gitCommit
  newStructure = $true
  directories = @("ui", "engine", "core", "charts", "config", "vendor")
  assets = $assetMappings
  passthroughPaths = $passthroughPaths
  sourceFileUpdatedAtUtc = $sourceFileUpdatedAtUtc
  timelineEvents = @($timelineEvent)
}

$versionMetadataPath = Join-Path $versionDir "release_metadata.json"
Set-Content -LiteralPath $versionMetadataPath -Value ($versionMetadata | ConvertTo-Json -Depth 8) -Encoding UTF8

$latestPath = Join-Path $releaseDir "LATEST_RELEASE.txt"
$latestContent = @(
  "Version=$VersionTag"
  "MainFile=$htmlTargetName"
  "Folder=$versionDir"
  "Structure=new"
) -join "`r`n"
Set-Content -LiteralPath $latestPath -Value $latestContent -Encoding UTF8

$latestJsonPath = Join-Path $releaseDir "LATEST_RELEASE.json"
$latestJson = [ordered]@{
  schemaVersion = 2
  versionTag = $VersionTag
  mainFile = $htmlTargetName
  folderName = (Split-Path -Leaf $versionDir)
  folderPath = $versionDir
  structure = "new"
  metadataFile = "release_metadata.json"
  metadataPath = $versionMetadataPath
  timelinePath = (Join-Path $releaseDir "release_timeline.json")
  publishedAt = $publishedAt
}
Set-Content -LiteralPath $latestJsonPath -Value ($latestJson | ConvertTo-Json -Depth 6) -Encoding UTF8

$timelinePath = Join-Path $releaseDir "release_timeline.json"
$existingTimeline = @()
if (Test-Path -LiteralPath $timelinePath) {
  try {
    $rawTimeline = Get-Content -LiteralPath $timelinePath -Raw -Encoding UTF8
    if (-not [string]::IsNullOrWhiteSpace($rawTimeline)) {
      $parsedTimeline = $rawTimeline | ConvertFrom-Json
      if ($null -ne $parsedTimeline.releases) {
        $existingTimeline = @($parsedTimeline.releases)
      } else {
        $existingTimeline = @($parsedTimeline)
      }
    }
  } catch {
    $existingTimeline = @()
  }
}

$timelineRecord = [ordered]@{
  versionTag = $VersionTag
  folderName = (Split-Path -Leaf $versionDir)
  mainFile = $htmlTargetName
  structure = "new"
  publishedAt = $publishedAt
  updatedAt = $publishedAt
  metadataPath = $versionMetadataPath
  timelineEvents = @($timelineEvent)
}

$timelineRecords = @($timelineRecord)
if ($existingTimeline.Count -gt 0) {
  $timelineRecords += @($existingTimeline | Where-Object { $_.versionTag -ne $VersionTag })
}
$timelineRecords = @($timelineRecords | Sort-Object -Property publishedAt -Descending)

$timelineDocument = [ordered]@{
  schemaVersion = 2
  updatedAt = $publishedAt
  releases = $timelineRecords
}
Set-Content -LiteralPath $timelinePath -Value ($timelineDocument | ConvertTo-Json -Depth 8) -Encoding UTF8

Write-Output "Release created: $htmlTargetPath"
Write-Output "Version: $VersionTag"
Write-Output "Assets: $($assetMappings.Count)"
