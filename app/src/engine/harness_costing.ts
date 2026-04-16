import {
  HarnessInput,
  HarnessResult,
  InternalHarnessResult,
  InternalProjectResult,
  MaterialBreakdown,
  ProjectHarnessResult,
  BomItem,
  WireItem,
  SchemaComputeResult,
} from '@/types/harness';
import {
  CostRates,
  DEFAULT_PROJECT_FACTORY_ID,
  InternalCostRates,
  MetalPrices,
  BomClassificationRule,
  CostStructureSchema,
  Level1Coefficients,
  PROJECT_FACTORY_IDS,
  type ProjectFactoryId,
} from '@/types/project';
import { 
  FinancialBenchmark, 
  PricingContext 
} from '@/types/financial_schema';
import { numberOr, safeArray } from './shared_utils';
import { detectPrecisionLevel, estimateByCoefficients, LEVEL1_COEFFICIENTS } from './precision';

/** 内部实绩核算默认费率 (基准 / K3) */
export const INTERNAL_DEFAULTS: InternalCostRates = {
  laborRate: 28.58, // 以 Assembly 基准
  indirectLaborRate: 8.50,
  lowValueConsumablesRate: 0.88,
  materialConsumptionRate: 1.86,
  factoryAmortizationRate: 1.45,
  automationAmortizationRate: 2.03,
  otherOverheadRate: 1.42,
  materialWasteRate: 0.005, // 0.5% 基准
};

export const INTERNAL_FACTORY_RATES: Record<ProjectFactoryId, InternalCostRates> = {
  K1: {
    laborRate: 30.1,
    indirectLaborRate: 8.9,
    lowValueConsumablesRate: 0.92,
    materialConsumptionRate: 1.94,
    factoryAmortizationRate: 1.56,
    automationAmortizationRate: 2.12,
    otherOverheadRate: 1.48,
    materialWasteRate: 0.0055,
  },
  K2: {
    laborRate: 29.2,
    indirectLaborRate: 8.7,
    lowValueConsumablesRate: 0.9,
    materialConsumptionRate: 1.9,
    factoryAmortizationRate: 1.5,
    automationAmortizationRate: 2.08,
    otherOverheadRate: 1.45,
    materialWasteRate: 0.0052,
  },
  K3: { ...INTERNAL_DEFAULTS },
  K4: {
    laborRate: 27.9,
    indirectLaborRate: 8.35,
    lowValueConsumablesRate: 0.86,
    materialConsumptionRate: 1.82,
    factoryAmortizationRate: 1.39,
    automationAmortizationRate: 1.97,
    otherOverheadRate: 1.39,
    materialWasteRate: 0.0048,
  },
  K5: {
    laborRate: 27.4,
    indirectLaborRate: 8.18,
    lowValueConsumablesRate: 0.84,
    materialConsumptionRate: 1.76,
    factoryAmortizationRate: 1.33,
    automationAmortizationRate: 1.9,
    otherOverheadRate: 1.34,
    materialWasteRate: 0.0046,
  },
  K6: {
    laborRate: 26.8,
    indirectLaborRate: 8.02,
    lowValueConsumablesRate: 0.82,
    materialConsumptionRate: 1.71,
    factoryAmortizationRate: 1.28,
    automationAmortizationRate: 1.84,
    otherOverheadRate: 1.3,
    materialWasteRate: 0.0045,
  },
  K7: {
    laborRate: 31.0,
    indirectLaborRate: 9.1,
    lowValueConsumablesRate: 0.95,
    materialConsumptionRate: 2.01,
    factoryAmortizationRate: 1.62,
    automationAmortizationRate: 2.2,
    otherOverheadRate: 1.54,
    materialWasteRate: 0.0058,
  },
};

function normalizeProjectFactoryId(factoryId?: string | null): ProjectFactoryId {
  if (!factoryId) return DEFAULT_PROJECT_FACTORY_ID;
  const normalized = factoryId.trim().toUpperCase();
  if ((PROJECT_FACTORY_IDS as readonly string[]).includes(normalized)) {
    return normalized as ProjectFactoryId;
  }
  return DEFAULT_PROJECT_FACTORY_ID;
}

function getDefaultInternalFactoryRates(factoryId?: string | null): InternalCostRates {
  return INTERNAL_FACTORY_RATES[normalizeProjectFactoryId(factoryId)] ?? INTERNAL_DEFAULTS;
}

function mapBenchmarkFactoryToInternalRates(factory: FinancialBenchmark['factories'][string]): InternalCostRates {
  return {
    laborRate: factory.labor_rates.assembly,
    indirectLaborRate: factory.moh_components.indirect_labor,
    lowValueConsumablesRate: factory.moh_components.low_value_consumables,
    materialConsumptionRate: factory.moh_components.material_consumption,
    factoryAmortizationRate: factory.moh_components.factory_amortization,
    automationAmortizationRate: factory.moh_components.automation_amortization,
    otherOverheadRate: factory.moh_components.other_overhead,
    materialWasteRate: factory.scrap_rate_param,
  };
}

function applySimulationAdjustments(
  baseRates: InternalCostRates,
  factory: FinancialBenchmark['factories'][string],
  simulation?: PricingContext['simulation']
): InternalCostRates {
  const adjustedRates = { ...baseRates };

  if (simulation?.efficiency) {
    const efficiencyFactor = simulation.efficiency / factory.efficiency_base;
    adjustedRates.laborRate /= efficiencyFactor;
    adjustedRates.indirectLaborRate /= efficiencyFactor;
  }

  if (simulation?.annualVolume && factory.lrp_volume_base) {
    const absorptionFactor = factory.lrp_volume_base / simulation.annualVolume;
    if (absorptionFactor > 1) {
      adjustedRates.factoryAmortizationRate *= absorptionFactor;
      adjustedRates.automationAmortizationRate *= absorptionFactor;
    }
  }

  if (simulation?.utilizationFactor && factory.automation_utilization_factor) {
    const utilFactor = factory.automation_utilization_factor / simulation.utilizationFactor;
    adjustedRates.automationAmortizationRate *= utilFactor;
  }

  return adjustedRates;
}

