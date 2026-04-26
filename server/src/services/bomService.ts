import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';

type HarnessInput = {
  bom?: any[];
  [key: string]: any;
};

function buildBomRowId(harnessId: string, index: number) {
  return `${harnessId}::${index}`;
}

function parseBomRowId(rowId: string) {
  const [harnessId, indexText] = rowId.split('::');
  return { harnessId, index: Number(indexText) };
}

export class BomService {
  static async listScenarioBomRows(scenarioId: string, filters?: { harness?: string; category?: string }) {
    const harnesses = await prisma.harness.findMany({
      where: { scenarioId },
      orderBy: { harnessId: 'asc' },
    });

    const rows = harnesses.flatMap((harness) => {
      const input = fromJson<HarnessInput>(harness.input, {} as HarnessInput);
      const bom = Array.isArray(input.bom) ? input.bom : [];
      return bom.map((row, index) => ({
        id: buildBomRowId(harness.harnessId, index),
        projectId: harness.projectId,
        scenarioId: harness.scenarioId,
        harnessId: harness.harnessId,
        harnessName: harness.harnessName,
        rowIndex: index,
        ...row,
      }));
    });

    return rows.filter((row) => {
      if (filters?.harness && row.harnessId !== filters.harness) return false;
      if (filters?.category && row.itemCategory !== filters.category) return false;
      return true;
    });
  }

  static async createBomRow(scenarioId: string, harnessId: string, bomRow: any) {
    const harness = await prisma.harness.findFirst({ where: { scenarioId, harnessId } });
    if (!harness) {
      const err: any = new Error('Harness not found');
      err.status = 404;
      throw err;
    }
    const input = fromJson<HarnessInput>(harness.input, {} as HarnessInput);
    const bom = Array.isArray(input.bom) ? input.bom : [];
    bom.push(bomRow);
    const updated = await prisma.harness.update({
      where: { id: harness.id },
      data: { input: toJson({ ...input, bom }) },
    });
    return {
      projectId: updated.projectId,
      scenarioId: updated.scenarioId,
      harnessId: updated.harnessId,
      rowId: buildBomRowId(updated.harnessId, bom.length - 1),
      bomRow,
    };
  }

  // [PR-038] 通过 rowId 反查 projectId，不再要求调用方传入
  static async updateBomRow(rowId: string, patch: any) {
    const { harnessId, index } = parseBomRowId(rowId);
    // [PR-038] 通过 harnessId 查找 harness，自动获取 projectId
    const harness = await prisma.harness.findFirst({ where: { harnessId } });
    if (!harness) {
      const err: any = new Error('Harness not found');
      err.status = 404;
      throw err;
    }
    const input = fromJson<HarnessInput>(harness.input, {} as HarnessInput);
    const bom = Array.isArray(input.bom) ? input.bom : [];
    if (!bom[index]) {
      const err: any = new Error('BOM row not found');
      err.status = 404;
      throw err;
    }
    bom[index] = { ...bom[index], ...patch };
    await prisma.harness.update({ where: { id: harness.id }, data: { input: toJson({ ...input, bom }) } });
    return {
      id: rowId,
      projectId: harness.projectId,
      scenarioId: harness.scenarioId,
      harnessId,
      ...bom[index],
    };
  }

  // [PR-038] 通过 rowId 反查 projectId，不再要求调用方传入
  static async deleteBomRow(rowId: string) {
    const { harnessId, index } = parseBomRowId(rowId);
    // [PR-038] 通过 harnessId 查找 harness，自动获取 projectId
    const harness = await prisma.harness.findFirst({ where: { harnessId } });
    if (!harness) {
      const err: any = new Error('Harness not found');
      err.status = 404;
      throw err;
    }
    const input = fromJson<HarnessInput>(harness.input, {} as HarnessInput);
    const bom = Array.isArray(input.bom) ? input.bom : [];
    if (!bom[index]) {
      const err: any = new Error('BOM row not found');
      err.status = 404;
      throw err;
    }
    bom.splice(index, 1);
    await prisma.harness.update({ where: { id: harness.id }, data: { input: toJson({ ...input, bom }) } });
    return {
      id: rowId,
      projectId: harness.projectId,
      scenarioId: harness.scenarioId,
      harnessId,
    };
  }

  static async importBomRows(scenarioId: string, harnessId: string, rows: any[]) {
    const harness = await prisma.harness.findFirst({ where: { scenarioId, harnessId } });
    if (!harness) {
      const err: any = new Error('Harness not found');
      err.status = 404;
      throw err;
    }
    const input = fromJson<HarnessInput>(harness.input, {} as HarnessInput);
    const updated = await prisma.harness.update({
      where: { id: harness.id },
      data: { input: toJson({ ...input, bom: rows }) },
    });
    return {
      projectId: updated.projectId,
      scenarioId: updated.scenarioId,
      harnessId,
      importedCount: rows.length,
      rowCount: rows.length,
    };
  }

  static async summarizeScenarioBom(scenarioId: string) {
    const rows = await this.listScenarioBomRows(scenarioId);
    const harnessCount = new Set(rows.map((r) => r.harnessId)).size;
    const categorySummary = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.itemCategory || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const totalCost = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      rowCount: rows.length,
      harnessCount,
      totalCost,
      categorySummary,
    };
  }

  static async diffScenarioBom(scenarioId: string, baseScenarioId: string) {
    const currentRows = await this.listScenarioBomRows(scenarioId);
    const baseRows = await this.listScenarioBomRows(baseScenarioId);

    const baseMap = new Map(baseRows.map((row) => [`${row.harnessId}::${row.partNo}::${row.rowIndex}`, row]));
    const currentMap = new Map(currentRows.map((row) => [`${row.harnessId}::${row.partNo}::${row.rowIndex}`, row]));

    const diff: Array<{ changeType: 'added' | 'replaced' | 'cancelled'; current?: any; base?: any }> = [];

    for (const [key, row] of currentMap) {
      const base = baseMap.get(key);
      if (!base) {
        diff.push({ changeType: 'added', current: row });
        continue;
      }
      const changed = ['partName', 'qty', 'unitPrice', 'amount', 'itemCategory', 'spec', 'supplier']
        .some((field) => row[field] !== base[field]);
      if (changed) {
        diff.push({ changeType: 'replaced', current: row, base });
      }
    }

    for (const [key, row] of baseMap) {
      if (!currentMap.has(key)) {
        diff.push({ changeType: 'cancelled', base: row });
      }
    }

    return diff;
  }
}
