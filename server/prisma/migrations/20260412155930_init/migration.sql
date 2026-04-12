-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "feishuId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectCode" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "costRates" TEXT NOT NULL DEFAULT '{}',
    "metalPrices" TEXT NOT NULL DEFAULT '{}',
    "volumes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lifecycleYears" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "installRatio" REAL NOT NULL DEFAULT 1,
    "rateSnapshot" TEXT NOT NULL DEFAULT '{}',
    "rateSnapshotVersion" TEXT,
    "bomVersionRef" TEXT,
    "quoteParamSnapshot" TEXT NOT NULL DEFAULT '{}',
    "sourceScenarioId" TEXT,
    "compareBaselineId" TEXT,
    "frozenAt" DATETIME,
    "releasedAt" DATETIME,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Harness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "harnessId" TEXT NOT NULL,
    "harnessName" TEXT NOT NULL,
    "input" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Harness_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "harnessId" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "template" TEXT NOT NULL DEFAULT 'geely',
    "data" TEXT NOT NULL DEFAULT '{}',
    "quoteParams" TEXT NOT NULL DEFAULT '{}',
    "quoteResult" TEXT NOT NULL DEFAULT '{}',
    "internalCostBaseline" REAL NOT NULL DEFAULT 0,
    "profitGap" REAL NOT NULL DEFAULT 0,
    "exWorksPrice" REAL NOT NULL DEFAULT 0,
    "arrivalPrice" REAL NOT NULL DEFAULT 0,
    "effectivePrice" REAL NOT NULL DEFAULT 0,
    "effectivePriceMode" TEXT NOT NULL DEFAULT 'arrival',
    "customerBurdenMode" TEXT NOT NULL DEFAULT 'supplier_full',
    "recoveryCompletionBehavior" TEXT NOT NULL DEFAULT 'notify_only',
    "customerAccepted" BOOLEAN NOT NULL DEFAULT false,
    "lockedFields" TEXT NOT NULL DEFAULT '[]',
    "editableFields" TEXT NOT NULL DEFAULT '[]',
    "approvalFields" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllocationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "harnessId" TEXT NOT NULL,
    "expenseType" TEXT NOT NULL,
    "expenseName" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "allocationBasis" TEXT,
    "baselineVolume" INTEGER NOT NULL DEFAULT 0,
    "unitAllocation" REAL NOT NULL DEFAULT 0,
    "plannedRecovery" REAL NOT NULL DEFAULT 0,
    "actualRecovered" REAL NOT NULL DEFAULT 0,
    "remainingRecovery" REAL NOT NULL DEFAULT 0,
    "recoveryProgress" REAL NOT NULL DEFAULT 0,
    "burdenSide" TEXT NOT NULL DEFAULT 'supplier',
    "pricingEffect" TEXT NOT NULL DEFAULT 'internal_only',
    "recoveryCompletionBehavior" TEXT NOT NULL DEFAULT 'notify_only',
    "priceAdjustReminder" BOOLEAN NOT NULL DEFAULT false,
    "targetRecoveryDate" DATETIME,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecoveryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "allocationItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "cumulativeVolume" INTEGER NOT NULL DEFAULT 0,
    "installRatioSnapshot" REAL NOT NULL DEFAULT 1,
    "recoveredAmount" REAL NOT NULL DEFAULT 0,
    "remainingAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'normal',
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "reason" TEXT,
    "affectedHarnessIds" TEXT NOT NULL DEFAULT '[]',
    "affectedBomRows" TEXT NOT NULL DEFAULT '[]',
    "costImpact" REAL NOT NULL DEFAULT 0,
    "quoteImpact" REAL NOT NULL DEFAULT 0,
    "residualImpact" REAL NOT NULL DEFAULT 0,
    "baselineVersionId" TEXT,
    "compareVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrackingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "trackingType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceRef" TEXT,
    "currentStatus" TEXT NOT NULL DEFAULT 'pending',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "owner" TEXT,
    "plannedAction" TEXT,
    "actualResult" TEXT,
    "closeReason" TEXT,
    "warningRef" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConnectorPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "customerAgreedPrice" REAL NOT NULL DEFAULT 0,
    "supplierQuotedPrice" REAL NOT NULL DEFAULT 0,
    "finalNegotiatedPrice" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "disputeReason" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectorPricing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WirePricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "wireSize" TEXT NOT NULL,
    "copperWeightG" REAL NOT NULL DEFAULT 0,
    "aluminumWeightG" REAL NOT NULL DEFAULT 0,
    "nonMetalCost" REAL NOT NULL DEFAULT 0,
    "copperBasePrice" REAL NOT NULL DEFAULT 0,
    "aluminumBasePrice" REAL NOT NULL DEFAULT 0,
    "processingFee" REAL NOT NULL DEFAULT 0,
    "calculatedPrice" REAL NOT NULL DEFAULT 0,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WirePricing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DevPartPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amortizationQty" INTEGER NOT NULL DEFAULT 0,
    "unitPriceWithAmortization" REAL NOT NULL DEFAULT 0,
    "unitPriceAfterAmortization" REAL NOT NULL DEFAULT 0,
    "lifecycleTotalQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DevPartPricing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DevPartMold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "devPartPricingId" TEXT NOT NULL,
    "moldType" TEXT NOT NULL,
    "moldName" TEXT NOT NULL,
    "moldCost" REAL NOT NULL DEFAULT 0,
    "isAmortized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DevPartMold_devPartPricingId_fkey" FOREIGN KEY ("devPartPricingId") REFERENCES "DevPartPricing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuxiliaryPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuxiliaryPricing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceDiscrepancy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "harnessId" TEXT,
    "partNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partCategory" TEXT NOT NULL,
    "referencePrice" REAL NOT NULL DEFAULT 0,
    "actualPrice" REAL NOT NULL DEFAULT 0,
    "discrepancy" REAL NOT NULL DEFAULT 0,
    "discrepancyRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionType" TEXT,
    "resolutionNote" TEXT,
    "assignedTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceDiscrepancy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '{}',
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "versionRef" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SimulationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "parameterSnapshot" TEXT NOT NULL DEFAULT '{}',
    "resultSnapshot" TEXT NOT NULL DEFAULT '{}',
    "baselineScenarioId" TEXT,
    "convertedScenarioId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SimulationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SimulationTask_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnualDropRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "year" INTEGER NOT NULL,
    "dropRate" REAL NOT NULL DEFAULT 0,
    "costBefore" REAL NOT NULL DEFAULT 0,
    "costAfter" REAL NOT NULL DEFAULT 0,
    "priceBefore" REAL NOT NULL DEFAULT 0,
    "priceAfter" REAL NOT NULL DEFAULT 0,
    "profitBefore" REAL NOT NULL DEFAULT 0,
    "profitAfter" REAL NOT NULL DEFAULT 0,
    "impactSummary" TEXT NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnnualDropRecord_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "condition" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "ruleId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "sourceObjectType" TEXT,
    "sourceObjectId" TEXT,
    "impactAmount" REAL NOT NULL DEFAULT 0,
    "assignedTo" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "snapshot" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_feishuId_key" ON "User"("feishuId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE INDEX "Scenario_projectId_idx" ON "Scenario"("projectId");