/**
 * 获取工厂内部实绩核算参数 (Dynamic Source of Truth)
 */
export function getInternalFactoryRates(
  factoryId: string | undefined,
  benchmark?: FinancialBenchmark,
  simulation?: PricingContext['simulation']
): InternalCostRates {
  const normalizedFactoryId = normalizeProjectFactoryId(factoryId);
  const factory = benchmark?.factories?.[normalizedFactoryId] ?? (factoryId ? benchmark?.factories?.[factoryId] : undefined);
  if (!factory) {
    return getDefaultInternalFactoryRates(normalizedFactoryId);
  }

  return applySimulationAdjustments(mapBenchmarkFactoryToInternalRates(factory), factory, simulation);
}

export function getSelectedFactoryId(selectedFactory?: string | null): ProjectFactoryId {
  return normalizeProjectFactoryId(selectedFactory);
}

// ── 材料分类关键字 ──
export const DEFAULT_CLASSIFICATION_RULES: BomClassificationRule[] = [
  { category: 'wire', patterns: ['^wire$', '^导线$', '^cable$', '^电缆$', '导线|cable|电缆'], matchFields: ['itemCategory', 'partName'], priority: 10 },
  { category: 'connector', patterns: ['^connector$', '^连接器$', '^护套$', '^插头$', '^插座$', '连接器|护套|插头|插座|屏蔽环'], matchFields: ['itemCategory', 'partName'], priority: 10 },
  { category: 'terminal', patterns: ['^terminal$', '^端子$', '端子'], matchFields: ['itemCategory', 'partName'], priority: 10 },
  { category: 'ipt_terminal', patterns: ['^ipt_terminal$'], matchFields: ['itemCategory'], priority: 10 },
  { category: 'bracket_rubber', patterns: ['^bracket_rubber$', '支架|橡胶'], matchFields: ['itemCategory', 'partName'], priority: 5 },
  { category: 'tape_tube', patterns: ['^tape_tube$', '胶带|套管'], matchFields: ['itemCategory', 'partName'], priority: 5 },
];

/**
 * 判断BOM行的物料类型
 */
export function classifyBomItem(item: Partial<BomItem>, rules?: BomClassificationRule[]): BomItem['itemCategory'] {
  if (rules && rules.length > 0) {
    const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    let matchedButExcluded = false;

    for (const rule of sortedRules) {
      const fields = rule.matchFields || ['partName', 'itemCategory'];
      const valuesToMatch = fields.map(f => String(item[f] || '').toLowerCase());
      
      const matchesPattern = rule.patterns.some(p => {
        const regex = new RegExp(p, 'i');
        return valuesToMatch.some(v => regex.test(v));
      });

      if (matchesPattern) {
        // Check excludePatterns
        if (rule.excludePatterns && rule.excludePatterns.length > 0) {
          const isExcluded = rule.excludePatterns.some(p => {
            const regex = new RegExp(p, 'i');
            return valuesToMatch.some(v => regex.test(v));
          });
          if (isExcluded) {
            matchedButExcluded = true;
            continue;
          }
        }
        return rule.category;
      }
    }
    if (matchedButExcluded) return 'other';
  }

  // Fallback to original hardcoded logic
  const category = (item.itemCategory || '').toLowerCase();
  if (category === 'wire' || category === '导线' || category === 'cable' || category === '电缆') return 'wire';
  if (category === 'connector' || category === '连接器' || category === '护套' || category === '插头' || category === '插座') return 'connector';
  if (category === 'terminal' || category === '端子') return 'terminal';
  if (category === 'ipt_terminal') return 'ipt_terminal';
  if (category === 'bracket_rubber') return 'bracket_rubber';
  if (category === 'tape_tube') return 'tape_tube';

  // 通过名称关键字兜底
  const name = String(item.partName || (item as any).description || '').toLowerCase();
  if (/导线|cable|电缆/.test(name)) return 'wire';
  if (/连接器|护套|插头|插座|屏蔽环/.test(name)) return 'connector';
  if (/端子/.test(name)) return 'terminal';
  if (/胶带|套管/.test(name)) return 'tape_tube';
  if (/支架|橡胶/.test(name)) return 'bracket_rubber';
  
  return 'other';
}

/**
 * 计算单条BOM行的材料成本
 *
 * 导线类:
 *   成本 = (铜重/km × 长度m/1000 × 铜价/吨÷1000 + 铝重/km × 长度m/1000 × 铝价/吨÷1000 + 非金属单价/m × 长度m) × 数量
 *
 * 非导线类:
 *   成本 = 单价 × 数量
 */
