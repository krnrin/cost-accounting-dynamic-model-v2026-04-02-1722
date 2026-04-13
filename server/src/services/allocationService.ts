import prisma from '../lib/prisma.js';

const LATEST_RECOVERY_PERIOD = 'latest';
const SYNC_EXPENSE_SPECS = [
  { expenseType: 'tooling', expenseName: 'tooling', amountField: 'toolingCost' },
  { expenseType: 'testing', expenseName: 'testing', amountField: 'testingCost' },
  { expenseType: 'rnd', expenseName: 'rnd', amountField: 'rndCost' },
] as const;

function normalizeAllocation(data: any) {
  const totalAmount = Number(data.totalAmount || 0);
  const baselineVolume = Number(data.baselineVolume || 0);
  const unitAllocation = baselineVolume > 0 ? totalAmount / baselineVolume : 0;
  const actualRecovered = Number(data.actualRecovered || 0);
  const plannedRecovery = Number(data.plannedRecovery || totalAmount);
  const remainingRecovery = Math.max(0, totalAmount - actualRecovered);
  const recoveryProgress = plannedRecovery > 0 ? actualRecovered / plannedRecovery : 0;

  return {
    ...data,
    totalAmount,
    baselineVolume,
    unitAllocation,
    plannedRecovery,
    actualRecovered,
    remainingRecovery,
    recoveryProgress,
  };
}

function resolvePricingEffect(paymentMode?: string) {
  if (paymentMode === 'lumpsum') return 'separate_invoice';
  return 'included_in_price';
}

function buildRecoveryProgress(item: any, actualRecovered: number) {
  const plannedRecovery = Number(item.plannedRecovery || item.totalAmount || 0);
  return plannedRecovery > 0 ? actualRecovered / plannedRecovery : 0;
}