-- CreateIndex
CREATE INDEX "Scenario_rateSnapshotVersion_idx" ON "Scenario"("rateSnapshotVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Harness_projectId_harnessId_key" ON "Harness"("projectId", "harnessId");

-- CreateIndex
CREATE INDEX "Quote_projectId_idx" ON "Quote"("projectId");

-- CreateIndex
CREATE INDEX "Quote_scenarioId_idx" ON "Quote"("scenarioId");

-- CreateIndex
CREATE INDEX "Quote_harnessId_idx" ON "Quote"("harnessId");

-- CreateIndex
CREATE INDEX "AllocationItem_projectId_idx" ON "AllocationItem"("projectId");

-- CreateIndex
CREATE INDEX "AllocationItem_scenarioId_idx" ON "AllocationItem"("scenarioId");

-- CreateIndex
CREATE INDEX "AllocationItem_harnessId_idx" ON "AllocationItem"("harnessId");

-- CreateIndex
CREATE INDEX "RecoveryRecord_allocationItemId_idx" ON "RecoveryRecord"("allocationItemId");

-- CreateIndex
CREATE INDEX "RecoveryRecord_projectId_idx" ON "RecoveryRecord"("projectId");

-- CreateIndex
CREATE INDEX "RecoveryRecord_scenarioId_idx" ON "RecoveryRecord"("scenarioId");

-- CreateIndex
CREATE INDEX "ChangeEvent_projectId_idx" ON "ChangeEvent"("projectId");

-- CreateIndex
CREATE INDEX "ChangeEvent_scenarioId_idx" ON "ChangeEvent"("scenarioId");

-- CreateIndex
CREATE INDEX "TrackingItem_projectId_idx" ON "TrackingItem"("projectId");

-- CreateIndex
CREATE INDEX "TrackingItem_scenarioId_idx" ON "TrackingItem"("scenarioId");

-- CreateIndex
CREATE INDEX "ConnectorPricing_projectId_idx" ON "ConnectorPricing"("projectId");

-- CreateIndex
CREATE INDEX "ConnectorPricing_status_idx" ON "ConnectorPricing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorPricing_projectId_partNo_key" ON "ConnectorPricing"("projectId", "partNo");

-- CreateIndex
CREATE INDEX "WirePricing_projectId_idx" ON "WirePricing"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WirePricing_projectId_partNo_key" ON "WirePricing"("projectId", "partNo");

-- CreateIndex
CREATE INDEX "DevPartPricing_projectId_idx" ON "DevPartPricing"("projectId");

-- CreateIndex
CREATE INDEX "DevPartPricing_category_idx" ON "DevPartPricing"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DevPartPricing_projectId_partNo_key" ON "DevPartPricing"("projectId", "partNo");

-- CreateIndex
CREATE INDEX "DevPartMold_devPartPricingId_idx" ON "DevPartMold"("devPartPricingId");

-- CreateIndex
CREATE INDEX "AuxiliaryPricing_projectId_idx" ON "AuxiliaryPricing"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AuxiliaryPricing_projectId_partNo_key" ON "AuxiliaryPricing"("projectId", "partNo");

-- CreateIndex
CREATE INDEX "PriceDiscrepancy_projectId_idx" ON "PriceDiscrepancy"("projectId");

-- CreateIndex
CREATE INDEX "PriceDiscrepancy_scenarioId_idx" ON "PriceDiscrepancy"("scenarioId");

-- CreateIndex
CREATE INDEX "PriceDiscrepancy_status_idx" ON "PriceDiscrepancy"("status");

-- CreateIndex
CREATE INDEX "Setting_category_idx" ON "Setting"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_category_key_key" ON "Setting"("category", "key");

-- CreateIndex
CREATE INDEX "SimulationTask_projectId_idx" ON "SimulationTask"("projectId");

-- CreateIndex
CREATE INDEX "SimulationTask_scenarioId_idx" ON "SimulationTask"("scenarioId");

-- CreateIndex
CREATE INDEX "AnnualDropRecord_projectId_idx" ON "AnnualDropRecord"("projectId");

-- CreateIndex
CREATE INDEX "AnnualDropRecord_scenarioId_idx" ON "AnnualDropRecord"("scenarioId");

-- CreateIndex
CREATE INDEX "AlertRule_category_idx" ON "AlertRule"("category");

-- CreateIndex
CREATE INDEX "AlertRule_severity_idx" ON "AlertRule"("severity");

-- CreateIndex
CREATE INDEX "AlertRule_enabled_idx" ON "AlertRule"("enabled");

-- CreateIndex
CREATE INDEX "AlertEvent_projectId_idx" ON "AlertEvent"("projectId");

-- CreateIndex
CREATE INDEX "AlertEvent_scenarioId_idx" ON "AlertEvent"("scenarioId");

-- CreateIndex
CREATE INDEX "AlertEvent_category_idx" ON "AlertEvent"("category");

-- CreateIndex
CREATE INDEX "AlertEvent_severity_idx" ON "AlertEvent"("severity");

-- CreateIndex
CREATE INDEX "AlertEvent_status_idx" ON "AlertEvent"("status");

-- CreateIndex
CREATE INDEX "AlertEvent_occurredAt_idx" ON "AlertEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Version_projectId_versionNumber_key" ON "Version"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_idx" ON "AuditLog"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