export function computeBomLineCost(
  item: BomItem | WireItem,
  wireCatalog: Map<string, any> | null,
  metalPrices: MetalPrices
) {
  const partNo = String(item.partNo || '').trim();
  const qty = numberOr(item.qty, 1);

  // 尝试匹配导线目录
  const wireEntry = wireCatalog ? wireCatalog.get(partNo) : null;
  const itemType = classifyBomItem(item);

  if (wireEntry || itemType === 'wire') {
    // ── 导线类 ──
    const wireItem = item as WireItem;
    const lengthM = numberOr((item as any).lengthM, 1); // 如果 unit 是 m，qty 可能就是长度
    
    // 兼容多种模式获取重量
    const cuWeightPerKm = numberOr(wireEntry && wireEntry.copperWeightPerKm, (item as any).copperWeightPerKm || 0);
    const alWeightPerKm = numberOr(wireEntry && wireEntry.aluminumWeightPerKm, (item as any).aluminumWeightPerKm || 0);
    const nonMetalPerM = numberOr(wireEntry && wireEntry.nonMetalPricePerM, (item as any).nonMetalPricePerM || 0);

    let cuWeight: number, alWeight: number, nonMetalCost: number;

    if (wireItem.copperWeightPerUnit !== undefined) {
      // 模式A: 使用 types/harness.ts 中的定义 (kg/单位)
      cuWeight = numberOr(wireItem.copperWeightPerUnit, 0);
      alWeight = numberOr(wireItem.aluminumWeightPerUnit, 0);
      nonMetalCost = numberOr(wireItem.nonMetalCostPerUnit, 0);
    } else if ((item as any).copperWeight !== undefined) {
      // 模式B: 原始 JS 中的模式 (kg 总重, 已计算好)
      cuWeight = numberOr((item as any).copperWeight, 0);
      alWeight = numberOr((item as any).aluminumWeight, 0);
      nonMetalCost = numberOr((item as any).nonMetalPricePerM, 0) * lengthM;
    } else {
      // 模式C: 从 wire catalog 计算 (g/km -> kg)
      cuWeight = (cuWeightPerKm * lengthM) / 1000 / 1000;
      alWeight = (alWeightPerKm * lengthM) / 1000 / 1000;
      nonMetalCost = nonMetalPerM * lengthM;
    }

    const cuPrice = numberOr(metalPrices.copper, 68400); // 元/吨
    const alPrice = numberOr(metalPrices.aluminum, 18200); // 元/吨

    const cuCost = (cuWeight * cuPrice) / 1000; // kg × 元/吨 ÷ 1000 = 元
    const alCost = (alWeight * alPrice) / 1000;

    // ── unitPrice 优先策略 ──
    // 当 BOM 行同时提供了 unitPrice（权威采购总价）和金属重量时：
    //   - lineCost 取 unitPrice × qty（权威材料总成本）
    //   - cuCost/alCost 仍从金属重量算出（用于敏感性分析）
    //   - nonMetalCost = lineCost - cuCost - alCost（差额即非金属部分）
    // 当没有 unitPrice 时，回退到纯金属重量计算。
    const hasUnitPrice = item.unitPrice !== undefined && item.unitPrice !== null && numberOr(item.unitPrice, 0) > 0;

    if (hasUnitPrice) {
      const lineCost = numberOr(item.unitPrice, 0) * qty;
      const metalCostPerUnit = cuCost + alCost;
      // 非金属部分 = 单价 - 金属成本（可能包含绝缘层、护套、屏蔽层、端子压接等）
      const impliedNonMetal = Math.max(0, numberOr(item.unitPrice, 0) - metalCostPerUnit);

      return {
        partNo,
        type: 'wire',
        cuWeight: cuWeight * qty,
        alWeight: alWeight * qty,
        cuCost: cuCost * qty,
        alCost: alCost * qty,
        nonMetalCost: impliedNonMetal * qty,
        lineCost,
        qty,
      };
    }

    // 无 unitPrice 时：纯金属重量计算模式
    const wireCost = (cuCost + alCost + nonMetalCost) * qty;

    return {
      partNo,
      type: 'wire',
      cuWeight: cuWeight * qty,
      alWeight: alWeight * qty,
      cuCost: cuCost * qty,
      alCost: alCost * qty,
      nonMetalCost: nonMetalCost * qty,
      lineCost: wireCost,
      qty,
    };
  } else {
    // ── 非导线类 ──
    const unitPrice = numberOr(item.unitPrice, 0);
    const lineCost = unitPrice * qty;

    return {
      partNo,
      type: itemType,
      cuWeight: 0,
      alWeight: 0,
      cuCost: 0,
      alCost: 0,
      nonMetalCost: 0,
      lineCost,
      qty,
    };
  }
}

/**
 * 计算线束的材料总成本及拆分 (引擎重构提取)
 */
export function computeMaterialCost(
  bom: (BomItem | WireItem)[],
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null,
  fallbackMaterialCost?: number,
  fallbackCopperWeight?: number,
  fallbackAluminumWeight?: number
): { materialCost: number; totalCuWeight: number; totalAlWeight: number; breakdown: MaterialBreakdown } {
  let materialCost = 0;
  let totalCuWeight = 0,
    totalAlWeight = 0;
  let totalCuCost = 0,
    totalAlCost = 0,
    totalNonMetalCost = 0;
  const materialByType: MaterialBreakdown['byType'] = {
    wire: 0,
    connector: 0,
    terminal: 0,
    ipt_terminal: 0,
    bracket_rubber: 0,
    tape_tube: 0,
    other: 0,
  };

  const bomItems = safeArray(bom);
  if (bomItems.length > 0) {
    for (const item of bomItems) {
      const result = computeBomLineCost(item, wireCatalog, metalPrices);
      materialCost += result.lineCost;
      totalCuWeight += result.cuWeight;
      totalAlWeight += result.alWeight;
      totalCuCost += result.cuCost;
      totalAlCost += result.alCost;
      totalNonMetalCost += result.nonMetalCost;
      
      const type = result.type as keyof MaterialBreakdown['byType'];
      if (materialByType[type] !== undefined) {
        materialByType[type] += result.lineCost;
      } else {
        materialByType.other += result.lineCost;
      }
    }
  } else if (fallbackMaterialCost !== undefined) {
    materialCost = numberOr(fallbackMaterialCost, 0);
    totalCuWeight = numberOr(fallbackCopperWeight, 0);
    totalAlWeight = numberOr(fallbackAluminumWeight, 0);
  }

  return {
    materialCost,
    totalCuWeight,
    totalAlWeight,
    breakdown: {
      cuCost: totalCuCost,
      alCost: totalAlCost,
      nonMetalCost: totalNonMetalCost,
      byType: materialByType,
      totalMetalCost: totalCuCost + totalAlCost,
      totalNonWireCost: materialCost - materialByType.wire,
    }
  };
}

/**
 * computeHarnessCostBySchema — 基于配置 Schema 的通用核算引擎
 */
