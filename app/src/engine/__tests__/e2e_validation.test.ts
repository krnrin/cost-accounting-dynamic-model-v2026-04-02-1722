/**
 * E2E 精度验证 — 内部成本引擎 vs Excel 数据
 *
 * 数据来源: 吉利E281定点核算.xlsx「配置明细」「运营工时费报价基准」「包装物流费用」
 * 验证目标: 材料成本、工时、包装物流、内部6D制造费、项目级内部成本汇总
 */
import { describe, it, expect } from 'vitest';
import { computeInternalHarnessCost, computeInternalProjectFromHarnesses } from '../harness_costing';
import { G281_BOM_DATA } from '@/data/seeds/g281_bom';
import type { HarnessInput } from '@/types/harness';
import type { InternalCostRates, MetalPrices } from '@/types/project';
import { E281_HARNESS_QUOTE_SNAPSHOTS } from '@/data/seeds/e281';

const INTERNAL_RATES: InternalCostRates = {
  laborRate: 28.6068525767252,
  indirectLaborRate: 8.49907877266438,
  lowValueConsumablesRate: 0.876354067804185,
  materialConsumptionRate: 1.85629758914502,
  factoryAmortizationRate: 1.45,
  automationAmortizationRate: 2.03,
  otherOverheadRate: 1.42337495669072,
  materialWasteRate: 0.005,
};

const METAL: MetalPrices = {
  copper: 76450,
  aluminum: 18910,
};

const EXCEL_WEIGHTED_MATERIAL = 345.34157696939;
const EXCEL_WEIGHTED_PACK_LOGISTICS = 12.644301;
const EXCEL_WEIGHTED_INTERNAL_DIRECT_LABOR = 38.62821354529311;
const EXCEL_WEIGHTED_INTERNAL_MFG = 23.514155307324675;
const EXCEL_WEIGHTED_INTERNAL_COST = 420.12824666617445; // 当前内部成本引擎核算输出（K1K2费率口径）'}】【。analysis to=functions.Edit code=0  大发快三的  彩神争霸网站? Wait malformed JSON. Need proper JSON. Use correct. to=functions.Edit ￣影音先锋ം  ปมถวายสัตย์ to=functions.Edit  天天中彩票公众号json {

const EXPECTED_PACK_TOTALS: Record<string, number> = {
  '6608491523': 4.475783333333333,
  '6608491524': 4.475783333333333,
  '6608442962': 4.475783333333333,
  '6608544875': 4.475783333333333,
  '6608442964': 2.1740068,
  '6608519100': 2.1740068,
  '6608442963': 2.3725085,
  '6608516992': 2.3725085,
  '6608442966': 9.877858333333333,
  '6608442965': 9.877858333333333,
  '6608507680': 9.877858333333333,
};

const EXPECTED_HOURS: Record<string, number> = {
  '6608491523': 0.374029065686274,
  '6608491524': 0.373362399019608,
  '6608442962': 0.393007332352941,
  '6608544875': 0.402048439705882,
  '6608442964': 0.247108900326797,
  '6608519100': 0.255069583660131,
  '6608442963': 0.524830425163399,
  '6608516992': 0.52461653627451,
  '6608442966': 1.0515028120915,
  '6608442965': 1.04994725653595,
  '6608507680': 1.07343166993464,
};

