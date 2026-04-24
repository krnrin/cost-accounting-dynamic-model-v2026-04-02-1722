/**
 * 包装物流费用同步引擎
 *
 * 功能：
 * 1. 将 PackagingLogisticsCost 同步到 HarnessInput.packaging 和 HarnessInput.freight
 * 2. 确保包装费用正确参与成本计算（影响 deliveredPrice）
 *
 * 数据流：
 * PackagingLogisticsCost → HarnessInput.packaging + HarnessInput.freight → computeHarnessCost() → deliveredPrice
 */
import { db } from '@/data/db';
import type { PackagingLogisticsRecord } from '@/data/db';
import type { PackagingLogisticsCost } from '@/types/packaging';
import type { PackagingCost, FreightCost } from '@/types/harness';

/**
 * 将 PackagingLogisticsCost 转换为 HarnessInput.packaging
 */
export function logisticsToPackaging(cost: PackagingLogisticsCost): PackagingCost {
  return {
    innerBoxCost: cost.innerPackaging,
    outerBoxCost: cost.outerPackaging,
    palletCost: 0, // 暂无托盘费用
    trayDividerCost: 0, // 暂无隔板费用
    bubbleWrapCost: 0, // 暂无气泡膜费用
    labelCost: 0, // 暂无标签费用
    subtotal: cost.totalPackaging,
  };
}

/**
 * 将 PackagingLogisticsCost 转换为 HarnessInput.freight
 */
export function logisticsToFreight(cost: PackagingLogisticsCost): FreightCost {
  return {
    freight: cost.freight,
    excessFreight: cost.excessFreight,
    shortHaul: cost.shortHaul,
    thirdPartyWarehouse: cost.thirdPartyWarehouse,
    storage: cost.storage,
    subtotal: cost.totalLogistics,
  };
}

/**
 * 同步单条线束的包装物流费用到 HarnessInput
 */
export async function syncLogisticsToHarness(
  projectId: string,
  harnessId: string,
  cost: PackagingLogisticsCost
): Promise<void> {
  const id = `${projectId}::${harnessId}`;
  const harness = await db.harnesses.get(id);

  if (!harness) {
    console.warn(`Harness not found: ${id}`);
    return;
  }

  // 更新 HarnessInput 中的 packaging 和 freight
  const updatedInput = {
    ...harness.input,
    packaging: logisticsToPackaging(cost),
    freight: logisticsToFreight(cost),
  };

  await db.harnesses.update(id, {
    input: updatedInput,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * 同步项目下所有线束的包装物流费用
 */
export async function syncProjectLogistics(projectId: string): Promise<{
  synced: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    synced: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // 加载所有包装物流费用记录
  const logisticsRecords = await db.packagingLogistics
    .where('projectId')
    .equals(projectId)
    .toArray();

  if (logisticsRecords.length === 0) {
    return result;
  }

  // 加载所有线束记录
  const harnessRecords = await db.harnesses
    .where('projectId')
    .equals(projectId)
    .toArray();

  const harnessMap = new Map(harnessRecords.map(h => [h.harnessId, h]));

  // 逐条同步
  for (const record of logisticsRecords) {
    try {
      const harness = harnessMap.get(record.harnessId);

      if (!harness) {
        result.skipped++;
        result.errors.push(`线束不存在: ${record.harnessId}`);
        continue;
      }

      // 检查是否有有效数据
      if (record.cost.grandTotal === 0) {
        result.skipped++;
        continue;
      }

      await syncLogisticsToHarness(projectId, record.harnessId, record.cost);
      result.synced++;
    } catch (err) {
      result.errors.push(`同步失败: ${record.harnessId} - ${err}`);
    }
  }

  return result;
}

/**
 * 批量更新包装物流费用并同步到 HarnessInput
 */
export async function batchSaveAndSyncLogistics(
  projectId: string,
  costs: PackagingLogisticsCost[]
): Promise<{
  saved: number;
  synced: number;
  errors: string[];
}> {
  const result = {
    saved: 0,
    synced: 0,
    errors: [] as string[],
  };

  const now = new Date().toISOString();

  // 1. 保存到 packagingLogistics 表
  const records: PackagingLogisticsRecord[] = costs.map(cost => ({
    id: `${projectId}::${cost.harnessId}`,
    projectId,
    harnessId: cost.harnessId,
    cost,
    updatedAt: now,
  }));

  try {
    await db.packagingLogistics.bulkPut(records);
    result.saved = records.length;
  } catch (err) {
    result.errors.push(`批量保存失败: ${err}`);
    return result;
  }

  // 2. 同步到 HarnessInput
  for (const cost of costs) {
    try {
      if (cost.grandTotal > 0) {
        await syncLogisticsToHarness(projectId, cost.harnessId, cost);
        result.synced++;
      }
    } catch (err) {
      result.errors.push(`同步失败: ${cost.harnessId} - ${err}`);
    }
  }

  return result;
}

/**
 * 检查包装物流费用是否已同步到 HarnessInput
 */
export async function checkLogisticsSyncStatus(
  projectId: string,
  harnessId: string
): Promise<{
  hasLogisticsRecord: boolean;
  hasHarnessRecord: boolean;
  isSynced: boolean;
  logisticsCost: number;
  harnessPackTotal: number;
}> {
  const id = `${projectId}::${harnessId}`;

  const logisticsRecord = await db.packagingLogistics.get(id);
  const harnessRecord = await db.harnesses.get(id);

  const logisticsCost = logisticsRecord?.cost?.grandTotal ?? 0;
  const harnessPackTotal = harnessRecord?.input
    ? (harnessRecord.input.packaging?.subtotal ?? 0) + (harnessRecord.input.freight?.subtotal ?? 0)
    : 0;

  return {
    hasLogisticsRecord: !!logisticsRecord,
    hasHarnessRecord: !!harnessRecord,
    isSynced: Math.abs(logisticsCost - harnessPackTotal) < 0.0001,
    logisticsCost,
    harnessPackTotal,
  };
}

/**
 * 获取项目包装物流费用汇总（用于成本计算验证）
 */
export async function getProjectLogisticsSummary(projectId: string): Promise<{
  totalPackaging: number;
  totalLogistics: number;
  grandTotal: number;
  weightedPerUnit: number;
  recordCount: number;
}> {
  const logisticsRecords = await db.packagingLogistics
    .where('projectId')
    .equals(projectId)
    .toArray();

  const harnessRecords = await db.harnesses
    .where('projectId')
    .equals(projectId)
    .toArray();

  const vehicleRatioMap = new Map(
    harnessRecords.map(h => [h.harnessId, h.input.vehicleRatio])
  );

  let totalPackaging = 0;
  let totalLogistics = 0;
  let weightedPerUnit = 0;

  for (const record of logisticsRecords) {
    totalPackaging += record.cost.totalPackaging;
    totalLogistics += record.cost.totalLogistics;

    const ratio = vehicleRatioMap.get(record.harnessId) ?? 0;
    weightedPerUnit += record.cost.grandTotal * ratio;
  }

  return {
    totalPackaging: Math.round(totalPackaging * 10000) / 10000,
    totalLogistics: Math.round(totalLogistics * 10000) / 10000,
    grandTotal: Math.round((totalPackaging + totalLogistics) * 10000) / 10000,
    weightedPerUnit: Math.round(weightedPerUnit * 10000) / 10000,
    recordCount: logisticsRecords.length,
  };
}