export function computeHarnessCostBySchema(
  input: HarnessInput,
  schema: CostStructureSchema,
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null,
  rates?: CostRates
): SchemaComputeResult {
  const {
    harnessId = '',
    harnessName = '',
    vehicleRatio = 0,
    frontHours = 0,
    backHours = 0,
    packaging: pack = { 
      innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, 
      trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, 
      subtotal: 0 
    },
    freight = { 
      freight: 0, excessFreight: 0, shortHaul: 0, 
      thirdPartyWarehouse: 0, storage: 0, subtotal: 0 
    },
  } = input;

  const processHours = frontHours + backHours || (input as any).processHours || 0;
  if (!rates) throw new Error('computeHarnessCostBySchema: rates required');
  const currentRates = rates;

  // 1. 计算基础材料成本 (bom_sum 项的基础)
  const { materialCost, totalCuWeight, totalAlWeight, breakdown } = computeMaterialCost(
    input.bom,
    metalPrices,
    wireCatalog,
    (input as any).materialCost,
    (input as any).copperWeight,
    (input as any).aluminumWeight
  );

  const computedItems: Record<string, number> = {};
  const items = [...schema.items].sort((a, b) => (a.order || 0) - (b.order || 0));

  let exFactoryPrice = 0;
  let addonTotal = 0;

  for (const item of items) {
    let value = 0;
    switch (item.calcMethod) {
      case 'bom_sum':
        value = materialCost;
        break;
      case 'rate_x_hours':
        const r_h = item.rate !== undefined ? item.rate : (
          item.key === 'directLabor' ? currentRates.laborRate : 
          item.key === 'manufacturing' ? currentRates.mfgRate : 0
        );
        value = processHours * r_h;
        break;
      case 'rate_x_base':
        const rate = item.rate || 0;
        let base = 0;
        if (item.baseRef) {
          for (const refKey of item.baseRef) {
            base += computedItems[refKey] || 0;
          }
        }
        value = base * rate;
        break;
      case 'direct':
        if (item.key === 'packaging') {
          const p = (pack as any) || { subtotal: 0 };
          value = numberOr(p.subtotal, 0) || (
            numberOr(p.innerBoxCost, 0) + numberOr(p.outerBoxCost, 0) + 
            numberOr(p.palletCost, 0) + numberOr(p.trayDividerCost, 0) + 
            numberOr(p.bubbleWrapCost, 0) + numberOr(p.labelCost, 0)
          );
        } else if (item.key === 'freight') {
          const f = (freight as any) || {};
          value = 
            numberOr(f.freight, 0) + numberOr(f.excessFreight, 0) + 
            numberOr(f.shortHaul, 0) + numberOr(f.thirdPartyWarehouse, 0) + 
            numberOr(f.storage, 0);
        } else {
          value = item.fixedAmount || 0;
        }
        break;
      case 'fixed_per_unit':
        value = item.fixedAmount || 0;
        break;
      case 'custom_formula':
        // TODO: 扩展公式引擎
        value = 0;
        break;
    }

    computedItems[item.key] = value;
    
    const inEx = item.inExFactory !== false; // 默认 true
    const isAddon = item.isAddon === true;

    if (inEx && !isAddon) {
      exFactoryPrice += value;
    }
    if (isAddon) {
      addonTotal += value;
    }
  }

  return {
    harnessId,
    harnessName,
    vehicleRatio,
    items: computedItems,
    exFactoryPrice,
    deliveredPrice: exFactoryPrice + addonTotal,
    schemaName: schema.name,
    materialBreakdown: breakdown,
    processHours,
    copperWeight: totalCuWeight,
    aluminumWeight: totalAlWeight,
  };
}

/**
 * computeInternalHarnessCost — 内部实绩精算模型 (对内)
 * 严格对标财务核价协议 V1.0，包含 6D MOH 与 产能吸收逻辑
 */