async function attachLatestRecoveryFields(client: any, items: any[]) {
  if (items.length === 0) {
    return [];
  }

  const recoveryRecords = await client.recoveryRecord.findMany({
    where: {
      allocationItemId: { in: items.map((item) => item.id) },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const latestRecoveryMap = new Map<string, any>();
  for (const record of recoveryRecords) {
    if (!latestRecoveryMap.has(record.allocationItemId)) {
      latestRecoveryMap.set(record.allocationItemId, record);
    }
  }

  return items.map((item) => {
    const latestRecovery = latestRecoveryMap.get(item.id);
    return {
      ...item,
      latestCumulativeVolume: latestRecovery?.cumulativeVolume ?? 0,
      latestInstallRatioSnapshot: latestRecovery?.installRatioSnapshot ?? 1,
      latestRecoveryPeriod: latestRecovery?.period ?? null,
    };
  });
}

async function listByScenarioWithClient(client: any, scenarioId: string, burdenSide?: string) {
  const items = await client.allocationItem.findMany({
    where: {
      scenarioId,
      ...(burdenSide ? { burdenSide } : {}),
    },
    orderBy: [{ harnessId: 'asc' }, { expenseType: 'asc' }, { createdAt: 'asc' }],
  });

  return attachLatestRecoveryFields(client, items);
}

async function syncLatestRecoverySnapshot(client: any, item: any, cumulativeVolume: number, installRatioSnapshot: number) {
  const safeCumulativeVolume = Math.max(0, Number(cumulativeVolume || 0));
  const safeInstallRatioSnapshot = Number(installRatioSnapshot || 1) || 1;
  const totalAmount = Number(item.totalAmount || 0);
  const baselineVolume = Number(item.baselineVolume || 0);
  const actualRecovered = baselineVolume > 0
    ? Math.min(totalAmount, (safeCumulativeVolume / baselineVolume) * totalAmount)
    : 0;
  const remainingRecovery = Math.max(0, totalAmount - actualRecovered);
  const recoveryProgress = buildRecoveryProgress(item, actualRecovered);
  const status = totalAmount <= 0
    ? 'pending'
    : recoveryProgress >= 1
      ? 'completed'
      : 'recovering';
  const completedAt = recoveryProgress >= 1 ? (item.completedAt ?? new Date()) : null;

  const latestRecovery = await client.recoveryRecord.findFirst({
    where: {
      allocationItemId: item.id,
      period: LATEST_RECOVERY_PERIOD,
    },
    orderBy: { createdAt: 'desc' },
  });

  const recoveryPayload = {
    allocationItemId: item.id,
    projectId: item.projectId,
    scenarioId: item.scenarioId,
    period: LATEST_RECOVERY_PERIOD,
    cumulativeVolume: safeCumulativeVolume,
    installRatioSnapshot: safeInstallRatioSnapshot,
    recoveredAmount: actualRecovered,
    remainingAmount: remainingRecovery,
    status,
    remark: 'synced from allocation bulk save',
  };

  if (latestRecovery) {
    await client.recoveryRecord.update({
      where: { id: latestRecovery.id },
      data: recoveryPayload,
    });
  } else {
    await client.recoveryRecord.create({
      data: recoveryPayload,
    });
  }

  return client.allocationItem.update({
    where: { id: item.id },
    data: {
      actualRecovered,
      remainingRecovery,
      recoveryProgress,
      status,
      completedAt,
      priceAdjustReminder: recoveryProgress >= 1 && item.recoveryCompletionBehavior === 'trigger_price_adjust',
    },
  });
}

// --- Clone & Delete helpers (from phase12 delta) ---
async function cloneScenarioAllocationsWithClient(client: any, sourceScenarioId: string, targetScenarioId: string) {
  const sourceItems = await client.allocationItem.findMany({
    where: { scenarioId: sourceScenarioId },
    orderBy: [{ harnessId: 'asc' }, { expenseType: 'asc' }, { createdAt: 'asc' }],
  });

  if (sourceItems.length === 0) {
    return [];
  }

  const recoveryRecords = await client.recoveryRecord.findMany({
    where: {
      allocationItemId: { in: sourceItems.map((item: any) => item.id) },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  const idMap = new Map<string, string>();
  for (const sourceItem of sourceItems) {
    const { id, createdAt, updatedAt, ...data } = sourceItem;
    const created = await client.allocationItem.create({
      data: {
        ...data,
        scenarioId: targetScenarioId,
      },
    });
    idMap.set(id, created.id);
  }

  for (const record of recoveryRecords) {
    const nextAllocationItemId = idMap.get(record.allocationItemId);
    if (!nextAllocationItemId) {
      continue;
    }

    const { id, createdAt, ...data } = record;
    await client.recoveryRecord.create({
      data: {
        ...data,
        scenarioId: targetScenarioId,
        allocationItemId: nextAllocationItemId,
      },
    });
  }

  return listByScenarioWithClient(client, targetScenarioId);
}

async function deleteScenarioAllocationsWithClient(client: any, scenarioId: string) {
  await client.recoveryRecord.deleteMany({
    where: { scenarioId },
  });
  await client.allocationItem.deleteMany({
    where: { scenarioId },
  });
}

export class AllocationService {
  static async listByScenario(scenarioId: string, burdenSide?: string) {
    return listByScenarioWithClient(prisma, scenarioId, burdenSide);
  }

  static async getById(id: string) {
    const item = await prisma.allocationItem.findUnique({ where: { id } });
    if (!item) {
      const err: any = new Error('Allocation not found');
      err.status = 404;
      throw err;
    }
    return item;
  }

  static async create(projectId: string, scenarioId: string, data: any) {
    const normalized = normalizeAllocation({ ...data, projectId, scenarioId });
    return prisma.allocationItem.create({ data: normalized });
  }

  static async update(id: string, data: any) {
    const current = await this.getById(id);
    const normalized = normalizeAllocation({ ...current, ...data });
    return prisma.allocationItem.update({ where: { id }, data: normalized });
  }

  static async bulkSyncHarnessRows(projectId: string, scenarioId: string, rows: any[]) {
    return prisma.$transaction(async (tx) => {
      const existingItems = await tx.allocationItem.findMany({
        where: { scenarioId },
      });
      const existingItemMap = new Map<string, any>(
        existingItems.map((item) => [`${item.harnessId}:${item.expenseType}`, item]),
      );

      for (const row of rows) {
        const activeItems: any[] = [];

        for (const spec of SYNC_EXPENSE_SPECS) {
          const key = `${row.harnessId}:${spec.expenseType}`;
          const existingItem = existingItemMap.get(key);
          const totalAmount = Number(row[spec.amountField] || 0);

          if (totalAmount <= 0) {
            if (existingItem) {
              await tx.recoveryRecord.deleteMany({
                where: { allocationItemId: existingItem.id },
              });
              await tx.allocationItem.delete({
                where: { id: existingItem.id },
              });
              existingItemMap.delete(key);
            }
            continue;
          }

          const normalized = normalizeAllocation({
            ...existingItem,
            projectId,
            scenarioId,
            harnessId: row.harnessId,
            expenseType: spec.expenseType,
            expenseName: existingItem?.expenseName ?? spec.expenseName,
            totalAmount,
            allocationBasis: row.paymentMode ?? existingItem?.allocationBasis ?? 'amortized',
            baselineVolume: Math.max(1, Number(row.allocBase || existingItem?.baselineVolume || 1)),
            plannedRecovery: totalAmount,
            burdenSide: existingItem?.burdenSide ?? 'supplier',
            pricingEffect: existingItem?.pricingEffect ?? resolvePricingEffect(row.paymentMode),
            recoveryCompletionBehavior: existingItem?.recoveryCompletionBehavior ?? 'notify_only',
            priceAdjustReminder: existingItem?.priceAdjustReminder ?? false,
            targetRecoveryDate: existingItem?.targetRecoveryDate ?? null,
            completedAt: existingItem?.completedAt ?? null,
            status: existingItem?.status ?? 'pending',
            sourceVersionId: existingItem?.sourceVersionId ?? null,
          });

          const saved = existingItem
            ? await tx.allocationItem.update({
                where: { id: existingItem.id },
                data: normalized,
              })
            : await tx.allocationItem.create({
                data: normalized,
              });

          existingItemMap.set(key, saved);
          activeItems.push(saved);
        }

        for (const activeItem of activeItems) {
          const syncedItem = await syncLatestRecoverySnapshot(
            tx,
            activeItem,
            Number(row.cumProduced || 0),
            Number(row.vehicleRatio || 1),
          );
          existingItemMap.set(`${syncedItem.harnessId}:${syncedItem.expenseType}`, syncedItem);
        }
      }

      return listByScenarioWithClient(tx, scenarioId);
    });
  }

<<<<<<< HEAD
  // --- Clone & Delete (from phase12 delta) ---
=======
>>>>>>> 1d60f5e (feat: add server services batch 2 (6 medium service files))
  static async cloneScenarioAllocations(sourceScenarioId: string, targetScenarioId: string) {
    return cloneScenarioAllocationsWithClient(prisma, sourceScenarioId, targetScenarioId);
  }

  static async cloneScenarioAllocationsWithClient(client: any, sourceScenarioId: string, targetScenarioId: string) {
    return cloneScenarioAllocationsWithClient(client, sourceScenarioId, targetScenarioId);
  }

  static async deleteScenarioAllocations(scenarioId: string) {
    return deleteScenarioAllocationsWithClient(prisma, scenarioId);
  }

  static async deleteScenarioAllocationsWithClient(client: any, scenarioId: string) {
    return deleteScenarioAllocationsWithClient(client, scenarioId);
  }
}
