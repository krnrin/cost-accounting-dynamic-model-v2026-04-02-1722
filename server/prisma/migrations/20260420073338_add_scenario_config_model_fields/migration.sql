-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lifecycleYears" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "installRatio" REAL NOT NULL DEFAULT 1,
    "config" TEXT NOT NULL DEFAULT '{}',
    "vehicleConfigs" TEXT NOT NULL DEFAULT '[]',
    "configSkus" TEXT NOT NULL DEFAULT '[]',
    "harnessConfigMappings" TEXT NOT NULL DEFAULT '[]',
    "vehicleConfigMeta" TEXT NOT NULL DEFAULT '{}',
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
INSERT INTO "new_Scenario" ("bomVersionRef", "compareBaselineId", "createdAt", "createdBy", "frozenAt", "id", "installRatio", "lifecycleYears", "name", "notes", "projectId", "quoteParamSnapshot", "rateSnapshot", "rateSnapshotVersion", "releasedAt", "sourceScenarioId", "status", "type", "updatedAt", "volume") SELECT "bomVersionRef", "compareBaselineId", "createdAt", "createdBy", "frozenAt", "id", "installRatio", "lifecycleYears", "name", "notes", "projectId", "quoteParamSnapshot", "rateSnapshot", "rateSnapshotVersion", "releasedAt", "sourceScenarioId", "status", "type", "updatedAt", "volume" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
CREATE INDEX "Scenario_projectId_idx" ON "Scenario"("projectId");
CREATE INDEX "Scenario_rateSnapshotVersion_idx" ON "Scenario"("rateSnapshotVersion");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