export function computeInternalHarnessCost(
  input: HarnessInput,
  internalRates: InternalCostRates,
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null,
  auditTraceId?: string
): InternalHarnessResult {
  const {
    harnessId = '',
    harnessName = '',
    vehicleRatio = 0,
    bom = [],
    frontHours = 0,
    backHours = 0,
    packaging: pack = { 
      innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, 
      trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, 
      subtotal: 0 
    },
    freight = { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
  } = input;

  const rates = internalRates || INTERNAL_DEFAULTS;
  const processHours = frontHours + backHours || (input as any).processHours || 0;

  // 1. 材料成本
  let materialCost = 0;
  let totalCuWeight = 0, totalAlWeight = 0;
  const bomItems = safeArray(bom);
  
  if (bomItems.length > 0) {
    for (const item of bomItems) {
      const result = computeBomLineCost(item, wireCatalog, metalPrices);
      materialCost += result.lineCost;
      totalCuWeight += result.cuWeight;
      totalAlWeight += result.alWeight;
    }
  } else if ((input as any).materialCost !== undefined) {
    materialCost = numberOr((input as any).materialCost, 0);
    totalCuWeight = numberOr((input as any).copperWeight, 0);
    totalAlWeight = numberOr((input as any).aluminumWeight, 0);
  }

  // 2. 内部实绩精算 (6D MOH)
  const directLabor = processHours * rates.laborRate;
  const indirectLabor = processHours * rates.indirectLaborRate;
  const lowValueConsumables = processHours * rates.lowValueConsumablesRate;
  const materialConsumption = processHours * rates.materialConsumptionRate;
  const factoryAmortization = processHours * rates.factoryAmortizationRate;
  const automationAmortization = processHours * rates.automationAmortizationRate;
  const otherOverhead = processHours * rates.otherOverheadRate;
  
  const materialWaste = materialCost * rates.materialWasteRate;

  // 制造费总计 (不含直接人工)
  const mfgOverheadTotal = 
    indirectLabor + lowValueConsumables + materialConsumption + 
    factoryAmortization + automationAmortization + otherOverhead + 
    materialWaste;

  // 3. 包装/运输
  const packSubtotal = numberOr(pack.subtotal, 0) || (
    numberOr(pack.innerBoxCost, 0) + numberOr(pack.outerBoxCost, 0) + 
    numberOr(pack.palletCost, 0) + numberOr(pack.trayDividerCost, 0) + 
    numberOr(pack.bubbleWrapCost, 0) + numberOr(pack.labelCost, 0)
  );
  const freightSubtotal = 
    numberOr(freight.freight, 0) + numberOr(freight.excessFreight, 0) + 
    numberOr(freight.shortHaul, 0) + numberOr(freight.thirdPartyWarehouse, 0) + 
    numberOr(freight.storage, 0);
  const packTotal = packSubtotal + freightSubtotal;

  // 4. 内部总成本
  const internalCost = materialCost + directLabor + mfgOverheadTotal + packTotal;

  // 5. Gap Status 判定 (Demo Logic: 超出预算 5% 触发预警)
  let gapStatus: InternalHarnessResult['gapStatus'] = 'NORMAL';
  const targetPrice = (input as any).targetPrice || 0;
  if (targetPrice > 0 && internalCost > targetPrice * 1.05) {
    gapStatus = 'GAP_TRIGGERED';
  }

  // 6. 偏差分析 (Deviation Analysis) - 实绩与标杆对标
  const benchmarkWasteRate = 0.005; // 0.5% 标杆
  let deviationAnalysis = '';
  const managementGapAmount = (rates.materialWasteRate - benchmarkWasteRate) * materialCost;
  
  if (rates.materialWasteRate > benchmarkWasteRate) {
    const diff = ((rates.materialWasteRate - benchmarkWasteRate) * 100).toFixed(2);
    deviationAnalysis = `实绩损耗 (${(rates.materialWasteRate * 100).toFixed(2)}%) 较标杆 (0.5%) 偏高 ${diff}pt`;
  } else if (rates.materialWasteRate < benchmarkWasteRate) {
    const diff = ((benchmarkWasteRate - rates.materialWasteRate) * 100).toFixed(2);
    deviationAnalysis = `实绩损耗 (${(rates.materialWasteRate * 100).toFixed(2)}%) 优于标杆 (0.5%) ${diff}pt`;
  } else {
    deviationAnalysis = '实绩损耗与标杆持平 (0.5%)';
  }

  return {
    harnessId,
    harnessName,
    vehicleRatio,
    materialCost,
    directLabor,
    indirectLabor,
    lowValueConsumables,
    materialConsumption,
    factoryAmortization,
    automationAmortization,
    otherOverhead,
    materialWaste,
    mfgOverheadTotal,
    packTotal,
    internalCost,
    processHours,
    copperWeight: totalCuWeight,
    aluminumWeight: totalAlWeight,
    gapStatus,
    auditTraceId,
    deviationAnalysis,
    managementGapAmount,
    salesAdjustmentBuffer: 0 // 默认为 0，由外部注入
  };
}

/**
 * computeInternalProjectDynamic — 动态实绩汇总入口 (决策舱核心引擎)
 */
export function computeInternalProjectDynamic(
  harnessInputs: HarnessInput[],
  context: PricingContext,
  factoryId: string
): InternalProjectResult {
  const rates = getInternalFactoryRates(factoryId, context.benchmark, context.simulation);
  const results = harnessInputs.map(input => {
    const res = computeInternalHarnessCost(input, rates, context.metalPrices, null, context.benchmark.audit_trace_id);
    // 注入商务调节项
    res.salesAdjustmentBuffer = context.simulation.salesAdjustmentBuffer || 0;
    return res;
  });
  return computeInternalProjectFromHarnesses(results);
}

/**
 * computeInternalProjectFromHarnesses — 从内部核算结果汇总到项目级
 */
export function computeInternalProjectFromHarnesses(results: InternalHarnessResult[]): InternalProjectResult {
  const harnesses = safeArray(results);
  const summary: InternalProjectResult = {
    harnesses,
    vehicleCost: 0,
    weightedMaterial: 0,
    weightedDirectLabor: 0,
    weightedIndirectLabor: 0,
    weightedLowValueConsumables: 0,
    weightedMaterialConsumption: 0,
    weightedFactoryAmortization: 0,
    weightedAutomationAmortization: 0,
    weightedOtherOverhead: 0,
    weightedMaterialWaste: 0,
    weightedMfgOverheadTotal: 0,
    weightedPack: 0,
    totalSalesAdjustmentBuffer: 0,
    projectGapStatus: 'NORMAL',
    deviationAnalysis: ''
  };

  const deviations: string[] = [];
  for (const h of harnesses) {
    const ratio = numberOr(h.vehicleRatio, 0);
    summary.vehicleCost += h.internalCost * ratio;
    summary.weightedMaterial += h.materialCost * ratio;
    summary.weightedDirectLabor += h.directLabor * ratio;
    summary.weightedIndirectLabor += h.indirectLabor * ratio;
    summary.weightedLowValueConsumables += h.lowValueConsumables * ratio;
    summary.weightedMaterialConsumption += h.materialConsumption * ratio;
    summary.weightedFactoryAmortization += h.factoryAmortization * ratio;
    summary.weightedAutomationAmortization += h.automationAmortization * ratio;
    summary.weightedOtherOverhead += h.otherOverhead * ratio;
    summary.weightedMaterialWaste += h.materialWaste * ratio;
    summary.weightedMfgOverheadTotal += h.mfgOverheadTotal * ratio;
    summary.weightedPack += h.packTotal * ratio;
    summary.totalSalesAdjustmentBuffer += (h.salesAdjustmentBuffer || 0) * ratio;

    if (h.gapStatus !== 'NORMAL') {
      summary.projectGapStatus = 'GAP_TRIGGERED';
    }
    
    if (h.deviationAnalysis && !deviations.includes(h.deviationAnalysis)) {
      deviations.push(h.deviationAnalysis);
    }
  }

  // 对冲 Gap：如果存在销售调节项，则从总成本中扣除（模拟利润对冲）
  summary.vehicleCost -= summary.totalSalesAdjustmentBuffer;

  summary.deviationAnalysis = deviations.join('; ');
  return summary;
}

export function mapInternalToHarnessResult(result: InternalHarnessResult): HarnessResult {
  return {
    harnessId: result.harnessId,
    harnessName: result.harnessName,
    vehicleRatio: result.vehicleRatio,
    copperWeight: result.copperWeight,
    aluminumWeight: result.aluminumWeight,
    processHours: result.processHours,
    materialCost: result.materialCost,
    wasteCost: result.materialWaste,
    directLabor: result.directLabor,
    manufacturing: result.mfgOverheadTotal,
    laborPlusMfg: result.directLabor + result.mfgOverheadTotal,
    mgmtFee: 0,
    profit: 0,
    exFactoryPrice: result.internalCost - result.packTotal,
    packSubtotal: result.packTotal,
    freightSubtotal: 0,
    packTotal: result.packTotal,
    deliveredPrice: result.internalCost,
    materialBreakdown: {
      cuCost: 0,
      alCost: 0,
      nonMetalCost: 0,
      byType: { wire: 0, connector: 0, terminal: 0, ipt_terminal: 0, bracket_rubber: 0, tape_tube: 0, other: result.materialCost },
      totalMetalCost: 0,
      totalNonWireCost: result.materialCost,
    },
    packagingDetail: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: result.packTotal },
    freightDetail: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
    precisionLevel: 2,
    _params: {
      wasteRate: result.materialWaste && result.materialCost ? result.materialWaste / result.materialCost : 0,
      mgmtRate: 0,
      profitRate: 0,
      laborRate: 0,
      mfgRate: 0,
    },
  };
}

