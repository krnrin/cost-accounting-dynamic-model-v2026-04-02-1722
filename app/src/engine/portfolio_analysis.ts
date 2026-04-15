/**
 * 多项目组合分析引擎
 * 
 * 分析多个项目的整体财务表现、各项目贡献度、和金属价格风险敞口。
 */

import { computeInternalHarnessCost, computeInternalProjectFromHarnesses, INTERNAL_DEFAULTS } from './harness_costing';
import type { HarnessInput, ProjectHarnessResult } from '../types/harness';
import type { CostRates, MetalPrices } from '../types/project';

/** A single project's summary data for portfolio analysis */
export interface ProjectSummaryInput {
  projectId: string;
  projectName: string;
  customer: string;
  /** Annual production volume */
  annualVolume: number;
  /** Computed project results */
  projectResult: ProjectHarnessResult;
  /** Harness inputs (needed for sensitivity analysis) */
  harnessInputs: HarnessInput[];
  /** Cost rates used */
  costRates: CostRates;
  /** Metal prices used */
  metalPrices: MetalPrices;
}

/** Portfolio-level summary */
export interface PortfolioSummary {
  /** Total number of projects */
  projectCount: number;
  /** Total annual revenue (sum of vehicleCost × annualVolume across projects) */
  totalRevenue: number;
  /** Total annual profit (sum of weightedProfit × annualVolume) */
  totalProfit: number;
  /** Weighted average profit rate across all projects */
  weightedProfitRate: number;
  /** Weighted average material ratio across all projects */
  weightedMaterialRatio: number;
  /** Revenue breakdown by customer */
  customerBreakdown: Record<string, { revenue: number; share: number }>;
  /** Total material cost across all projects */
  totalMaterialCost: number;
  /** Total copper cost across all projects */
  totalCopperCost: number;
  /** Total aluminum cost across all projects */
  totalAluminumCost: number;
}

/** Per-project contribution to portfolio */
export interface ProjectContribution {
  projectId: string;
  projectName: string;
  customer: string;
  /** Annual revenue for this project */
  revenue: number;
  /** Revenue share of portfolio (0-1) */
  revenueShare: number;
  /** Annual profit for this project */
  profit: number;
  /** Profit share of portfolio (0-1) */
  profitShare: number;
  /** Marginal contribution = revenue - variable costs (material + labor + mfg) */
  marginalContribution: number;
  /** Marginal contribution ratio */
  marginalContributionRate: number;
  /** Material ratio for this project */
  materialRatio: number;
  /** Profit rate for this project */
  profitRate: number;
}

/** Risk exposure analysis for metal price changes */
export interface RiskExposure {
  /** Scenario description */
  scenario: string;
  /** Price change percentage (e.g., 0.10 for +10%) */
  priceChangePercent: number;
  /** Per-project impact */
  projectImpacts: {
    projectId: string;
    projectName: string;
    /** Original annual profit */
    originalProfit: number;
    /** New annual profit after price change */
    newProfit: number;
    /** Profit change */
    profitDelta: number;
    /** Profit change as % of original profit */
    profitImpactPercent: number;
  }[];
  /** Total portfolio profit change */
  totalProfitDelta: number;
  /** Total portfolio profit change as % */
  totalProfitImpactPercent: number;
}

/**
 * Compute portfolio summary across multiple projects.
 */
export function computePortfolioSummary(projects: ProjectSummaryInput[]): PortfolioSummary {
  if (projects.length === 0) {
    return {
      projectCount: 0, totalRevenue: 0, totalProfit: 0,
      weightedProfitRate: 0, weightedMaterialRatio: 0,
      customerBreakdown: {}, totalMaterialCost: 0,
      totalCopperCost: 0, totalAluminumCost: 0,
    };
  }
  
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalMaterialCost = 0;
  let totalCopperCost = 0;
  let totalAluminumCost = 0;
  const customerMap: Record<string, number> = {};
  
  for (const p of projects) {
    const revenue = p.projectResult.vehicleCost * p.annualVolume;
    const profit = p.projectResult.weightedProfit * p.annualVolume;
    const materialCost = p.projectResult.weightedMaterial * p.annualVolume;
    
    totalRevenue += revenue;
    totalProfit += profit;
    totalMaterialCost += materialCost;
    
    // Sum copper/aluminum costs across all harnesses
    for (const h of p.projectResult.harnesses) {
      const ratio = h.vehicleRatio * p.annualVolume;
      totalCopperCost += (h.materialBreakdown?.cuCost || 0) * ratio;
      totalAluminumCost += (h.materialBreakdown?.alCost || 0) * ratio;
    }
    
    const customer = p.customer || '未知';
    customerMap[customer] = (customerMap[customer] || 0) + revenue;
  }
  
  const customerBreakdown: Record<string, { revenue: number; share: number }> = {};
  for (const [customer, revenue] of Object.entries(customerMap)) {
    customerBreakdown[customer] = {
      revenue,
      share: totalRevenue > 0 ? revenue / totalRevenue : 0,
    };
  }
  
  return {
    projectCount: projects.length,
    totalRevenue,
    totalProfit,
    weightedProfitRate: totalRevenue > 0 ? totalProfit / totalRevenue : 0,
    weightedMaterialRatio: totalRevenue > 0 ? totalMaterialCost / totalRevenue : 0,
    customerBreakdown,
    totalMaterialCost,
    totalCopperCost,
    totalAluminumCost,
  };
}

