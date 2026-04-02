param(
  [string]$MasterPath = "g281_data_master.json",
  [string]$BomPath = "g281_data_bom_changes.json",
  [string]$HistoryPath = "g281_data_history.json",
  [string]$ApprovalsPath = "g281_data_approvals.json",
  [string]$BomValidationPath = "g281_data_bom_validation.json",
  [string]$BomVersionsPath = "g281_data_bom_versions.json",
  [string]$ConnectorProtocolStatusPath = "g281_data_connector_protocol_status.json",
  [string]$CapitalValidationPath = "g281_data_capital_validation.json",
  [string]$LaborValidationPath = "g281_data_labor_validation.json",
  [string]$PackagingValidationPath = "g281_data_packaging_validation.json",
  [string]$WireCatalogPath = "g281_data_wire_catalog.json",
  [string]$FinancialVersionsPath = "g281_data_financial_versions.json",
  [string]$BomWorkbookCopiesPath = "g281_data_bom_workbook_copies.json",
  [string]$ConfigSheetCopiesPath = "g281_data_config_sheet_copies.json",
  [string]$OutPath = "g281_data_bundle.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$master = Get-Content -Encoding UTF8 -Raw -LiteralPath $MasterPath
$bomChanges = Get-Content -Encoding UTF8 -Raw -LiteralPath $BomPath
$historySeed = Get-Content -Encoding UTF8 -Raw -LiteralPath $HistoryPath
$approvalSeed = Get-Content -Encoding UTF8 -Raw -LiteralPath $ApprovalsPath
$bomValidation = Get-Content -Encoding UTF8 -Raw -LiteralPath $BomValidationPath
$bomVersions = Get-Content -Encoding UTF8 -Raw -LiteralPath $BomVersionsPath
$connectorProtocolStatus = Get-Content -Encoding UTF8 -Raw -LiteralPath $ConnectorProtocolStatusPath
$capitalValidation = Get-Content -Encoding UTF8 -Raw -LiteralPath $CapitalValidationPath
$laborValidation = Get-Content -Encoding UTF8 -Raw -LiteralPath $LaborValidationPath
$packagingValidation = Get-Content -Encoding UTF8 -Raw -LiteralPath $PackagingValidationPath
$wireCatalog = Get-Content -Encoding UTF8 -Raw -LiteralPath $WireCatalogPath
$financialVersions = Get-Content -Encoding UTF8 -Raw -LiteralPath $FinancialVersionsPath
$bomWorkbookCopies = Get-Content -Encoding UTF8 -Raw -LiteralPath $BomWorkbookCopiesPath
$configSheetCopies = Get-Content -Encoding UTF8 -Raw -LiteralPath $ConfigSheetCopiesPath

# Keep the JSON structure intact so arrays remain arrays in the browser runtime.
$bundle = @"
window.G281_RUNTIME = {
  master: $master,
  bomChanges: $bomChanges,
  historySeed: $historySeed,
  approvalSeed: $approvalSeed,
  bomValidation: $bomValidation,
  bomVersions: $bomVersions,
  connectorProtocolStatus: $connectorProtocolStatus,
  capitalValidation: $capitalValidation,
  laborValidation: $laborValidation,
  packagingValidation: $packagingValidation,
  wireCatalog: $wireCatalog,
  financialVersions: $financialVersions,
  bomWorkbookCopies: $bomWorkbookCopies,
  configSheetCopies: $configSheetCopies
};
"@

Set-Content -Encoding UTF8 -LiteralPath $OutPath -Value $bundle

Write-Output $OutPath
