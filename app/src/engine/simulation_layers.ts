/**
 * B6: 仿真分层
 * 支持金属价格、费率、BOM用量、产量等多维度仿真叠加
 */

import type { CostRates, MetalPrices } from '@/types/project';
import type { HarnessResult } from '@/types/harness';

export interface SimulationLayer {
  id: string;
  name: string;
  type: 'metal_price' | 'cost_rate' | 'bom_qty' | 'volume' | 'custom';
  overrides: Record<string, number>;
  enabled: boolean;
  order: number;
}

export interface SimulationResult {
  baseline: HarnessResult;
  layered: HarnessResult;
  layerImpacts: Array<{
    layerId: string;
    layerName: string;
    costBefore: number;
    costAfter: number;
    impact: number;
    impactRate: number;
  }>;
  totalImpact: number;
  totalImpactRate: number;
}

export function applySimulationLayers(
  baseCostRates: CostRates,
  baseMetalPrices: MetalPrices,
  layers: SimulationLayer[]
): { costRates: CostRates; metalPrices: MetalPrices } {
  let costRates = { ...baseCostRates };
  let metalPrices = { ...baseMetalPrices };

  const activeLayers = layers
    .filter(l => l.enabled)
    .sort((a, b) => a.order - b.order);

  for (const layer of activeLayers) {
    for (const [key, value] of Object.entries(layer.overrides)) {
      if (key in costRates) {
        (costRates as any)[key] = value;
      }
      if (key in metalPrices) {
        (metalPrices as any)[key] = value;
      }
    }
  }

  return { costRates, metalPrices };
}

export const PRESET_LAYERS: SimulationLayer[] = [
  { id: 'metal-up-5', name: '铜价上涨5%', type: 'metal_price', overrides: {}, enabled: false, order: 1 },
  { id: 'metal-down-5', name: '铜价下跌5%', type: 'metal_price', overrides: {}, enabled: false, order: 2 },
  { id: 'labor-up-10', name: '人工费率上涨10%', type: 'cost_rate', overrides: {}, enabled: false, order: 3 },
];

export function generateLayerOverrides(
  layer: SimulationLayer,
  baseCostRates: CostRates,
  baseMetalPrices: MetalPrices
): Record<string, number> {
  switch (layer.id) {
    case 'metal-up-5':
      return { copper: baseMetalPrices.copper * 1.05, aluminum: baseMetalPrices.aluminum * 1.05 };
    case 'metal-down-5':
      return { copper: baseMetalPrices.copper * 0.95, aluminum: baseMetalPrices.aluminum * 0.95 };
    case 'labor-up-10':
      return { laborRate: baseCostRates.laborRate * 1.10 };
    default:
      return layer.overrides;
  }
}
