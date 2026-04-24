-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Harness" (
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

INSERT INTO "new_Harness" (
    "createdAt",
    "harnessId",
    "harnessName",
    "id",
    "input",
    "projectId",
    "result",
    "scenarioId",
    "updatedAt"
)
SELECT
    "createdAt",
    "harnessId",
    "harnessName",
    "id",
    "input",
    "projectId",
    "result",
    "scenarioId",
    "updatedAt"
FROM "Harness";

DROP TABLE "Harness";
ALTER TABLE "new_Harness" RENAME TO "Harness";

CREATE UNIQUE INDEX "Harness_projectId_scenarioId_harnessId_key" ON "Harness"("projectId", "scenarioId", "harnessId");
CREATE INDEX "Harness_projectId_scenarioId_idx" ON "Harness"("projectId", "scenarioId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
