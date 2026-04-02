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
  "vendor\\xlsx",
  "vendor\\univer-editor"
)

function Get-VersionedName {
  param([string]$FileName, [string]$Tag)
  $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
  $ext = [System.IO.Path]::GetExtension($FileName)
  return "{0}_{1}{2}" -f $base, $Tag, $ext
}

New-Item -ItemType Directory -Path $versionDir -Force | Out-Null

$htmlSource = Join-Path $workspace "g281_profit_dashboard.html"
$htmlTargetName = Get-VersionedName -FileName "g281_profit_dashboard.html" -Tag $VersionTag
$htmlTargetPath = Join-Path $versionDir $htmlTargetName

$html = Get-Content -LiteralPath $htmlSource -Raw -Encoding UTF8
$assetMappings = @()
foreach ($asset in $assets) {
  $versionedName = Get-VersionedName -FileName $asset -Tag $VersionTag
  $sourcePath = Join-Path $workspace $asset
  $targetPath = Join-Path $versionDir $versionedName
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  $html = $html.Replace("./$asset", "./$versionedName")
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

$html = "<!-- Release: $VersionTag -->`r`n" + $html
Set-Content -LiteralPath $htmlTargetPath -Value $html -Encoding UTF8

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
  mainFile = $htmlTargetName
  mainFilePath = $htmlTargetPath
  gitCommit = $gitCommit
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
) -join "`r`n"
Set-Content -LiteralPath $latestPath -Value $latestContent -Encoding UTF8

$latestJsonPath = Join-Path $releaseDir "LATEST_RELEASE.json"
$latestJson = [ordered]@{
  schemaVersion = 1
  versionTag = $VersionTag
  mainFile = $htmlTargetName
  folderName = (Split-Path -Leaf $versionDir)
  folderPath = $versionDir
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
  schemaVersion = 1
  updatedAt = $publishedAt
  releases = $timelineRecords
}
Set-Content -LiteralPath $timelinePath -Value ($timelineDocument | ConvertTo-Json -Depth 8) -Encoding UTF8

Write-Output $htmlTargetPath