export function mapInternalProjectToProjectHarnessResult(results: InternalHarnessResult[]): ProjectHarnessResult {
  const internal = computeInternalProjectFromHarnesses(results);
  const harnesses = results.map(mapInternalToHarnessResult);
  return {
    harnesses,
    vehicleCost: internal.vehicleCost,
    harnessCount: harnesses.length,
    totalCopperWeight: harnesses.reduce((s, h) => s + h.copperWeight, 0),
    totalAluminumWeight: harnesses.reduce((s, h) => s + h.aluminumWeight, 0),
    totalProcessHours: harnesses.reduce((s, h) => s + h.processHours, 0),
    weightedMaterial: internal.weightedMaterial,
    weightedWaste: internal.weightedMaterialWaste,
    weightedLabor: internal.weightedDirectLabor,
    weightedMfg: internal.weightedMfgOverheadTotal,
    weightedLaborPlusMfg: internal.weightedDirectLabor + internal.weightedMfgOverheadTotal,
    weightedMgmtFee: 0,
    weightedProfit: 0,
    weightedExFactory: internal.vehicleCost - internal.weightedPack,
    weightedPack: internal.weightedPack,
    weightedFreight: 0,
    weightedCopperWeight: harnesses.reduce((s, h) => s + h.copperWeight * h.vehicleRatio, 0),
    weightedAluminumWeight: harnesses.reduce((s, h) => s + h.aluminumWeight * h.vehicleRatio, 0),
    weightedProcessHours: harnesses.reduce((s, h) => s + h.processHours * h.vehicleRatio, 0),
  };
}

/**
 * computeHarnessCost — 单线束号完整成本核算 (向后兼容包装器)
 * 内部委托给 computeHarnessCostBySchema
 */
export function computeHarnessCost(
  input: HarnessInput,
  rates: CostRates,
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null
): HarnessResult {
  const sr = computeHarnessCostBySchema(input, { name: 'default', version: '1.0', items: [] }, metalPrices, wireCatalog, rates);
  return schemaResultToHarnessResult(sr, input, rates, detectPrecisionLevel(input));
}

/** 默认成本结构 Schema (客户报价口径，仅用于向后兼容) */
export const DEFAULT_COST_STRUCTURE: CostStructureSchema = {
  name: '默认成本结构',
  version: '1.0',
  items: [
    { key: 'material',    label: '材料成本', calcMethod: 'bom_sum',       order: 10, inExFactory: true },
    { key: 'waste',       label: '废品',     calcMethod: 'rate_x_base',   rate: 0.01, baseRef: ['material'], order: 20, inExFactory: true },
    { key: 'directLabor', label: '直接人工', calcMethod: 'rate_x_hours',  rate: 35,   order: 30, inExFactory: true },
    { key: 'manufacturing', label: '制造费', calcMethod: 'rate_x_hours',  rate: 46.69, order: 40, inExFactory: true },
    { key: 'mgmtFee',     label: '管理费',   calcMethod: 'rate_x_base',   rate: 0.06, baseRef: ['material', 'directLabor', 'manufacturing'], order: 50, inExFactory: true },
    { key: 'profit',      label: '利润',     calcMethod: 'rate_x_base',   rate: 0.056627, baseRef: ['material', 'waste', 'directLabor', 'manufacturing', 'mgmtFee'], order: 60, inExFactory: true },
    { key: 'packaging',   label: '包装费',   calcMethod: 'direct',        order: 70, isAddon: true },
    { key: 'freight',     label: '运输费',   calcMethod: 'direct',        order: 80, isAddon: true },
  ],
};

/** 默认客户报价费率 (仅用于向后兼容 DEFAULTS 引用) */
export const DEFAULTS: CostRates = {
  laborRate: 35,
  mfgRate: 46.69,
  wasteRate: 0.01,
  mgmtRate: 0.06,
  profitRate: 0.056627,
};

