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

$assets = @(
  "g281_profit_dashboard.css",
  "g281_bom_validation.css",
  "g281_profit_insights.css",
  "g281_profit_logic_drawer.css",
  "g281_factory_efficiency_view.css",
  "g281_version_timeline.css",
  "g281_workbook_viewer.css",
  "g281_bom_schema.js",
  "g281_bom_db.js",
  "g281_factor_version_repo.js",
  "g281_scenario_repo.js",
  "g281_bom_parser.js",
  "g281_bom_semantic_repo.js",
  "g281_bom_alignment_engine.js",
  "g281_bom_diff_engine.js",
  "g281_bom_io.js",
  "g281_data_bundle.js",
  "g281_engine.js",
  "g281_repo.js",
  "g281_target_price_solver.js",
  "g281_profit_shapley.js",
  "g281_profit_insights.js",
  "g281_profit_logic_drawer.js",
  "g281_operating_labor_rate_data.js",
  "g281_factory_efficiency_view.js",
  "g281_bom_template_runtime.js",
  "g281_harness_profit.js",
  "g281_profit_dashboard.js",
  "g281_bom_validation_view.js",
  "g281_capital_validation_view.js",
  "g281_labor_validation_view.js",
  "g281_packaging_validation_view.js",
  "g281_version_timeline.js",
  "g281_workbook_viewer.js"
)

$passthroughPaths = @(
  "config",
  "core",
  "engine",
  "pages",
  "shared",
  "ui",
  "utils",
  "charts",
  "vendor\\xlsx",
  "vendor\\univer-editor"
)

$versionedUiAssets = @(
  "ui/dashboard.js",
  "ui/landing_workbench.js",
  "ui/landing_workbench.css"
)

$pageEntryPointCandidates = [ordered]@{
  preview = "pages/preview.html"
  accounting = "pages/accounting.html"
  tracking = "pages/tracking.html"
  archive = "pages/archive.html"
  newProject = "pages/new_project.html"
}

$requiredReleaseAssets = @(
  "pages/new_project.html",
  "ui/new_project_wizard.css",
  "ui/new_project_wizard.js"
)

function Get-VersionedName {
  param([string]$FileName, [string]$Tag)
  $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
  $ext = [System.IO.Path]::GetExtension($FileName)
  return "{0}_{1}{2}" -f $base, $Tag, $ext
}

function Normalize-ReleaseRelativePath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) {
    return ""
  }
  $normalized = $Path.Replace("\", "/")
  while ($normalized.Contains("//")) {
    $normalized = $normalized.Replace("//", "/")
  }
  return $normalized.TrimStart("./")
}

function Get-ReleaseSortTimestamp {
  param($Value)
  try {
    return ([DateTimeOffset]::Parse([string]$Value)).UtcDateTime
  } catch {
    return [DateTime]::MinValue
  }
}

New-Item -ItemType Directory -Path $versionDir -Force | Out-Null

$legacyHtmlSource = Join-Path $workspace "g281_profit_dashboard.html"
$modernDashboardSource = Join-Path $workspace "ui\\dashboard.html"
$htmlTargetName = Get-VersionedName -FileName "g281_profit_dashboard.html" -Tag $VersionTag
$htmlTargetPath = Join-Path $versionDir $htmlTargetName

$html = $null
$legacyHtmlAvailable = Test-Path -LiteralPath $legacyHtmlSource
if ($legacyHtmlAvailable) {
  $html = Get-Content -LiteralPath $legacyHtmlSource -Raw -Encoding UTF8
} elseif (Test-Path -LiteralPath $modernDashboardSource) {
  $html = @"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=./ui/dashboard.html">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>G281 Legacy Dashboard Entry</title>
</head>
<body>
  <script>
    location.replace('./ui/dashboard.html');
  </script>
  <p>正在打开旧版 Dashboard：<a href="./ui/dashboard.html">ui/dashboard.html</a></p>
</body>
</html>
"@
} else {
  throw "Cannot find dashboard entry source. Checked: $legacyHtmlSource and $modernDashboardSource"
}