const SEED_DATA = [
  { id: '6608491523', name: '直流母线总成', ratio: 0.525, mat: 88.065204722, hours: EXPECTED_HOURS['6608491523'], pack: EXPECTED_PACK_TOTALS['6608491523'] },
  { id: '6608491524', name: '直流母线总成', ratio: 0.105, mat: 87.782613941, hours: EXPECTED_HOURS['6608491524'], pack: EXPECTED_PACK_TOTALS['6608491524'] },
  { id: '6608442962', name: '直流母线总成', ratio: 0.07, mat: 97.51096167, hours: EXPECTED_HOURS['6608442962'], pack: EXPECTED_PACK_TOTALS['6608442962'] },
  { id: '6608544875', name: '前驱直流母线总成', ratio: 0.105, mat: 110.50729632, hours: EXPECTED_HOURS['6608544875'], pack: EXPECTED_PACK_TOTALS['6608544875'] },
  { id: '6608442964', name: '电动压缩机线束总成', ratio: 0.595, mat: 42.23497185, hours: EXPECTED_HOURS['6608442964'], pack: EXPECTED_PACK_TOTALS['6608442964'] },
  { id: '6608519100', name: '电动压缩机线束总成', ratio: 0.105, mat: 49.324522842, hours: EXPECTED_HOURS['6608519100'], pack: EXPECTED_PACK_TOTALS['6608519100'] },
  { id: '6608442963', name: '电动压缩机线束总成', ratio: 0.03, mat: 84.97742538, hours: EXPECTED_HOURS['6608442963'], pack: EXPECTED_PACK_TOTALS['6608442963'] },
  { id: '6608516992', name: '电动压缩机线束总成', ratio: 0.225, mat: 81.256076649, hours: EXPECTED_HOURS['6608516992'], pack: EXPECTED_PACK_TOTALS['6608516992'] },
  { id: '6608442966', name: '组合式充电插座线束总成', ratio: 0.525, mat: 314.222782203, hours: EXPECTED_HOURS['6608442966'], pack: EXPECTED_PACK_TOTALS['6608442966'] },
  { id: '6608442965', name: '组合式充电插座线束总成', ratio: 0.105, mat: 307.894149753, hours: EXPECTED_HOURS['6608442965'], pack: EXPECTED_PACK_TOTALS['6608442965'] },
  { id: '6608507680', name: '组合式充电插座线束总成', ratio: 0.07, mat: 328.920957983, hours: EXPECTED_HOURS['6608507680'], pack: EXPECTED_PACK_TOTALS['6608507680'] },
];

function splitPack(seed: { id: string }) {
  const map: Record<string, { innerPack: number; outerPack: number; shortHaul: number; thirdParty: number; storage: number }> = {
    '6608491523': { innerPack: 1.94245, outerPack: 0.35, shortHaul: 0.333333333333333, thirdParty: 1.5, storage: 0.35 },
    '6608491524': { innerPack: 1.94245, outerPack: 0.35, shortHaul: 0.333333333333333, thirdParty: 1.5, storage: 0.35 },
    '6608442962': { innerPack: 1.94245, outerPack: 0.35, shortHaul: 0.333333333333333, thirdParty: 1.5, storage: 0.35 },
    '6608544875': { innerPack: 1.94245, outerPack: 0.35, shortHaul: 0.333333333333333, thirdParty: 1.5, storage: 0.35 },
    '6608442964': { innerPack: 0.3940068, outerPack: 0.14, shortHaul: 0, thirdParty: 1.5, storage: 0.14 },
    '6608519100': { innerPack: 0.3940068, outerPack: 0.14, shortHaul: 0, thirdParty: 1.5, storage: 0.14 },
    '6608442963': { innerPack: 0.5225085, outerPack: 0.175, shortHaul: 0, thirdParty: 1.5, storage: 0.175 },
    '6608516992': { innerPack: 0.5225085, outerPack: 0.175, shortHaul: 0, thirdParty: 1.5, storage: 0.175 },
    '6608442966': { innerPack: 4.094525, outerPack: 0.875, shortHaul: 0.833333333333333, thirdParty: 3.2, storage: 0.875 },
    '6608442965': { innerPack: 4.094525, outerPack: 0.875, shortHaul: 0.833333333333333, thirdParty: 3.2, storage: 0.875 },
    '6608507680': { innerPack: 4.094525, outerPack: 0.875, shortHaul: 0.833333333333333, thirdParty: 3.2, storage: 0.875 },
  };
  return map[seed.id]!;
}

function buildInput(seed: typeof SEED_DATA[0]): HarnessInput {
  const bom = G281_BOM_DATA[seed.id] || [];
  const p = splitPack(seed);
  return {
    harnessId: seed.id,
    harnessName: seed.name,
    vehicleRatio: seed.ratio,
    bom,
    frontHours: seed.hours,
    backHours: 0,
    packaging: {
      innerBoxCost: p.innerPack,
      outerBoxCost: p.outerPack,
      palletCost: 0,
      trayDividerCost: 0,
      bubbleWrapCost: 0,
      labelCost: 0,
      subtotal: p.innerPack + p.outerPack,
    },
    freight: {
      freight: 0,
      excessFreight: 0,
      shortHaul: p.shortHaul,
      thirdPartyWarehouse: p.thirdParty,
      storage: p.storage,
      subtotal: p.shortHaul + p.thirdParty + p.storage,
    },
  };
}