/** 自适应核算选项 */
export interface AdaptiveComputeOptions {
  /** 成本结构 Schema (可选, 有则走 Schema 模式) */
  costStructure?: CostStructureSchema;
  /** BOM 分类规则 (可选) */
  bomClassificationRules?: BomClassificationRule[];
  /** Level 1 近似系数 (可选) */
  level1Coefficients?: Level1Coefficients;
  /** 参考总价 (Level 1 估算需要) */
  referenceTotalPrice?: number;
  /** 强制精度等级 (可选, 不填则自动检测) */
  forcePrecisionLevel?: 1 | 2 | 3;
}

/**
 * computeHarnessCostAdaptive — 三级精度自适应核算入口
 *
 * 根据可用数据自动选择最高精度：
 * - Level 3: 有 BOM → BOM 行级精算
 * - Level 2: 有 materialCost 或工时 → 线束级汇总
 * - Level 1: 仅有参考总价 → 系数近似估算
 *
 * 当 ProjectConfig.costStructure 存在时，Level 3/2 自动切换到 Schema 驱动引擎。
 */
export function computeHarnessCostAdaptive(
  input: HarnessInput,
  rates: CostRates,
  metalPrices: MetalPrices,
  wireCatalog: Map<string, any> | null = null,
  options?: AdaptiveComputeOptions
): HarnessResult {
  const level = options?.forcePrecisionLevel ?? detectPrecisionLevel(input);

  // ── Level 1: 系数近似 ──
  if (level === 1) {
    const refPrice = options?.referenceTotalPrice ?? numberOr((input as any).referenceTotalPrice, 0);
    if (refPrice <= 0) {
      // 无参考价也无任何数据 — 使用 Schema 引擎返回零值结果
      return schemaResultToHarnessResult(
        computeHarnessCostBySchema(input, { name: 'fallback', version: '1.0', items: [] }, metalPrices, wireCatalog, rates),
        input,
        rates,
        level,
      );
    }
    const coefficients = options?.level1Coefficients ?? LEVEL1_COEFFICIENTS;
    const est = estimateByCoefficients(refPrice, rates, coefficients);

    return {
      harnessId: input.harnessId || '',
      harnessName: input.harnessName || '',
      vehicleRatio: input.vehicleRatio || 0,
      copperWeight: 0,
      aluminumWeight: 0,
      processHours: 0,
      materialCost: est.materialCost,
      wasteCost: est.waste,
      directLabor: est.directLabor,
      manufacturing: est.manufacturing,
      laborPlusMfg: est.directLabor + est.manufacturing,
      mgmtFee: est.mgmtFee,
      profit: est.profit,
      exFactoryPrice: est.exFactoryPrice,
      packSubtotal: est.packaging,
      freightSubtotal: est.freight,
      packTotal: est.packaging + est.freight,
      deliveredPrice: est.deliveredPrice,
      materialBreakdown: {
        cuCost: 0, alCost: 0, nonMetalCost: 0,
        byType: { wire: 0, connector: 0, terminal: 0, ipt_terminal: 0, bracket_rubber: 0, tape_tube: 0, other: est.materialCost },
        totalMetalCost: 0, totalNonWireCost: est.materialCost,
      },
      packagingDetail: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: est.packaging },
      freightDetail: { freight: est.freight, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: est.freight },
      precisionLevel: 1,
      _params: {
        wasteRate: rates.wasteRate,
        mgmtRate: rates.mgmtRate,
        profitRate: rates.profitRate,
        laborRate: rates.laborRate,
        mfgRate: rates.mfgRate,
      },
    };
  }

  // ── Level 2/3: Schema 模式或标准模式 ──
  if (options?.costStructure) {
    // Schema 驱动引擎
    const schemaResult = computeHarnessCostBySchema(input, options.costStructure, metalPrices, wireCatalog, rates);
    // 转换 SchemaComputeResult → HarnessResult 以保持接口一致
    return schemaResultToHarnessResult(schemaResult, input, rates, level);
  }

  // 标准硬编码模式 → 使用 Schema 引擎 (Level 2/3 共用同一代码, Level 2 走 materialCost fallback)
  return schemaResultToHarnessResult(
    computeHarnessCostBySchema(input, { name: 'default', version: '1.0', items: [] }, metalPrices, wireCatalog, rates),
    input,
    rates,
    level,
  );
}

/**
 * schemaResultToHarnessResult — 将 Schema 引擎结果映射回标准 HarnessResult
 */
function schemaResultToHarnessResult(
  sr: SchemaComputeResult,
  input: HarnessInput,
  rates: CostRates,
  level: 1 | 2 | 3
): HarnessResult {
  const materialCost = sr.items['material'] ?? 0;
  const wasteCost = sr.items['waste'] ?? 0;
  const directLabor = sr.items['directLabor'] ?? 0;
  const manufacturing = sr.items['manufacturing'] ?? 0;
  const mgmtFee = sr.items['mgmtFee'] ?? 0;
  const profit = sr.items['profit'] ?? 0;
  const packSubtotal = sr.items['packaging'] ?? 0;
  const freightSubtotal = sr.items['freight'] ?? 0;

  return {
    harnessId: sr.harnessId,
    harnessName: sr.harnessName,
    vehicleRatio: sr.vehicleRatio,
    copperWeight: sr.copperWeight,
    aluminumWeight: sr.aluminumWeight,
    processHours: sr.processHours,
    materialCost,
    wasteCost,
    directLabor,
    manufacturing,
    laborPlusMfg: directLabor + manufacturing,
    mgmtFee,
    profit,
    exFactoryPrice: sr.exFactoryPrice,
    packSubtotal,
    freightSubtotal,
    packTotal: packSubtotal + freightSubtotal,
    deliveredPrice: sr.deliveredPrice,
    materialBreakdown: sr.materialBreakdown ?? {
      cuCost: 0, alCost: 0, nonMetalCost: 0,
      byType: { wire: 0, connector: 0, terminal: 0, ipt_terminal: 0, bracket_rubber: 0, tape_tube: 0, other: materialCost },
      totalMetalCost: 0, totalNonWireCost: materialCost,
    },
    packagingDetail: input.packaging ?? { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: packSubtotal },
    freightDetail: input.freight ?? { freight: freightSubtotal, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: freightSubtotal },
    precisionLevel: level,
    _params: {
      wasteRate: rates.wasteRate,
      mgmtRate: rates.mgmtRate,
      profitRate: rates.profitRate,
      laborRate: rates.laborRate,
      mfgRate: rates.mfgRate,
    },
  };
}