$assetMappings = @()
foreach ($asset in $assets) {
  $versionedName = Get-VersionedName -FileName $asset -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    continue
  }
  $targetPath = Join-Path $versionDir $versionedName
  $legacyCompatPath = Join-Path $versionDir $asset
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  Copy-Item -LiteralPath $sourcePath -Destination $legacyCompatPath -Force
  if ($legacyHtmlAvailable) {
    $html = $html.Replace("./$asset", "./$versionedName")
  }
  $assetMappings += [PSCustomObject]@{
    logicalName = $asset
    releaseName = $versionedName
    sourcePath = $sourcePath
  }
}

foreach ($path in $passthroughPaths) {
  $sourcePath = Join-Path $workspace $path
  $targetPath = Join-Path $versionDir $path
  if (Test-Path -LiteralPath $sourcePath) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse -Force
  }
}

$missingRequiredAssets = @()
foreach ($asset in $requiredReleaseAssets) {
  $assetSourcePath = Join-Path $workspace $asset
  if (-not (Test-Path -LiteralPath $assetSourcePath)) {
    $missingRequiredAssets += $asset
  }
}
if ($missingRequiredAssets.Count -gt 0) {
  $errorMessage = "Required release assets missing: $($missingRequiredAssets -join ', '); aborting release."
  Write-Error $errorMessage
  throw $errorMessage
}
foreach ($asset in $requiredReleaseAssets) {
  $assetMappings += [PSCustomObject]@{
    logicalName = $asset
    releaseName = (Normalize-ReleaseRelativePath $asset)
    sourcePath = Join-Path $workspace $asset
  }
}

$releaseDashboardPath = Join-Path $versionDir "ui\\dashboard.html"
$releaseDashboardHtml = $null
if (Test-Path -LiteralPath $releaseDashboardPath) {
  $releaseDashboardHtml = Get-Content -LiteralPath $releaseDashboardPath -Raw -Encoding UTF8
}

foreach ($asset in $versionedUiAssets) {
  $sourcePath = Join-Path $workspace $asset
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    continue
  }
  $relativeDir = Split-Path -Path $asset -Parent
  $sourceLeaf = Split-Path -Path $asset -Leaf
  $versionedLeaf = Get-VersionedName -FileName $sourceLeaf -Tag $VersionTag
  $versionedRelativePath = Join-Path $relativeDir $versionedLeaf
  $versionedTargetPath = Join-Path $versionDir $versionedRelativePath
  Copy-Item -LiteralPath $sourcePath -Destination $versionedTargetPath -Force
  if ($null -ne $releaseDashboardHtml) {
    $releaseDashboardHtml = $releaseDashboardHtml.Replace("./$sourceLeaf", "./$versionedLeaf")
  }
  $assetMappings += [PSCustomObject]@{
    logicalName = (Normalize-ReleaseRelativePath $asset)
    releaseName = (Normalize-ReleaseRelativePath $versionedRelativePath)
    sourcePath = $sourcePath
  }
}

if ($null -ne $releaseDashboardHtml) {
  Set-Content -LiteralPath $releaseDashboardPath -Value $releaseDashboardHtml -Encoding UTF8
}

$releaseDirectories = @()
foreach ($path in $passthroughPaths) {
  $topLevelDirectory = ($path -split "[\\/]", 2)[0]
  if (($releaseDirectories -notcontains $topLevelDirectory) -and (Test-Path -LiteralPath (Join-Path $versionDir $topLevelDirectory))) {
    $releaseDirectories += $topLevelDirectory
  }
}

$entryPoints = [ordered]@{}
foreach ($entryKey in $pageEntryPointCandidates.Keys) {
  $entryPath = $pageEntryPointCandidates[$entryKey]
  if (Test-Path -LiteralPath (Join-Path $versionDir $entryPath)) {
    $entryPoints[$entryKey] = ($entryPath -replace "\\", "/")
  }
}

$html = "<!-- Release: $VersionTag -->`r`n" + $html
Set-Content -LiteralPath $htmlTargetPath -Value $html -Encoding UTF8