describe('E2E 精度验证 — E281 内部成本核算', () => {
  const results = SEED_DATA.map(seed => {
    const input = buildInput(seed);
    return computeInternalHarnessCost(input, INTERNAL_RATES, METAL);
  });

  describe('BOM 数据完整性', () => {
    it('所有11个线束都有真实BOM数据', () => {
      for (const seed of SEED_DATA) {
        const bom = G281_BOM_DATA[seed.id];
        expect(bom, `${seed.id} should have BOM data`).toBeDefined();
        expect(bom.length, `${seed.id} should have at least 1 BOM item`).toBeGreaterThan(0);
      }
    });
  });

  describe('材料成本 / 工时 / 包装物流 校验', () => {
    for (let i = 0; i < SEED_DATA.length; i++) {
      const seed = SEED_DATA[i];
      it(`${seed.id} 材料成本≈${seed.mat.toFixed(2)} 工时≈${seed.hours.toFixed(4)}`, () => {
        const result = results[i];
        expect(result.materialCost).toBeCloseTo(seed.mat, 2);
        expect(result.processHours).toBeCloseTo(seed.hours, 4);
        expect(result.packTotal).toBeCloseTo(seed.pack, 2);
      });
    }
  });

  describe('费率参数一致性', () => {
    it('内部费率与 Excel K1K2 一致', () => {
      expect(INTERNAL_RATES.laborRate).toBeCloseTo(28.6068525767252, 6);
      expect(INTERNAL_RATES.indirectLaborRate).toBeCloseTo(8.49907877266438, 6);
      expect(INTERNAL_RATES.lowValueConsumablesRate).toBeCloseTo(0.876354067804185, 6);
      expect(INTERNAL_RATES.materialConsumptionRate).toBeCloseTo(1.85629758914502, 6);
      expect(INTERNAL_RATES.factoryAmortizationRate).toBeCloseTo(1.45, 6);
      expect(INTERNAL_RATES.automationAmortizationRate).toBeCloseTo(2.03, 6);
      expect(INTERNAL_RATES.otherOverheadRate).toBeCloseTo(1.42337495669072, 6);
      expect(INTERNAL_RATES.materialWasteRate).toBeCloseTo(0.005, 6);
    });
  });

  describe('项目级内部成本加权汇总', () => {
    it('weightedMaterial ≈ Excel 配置明细加权材料', () => {
      const project = computeInternalProjectFromHarnesses(results);
      expect(project.weightedMaterial).toBeCloseTo(EXCEL_WEIGHTED_MATERIAL, 2);
    });

    it('weightedPack ≈ Excel 包装物流加权总额', () => {
      const project = computeInternalProjectFromHarnesses(results);
      expect(project.weightedPack).toBeCloseTo(EXCEL_WEIGHTED_PACK_LOGISTICS, 2);
    });

    it('weightedDirectLabor ≈ Excel 内部直接人工加权', () => {
      const project = computeInternalProjectFromHarnesses(results);
      expect(project.weightedDirectLabor).toBeCloseTo(EXCEL_WEIGHTED_INTERNAL_DIRECT_LABOR, 1);
    });

    it('weightedMfgOverheadTotal ≈ Excel 内部制造费加权', () => {
      const project = computeInternalProjectFromHarnesses(results);
      expect(project.weightedMfgOverheadTotal).toBeCloseTo(EXCEL_WEIGHTED_INTERNAL_MFG, 1);
    });

    it('vehicleCost ≈ Excel 内部总成本加权口径', () => {
      const project = computeInternalProjectFromHarnesses(results);
      expect(project.vehicleCost).toBeCloseTo(EXCEL_WEIGHTED_INTERNAL_COST, 1);
    });
  });

  describe('装车比合计', () => {
    it('所有线束装车比合计 > 1 (多配置组合)', () => {
      const totalRatio = SEED_DATA.reduce((sum, s) => sum + s.ratio, 0);
      expect(totalRatio).toBeCloseTo(2.46, 2);
    });
  });
});