/**
 * computeProjectFromHarnesses — 从线束号汇总到项目级
 */
export function computeProjectFromHarnesses(harnessResults: HarnessResult[]): ProjectHarnessResult {
  const harnesses = safeArray(harnessResults);

  // 汇总对象，包含原 JS 中的所有加权字段
  const summary: ProjectHarnessResult = {
    harnesses,
    vehicleCost: 0,
    weightedMaterial: 0,
    weightedWaste: 0,
    weightedLabor: 0,
    weightedMfg: 0,
    weightedLaborPlusMfg: 0,
    weightedMgmtFee: 0,
    weightedProfit: 0,
    weightedExFactory: 0,
    weightedPack: 0,
    weightedFreight: 0,
    weightedCopperWeight: 0,
    weightedAluminumWeight: 0,
    weightedProcessHours: 0,
    totalCopperWeight: 0,
    totalAluminumWeight: 0,
    totalProcessHours: 0,
    harnessCount: harnesses.length,
  };

  for (const h of harnesses) {
    const ratio = numberOr(h.vehicleRatio, 0);

    summary.vehicleCost += numberOr(h.deliveredPrice, 0) * ratio;
    summary.weightedMaterial += numberOr(h.materialCost, 0) * ratio;
    summary.weightedWaste += numberOr(h.wasteCost, 0) * ratio;
    summary.weightedLabor += numberOr(h.directLabor, 0) * ratio;
    summary.weightedMfg += numberOr(h.manufacturing, 0) * ratio;
    summary.weightedLaborPlusMfg += numberOr(h.laborPlusMfg, 0) * ratio;
    summary.weightedMgmtFee += numberOr(h.mgmtFee, 0) * ratio;
    summary.weightedProfit += numberOr(h.profit, 0) * ratio;
    summary.weightedExFactory += numberOr(h.exFactoryPrice, 0) * ratio;
    summary.weightedPack += numberOr(h.packSubtotal, 0) * ratio;
    summary.weightedFreight += numberOr(h.freightSubtotal, 0) * ratio;
    summary.weightedCopperWeight += numberOr(h.copperWeight, 0) * ratio;
    summary.weightedAluminumWeight += numberOr(h.aluminumWeight, 0) * ratio;
    summary.weightedProcessHours += numberOr(h.processHours, 0) * ratio;

    summary.totalCopperWeight += numberOr(h.copperWeight, 0);
    summary.totalAluminumWeight += numberOr(h.aluminumWeight, 0);
    summary.totalProcessHours += numberOr(h.processHours, 0);
  }

  return summary;
}

/**
 * buildInternalHarnessCostTable — 生成内部实绩成本分解表 (用于UI展示)
 * 按财务 6D MOH 口径拆分
 */
export function buildInternalHarnessCostTable(harnessResults: InternalHarnessResult[]) {
  const columns = [
    { key: 'harnessId', label: '零件号' },
    { key: 'harnessName', label: '名称' },
    { key: 'vehicleRatio', label: '装车比' },
    { key: 'materialCost', label: '材料成本', unit: '元' },
    { key: 'materialWaste', label: '材料损耗', unit: '元' },
    { key: 'directLabor', label: '直接人工', unit: '元' },
    { key: 'indirectLabor', label: '间接人工', unit: '元' },
    { key: 'lowValueConsumables', label: '低值易耗', unit: '元' },
    { key: 'materialConsumption', label: '机物料消耗', unit: '元' },
    { key: 'factoryAmortization', label: '厂房分摊', unit: '元' },
    { key: 'automationAmortization', label: '自动化分摊', unit: '元' },
    { key: 'otherOverhead', label: '其他制费', unit: '元' },
    { key: 'packTotal', label: '包装运输', unit: '元' },
    { key: 'internalCost', label: '实绩总成本', unit: '元' },
    { key: 'gapStatus', label: '状态' },
  ];

  const results = safeArray(harnessResults);
  const rows = results.map((h) => ({
    harnessId: h.harnessId,
    harnessName: h.harnessName,
    vehicleRatio: h.vehicleRatio,
    materialCost: h.materialCost,
    materialWaste: h.materialWaste,
    directLabor: h.directLabor,
    indirectLabor: h.indirectLabor,
    lowValueConsumables: h.lowValueConsumables,
    materialConsumption: h.materialConsumption,
    factoryAmortization: h.factoryAmortization,
    automationAmortization: h.automationAmortization,
    otherOverhead: h.otherOverhead,
    packTotal: h.packTotal,
    internalCost: h.internalCost,
    gapStatus: h.gapStatus,
  }));

  const project = computeInternalProjectFromHarnesses(results) as any;
  const totals = {
    harnessId: '加权合计',
    harnessName: '',
    vehicleRatio: '',
    materialCost: project.weightedMaterial,
    materialWaste: project.weightedMaterialWaste,
    directLabor: project.weightedDirectLabor,
    indirectLabor: project.weightedIndirectLabor,
    lowValueConsumables: project.weightedLowValueConsumables,
    materialConsumption: project.weightedMaterialConsumption,
    factoryAmortization: project.weightedFactoryAmortization,
    automationAmortization: project.weightedAutomationAmortization,
    otherOverhead: project.weightedOtherOverhead,
    packTotal: project.weightedPack,
    internalCost: project.vehicleCost,
    gapStatus: project.projectGapStatus,
  };

  return { columns, rows, totals };
}