$previewEntryPath = Join-Path $versionDir "pages\\preview.html"
$newProjectEntryPath = Join-Path $versionDir "pages\\new_project.html"
$indexTargetPath = Join-Path $versionDir "index.html"
$indexHtml = if ((Test-Path -LiteralPath $previewEntryPath) -and (Test-Path -LiteralPath $newProjectEntryPath)) {
@"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>G281 Release Entry</title>
</head>
<body>
  <script>
    (function () {
      var previewTarget = './pages/preview.html';
      var newProjectTarget = './pages/new_project.html';
      try {
        var activeCode = localStorage.getItem('g281_active_project') || '';
        var registry = JSON.parse(localStorage.getItem('g281_project_registry') || '{}') || {};
        var hasRegisteredProjects = Object.keys(registry).length > 0;
        var hasActiveProject = !!(activeCode && registry[activeCode]);
        location.replace(hasActiveProject || hasRegisteredProjects ? previewTarget : newProjectTarget);
      } catch (error) {
        location.replace(newProjectTarget);
      }
    })();
  </script>
  <p>正在打开项目入口…</p>
  <p>无项目时进入 <a href="./pages/new_project.html">pages/new_project.html</a></p>
  <p>已有项目时进入 <a href="./pages/preview.html">pages/preview.html</a></p>
  <p>旧版看板入口仍可使用：<a href="./$htmlTargetName">$htmlTargetName</a></p>
</body>
</html>
"@
} else {
@"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=./$htmlTargetName">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>G281 Release Entry</title>
</head>
<body>
  <script>
    location.replace('./$htmlTargetName');
  </script>
  <p>正在打开旧版入口：<a href="./$htmlTargetName">$htmlTargetName</a></p>
</body>
</html>
"@
}
Set-Content -LiteralPath $indexTargetPath -Value $indexHtml -Encoding UTF8

$publishedAt = (Get-Date).ToString("o")
$gitCommit = ""
try {
  $gitCommit = (git -C $workspace rev-parse --short HEAD).Trim()
} catch {
  $gitCommit = ""
}

$sourceFileUpdatedAtUtc = [ordered]@{}
foreach ($asset in $assets) {
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
  schemaVersion = 1
  versionTag = $VersionTag
  requestedVersionTag = $requestedVersionTag
  generatedAt = $publishedAt
  workspace = $workspace
  folderName = (Split-Path -Leaf $versionDir)
  folderPath = $versionDir
  entryFile = "index.html"
  entryFilePath = $indexTargetPath
  mainFile = $htmlTargetName
  mainFilePath = $htmlTargetPath
  gitCommit = $gitCommit
  newStructure = $true
  offlineReady = $true
  entryPoints = $entryPoints
  directories = $releaseDirectories
  missingPageAssets = @()
  generatedPlaceholderAssets = @()
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
  "EntryFile=index.html"
  "MainFile=$htmlTargetName"
  "Folder=$versionDir"
) -join "`r`n"
Set-Content -LiteralPath $latestPath -Value $latestContent -Encoding UTF8

$latestJsonPath = Join-Path $releaseDir "LATEST_RELEASE.json"
$latestJson = [ordered]@{
  schemaVersion = 1
  versionTag = $VersionTag
  structure = "new"
  offlineReady = $true
  entryFile = "index.html"
  mainFile = $htmlTargetName
  folderName = (Split-Path -Leaf $versionDir)
  folderPath = $versionDir
  metadataFile = "release_metadata.json"
  metadataPath = $versionMetadataPath
  timelinePath = (Join-Path $releaseDir "release_timeline.json")
  entryPoints = $entryPoints
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
  structure = "new"
  offlineReady = $true
  folderName = (Split-Path -Leaf $versionDir)
  entryFile = "index.html"
  mainFile = $htmlTargetName
  publishedAt = $publishedAt
  updatedAt = $publishedAt
  metadataPath = $versionMetadataPath
  timelineEvents = @($timelineEvent)
}

$timelineRecords = @($timelineRecord)
if ($existingTimeline.Count -gt 0) {
  $timelineRecords += @($existingTimeline | Where-Object { $_.versionTag -ne $VersionTag })
}
$timelineRecords = @(
  $timelineRecords | Sort-Object -Descending -Property @{
    Expression = { Get-ReleaseSortTimestamp $_.publishedAt }
  }, @{
    Expression = { [string]$_.versionTag }
  }
)

$timelineDocument = [ordered]@{
  schemaVersion = 1
  updatedAt = $publishedAt
  releases = $timelineRecords
}
Set-Content -LiteralPath $timelinePath -Value ($timelineDocument | ConvertTo-Json -Depth 8) -Encoding UTF8

Write-Output $htmlTargetPath