/**
 * Compute each project's contribution to the portfolio.
 */
export function computeProjectContribution(projects: ProjectSummaryInput[]): ProjectContribution[] {
  const summary = computePortfolioSummary(projects);
  
  return projects.map(p => {
    const revenue = p.projectResult.vehicleCost * p.annualVolume;
    const profit = p.projectResult.weightedProfit * p.annualVolume;
    const variableCost = (p.projectResult.weightedMaterial + p.projectResult.weightedLaborPlusMfg) * p.annualVolume;
    const marginalContribution = revenue - variableCost;
    
    return {
      projectId: p.projectId,
      projectName: p.projectName,
      customer: p.customer,
      revenue,
      revenueShare: summary.totalRevenue > 0 ? revenue / summary.totalRevenue : 0,
      profit,
      profitShare: summary.totalProfit > 0 ? profit / summary.totalProfit : 0,
      marginalContribution,
      marginalContributionRate: revenue > 0 ? marginalContribution / revenue : 0,
      materialRatio: p.projectResult.vehicleCost > 0
        ? p.projectResult.weightedMaterial / p.projectResult.vehicleCost : 0,
      profitRate: p.projectResult.vehicleCost > 0
        ? p.projectResult.weightedProfit / p.projectResult.vehicleCost : 0,
    };
  });
}

/**
 * Analyze risk exposure to metal price changes.
 * Recomputes each project with adjusted metal prices and measures profit impact.
 */
export function analyzeRiskExposure(
  projects: ProjectSummaryInput[],
  metalType: 'copper' | 'aluminum',
  priceChangePercent: number = 0.10
): RiskExposure {
  const scenario = `${metalType === 'copper' ? '铜' : '铝'}价 ${priceChangePercent > 0 ? '+' : ''}${(priceChangePercent * 100).toFixed(0)}%`;
  
  let totalOriginalProfit = 0;
  let totalNewProfit = 0;
  
  const projectImpacts = projects.map(p => {
    const originalProfit = p.projectResult.weightedProfit * p.annualVolume;
    totalOriginalProfit += originalProfit;
    
    // Baseline cost at original metal prices
    const baseResults = p.harnessInputs.map(input =>
      computeInternalHarnessCost(input, (p as any).internalRates ?? INTERNAL_DEFAULTS, p.metalPrices)
    );
    const baseProjectResult = computeInternalProjectFromHarnesses(baseResults);
    const baseCost = baseProjectResult.vehicleCost;

    // Recompute with adjusted metal prices
    const newMetalPrices: MetalPrices = {
      ...p.metalPrices,
      [metalType]: p.metalPrices[metalType] * (1 + priceChangePercent),
    };
    
    const newResults = p.harnessInputs.map(input =>
      computeInternalHarnessCost(input, (p as any).internalRates ?? INTERNAL_DEFAULTS, newMetalPrices)
    );
    const newProjectResult = computeInternalProjectFromHarnesses(newResults);
    const newCost = newProjectResult.vehicleCost;
    
    // Profit impact assumes selling price is fixed
    const profitDelta = (baseCost - newCost) * p.annualVolume;
    const newProfit = originalProfit + profitDelta;
    totalNewProfit += newProfit;
    
    return {
      projectId: p.projectId,
      projectName: p.projectName,
      originalProfit,
      newProfit,
      profitDelta,
      profitImpactPercent: originalProfit !== 0 ? profitDelta / Math.abs(originalProfit) : 0,
    };
  });
  
  return {
    scenario,
    priceChangePercent,
    projectImpacts,
    totalProfitDelta: totalNewProfit - totalOriginalProfit,
    totalProfitImpactPercent: totalOriginalProfit !== 0
      ? (totalNewProfit - totalOriginalProfit) / Math.abs(totalOriginalProfit) : 0,
  };
}
