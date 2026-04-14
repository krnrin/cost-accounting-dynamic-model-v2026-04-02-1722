/**
 * app/src/hooks/useGapAnalysis.ts
 * Gap 分析 React Hook
 *
 * 桥接 gap_analysis 引擎与 pricingStore，支持：
 * - 实绩侧金属价格源切换后自动重算
 * - 单线束 / 项目级 Gap 分析
 * - 过期提醒
 */

import { useMemo, useCallback, useState } from 'react';
import { computeGapAnalysis, buildDualMetalPrices, createGapAlignedSnapshot } from '@/engine/gap_analysis';
import type { HarnessResult, InternalHarnessResult, BomItem, WireItem } from '@/types/harness';
import type {
  GapAnalysis,
  GapAlignedSnapshot,
  ProjectGapSummary,
  DualMetalPrices,
  InternalMetalSource,
  InternalMetalConfig,
} from '@/types/gap_analysis';
import type { ManualPriceData, StalenessCheck } from '@/engine/manual_price_provider';
import { ManualPriceProvider } from '@/engine/manual_price_provider';

// ══════════════════════════════════════════════════
// 类型
// ══════════════════════════════════════════════════

export interface UseGapAnalysisInput {
  /** 客户口径铜价 (销售输入) */
  customerCopperPrice: number;
  /** 客户口径铝价 (销售输入) */
  customerAluminumPrice: number;
  /** 内部金属价格配置 */
  internalMetalConfig: InternalMetalConfig;
  /** 报价结果 (单线束或数组) */
  quoteResults: HarnessResult[];
  /** 实绩结果 (单线束或数组) */
  internalResults: InternalHarnessResult[];
}

export interface UseGapAnalysisReturn {
  /** 当前生效的双金属价格 */
  dualMetalPrices: DualMetalPrices;
  /** 各线束的 Gap 分析 */
  harnessGaps: Array<{
    harnessId: string;
    harnessName: string;
    gap: GapAnalysis;
  }>;
  /** 项目级 Gap 汇总 */
  projectSummary: ProjectGapSummary | null;
  /** 切换内部价格源 */
  switchSource: (source: InternalMetalSource) => void;
  /** 当前选中的源 */
  activeSource: InternalMetalSource;
  /** 更新手动录入价格 */
  updateManualPrices: (data: ManualPriceData) => void;
  /** 过期检测 */
  stalenessCheck: StalenessCheck | null;
  /** 创建 Gap 快照 (用于持久化) */
  createSnapshots: (params: {
    scenarioId: string;
    projectId: string;
    trigger: GapAlignedSnapshot['trigger'];
    bom: (BomItem | WireItem)[];
    processHours: number;
    factoryId: string;
  }) => GapAlignedSnapshot[];
}

// ══════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════

export function useGapAnalysis(input?: UseGapAnalysisInput): UseGapAnalysisReturn {
  const {
    customerCopperPrice = 0,
    customerAluminumPrice = 0,
    internalMetalConfig = {
      activeSource: 'benchmark' as const,
      sources: {
        benchmark: { copper: 70000, aluminum: 20000, label: '财务基准' },
        spot: { copper: 70000, aluminum: 20000, label: '现货' },
      },
    },
    quoteResults = [],
    internalResults = [],
  } = input || {};

  // 内部状态: 手动录入 Provider
  const [manualProvider] = useState(() => new ManualPriceProvider(48));
  const [activeSource, setActiveSource] = useState<InternalMetalSource>(
    internalMetalConfig.activeSource
  );

  // 获取当前实绩侧金属价格
  const internalPrices = useMemo(() => {
    if (activeSource === 'benchmark') {
      return {
        copper: internalMetalConfig.sources.benchmark.copper,
        aluminum: internalMetalConfig.sources.benchmark.aluminum,
        label: '财务基准',
      };
    }
    // spot / manual 都使用 spot 数据
    return {
      copper: internalMetalConfig.sources.spot.copper,
      aluminum: internalMetalConfig.sources.spot.aluminum,
      label: activeSource === 'spot_shfe' ? '上期所现货'
           : activeSource === 'spot_smm' ? 'SMM现货'
           : '手动录入',
    };
  }, [activeSource, internalMetalConfig]);

  // 构建双金属价格
  const dualMetalPrices = useMemo(() => {
    return buildDualMetalPrices(
      customerCopperPrice,
      customerAluminumPrice,
      internalPrices.copper,
      internalPrices.aluminum,
      activeSource,
      internalPrices.label
    );
  }, [customerCopperPrice, customerAluminumPrice, internalPrices, activeSource]);

  // 计算各线束 Gap
  const harnessGaps = useMemo(() => {
    const pairs = Math.min(quoteResults.length, internalResults.length);
    const gaps: UseGapAnalysisReturn['harnessGaps'] = [];

    for (let i = 0; i < pairs; i++) {
      const quote = quoteResults[i];
      const internal = internalResults[i];
      if (quote && internal) {
        gaps.push({
          harnessId: quote.harnessId,
          harnessName: quote.harnessName,
          gap: computeGapAnalysis(quote, internal, dualMetalPrices),
        });
      }
    }
    return gaps;
  }, [quoteResults, internalResults, dualMetalPrices]);

  // 过期检测
  const stalenessCheck = useMemo(() => {
    if (activeSource === 'benchmark') return null;
    return manualProvider.checkStaleness();
  }, [activeSource, manualProvider]);

  // 项目级汇总 (当有快照时计算)
  const projectSummary = useMemo<ProjectGapSummary | null>(() => {
    // 暂不在 hook 层直接汇总，需要快照数据
    // 由外部调用 createSnapshots 后再通过 computeProjectGapSummary 计算
    return null;
  }, []);

  // 切换源
  const switchSource = useCallback((source: InternalMetalSource) => {
    setActiveSource(source);
  }, []);

  // 更新手动价格
  const updateManualPrices = useCallback((data: ManualPriceData) => {
    manualProvider.setManualPrices(data);
  }, [manualProvider]);

  // 创建快照
  const createSnapshots = useCallback((params: {
    scenarioId: string;
    projectId: string;
    trigger: GapAlignedSnapshot['trigger'];
    bom: (BomItem | WireItem)[];
    processHours: number;
    factoryId: string;
  }) => {
    const snapshots: GapAlignedSnapshot[] = [];
    const pairs = Math.min(quoteResults.length, internalResults.length);

    for (let i = 0; i < pairs; i++) {
      const quote = quoteResults[i];
      const internal = internalResults[i];
      if (!quote || !internal) continue;

      const snapshot = createGapAlignedSnapshot({
        scenarioId: params.scenarioId,
        projectId: params.projectId,
        trigger: params.trigger,
        sharedBom: {
          bom: params.bom,
          processHours: params.processHours,
        },
        metalPrices: dualMetalPrices,
        quote: {
          rates: quote._params || {
            wasteRate: 0.01,
            mgmtRate: 0.06,
            profitRate: 0.0566,
            laborRate: 35,
            mfgRate: 46.69,
          },
          result: quote,
        },
        internal: {
          factoryId: params.factoryId,
          rates: {
            assemblyLaborRate: 28.58,
            scrapRate: 0.005,
            mohComponents: {},
          },
          result: internal,
        },
      });

      snapshots.push(snapshot);
    }

    return snapshots;
  }, [quoteResults, internalResults, dualMetalPrices]);

  return {
    dualMetalPrices,
    harnessGaps,
    projectSummary,
    switchSource,
    activeSource,
    updateManualPrices,
    stalenessCheck,
    createSnapshots,
  };
}
