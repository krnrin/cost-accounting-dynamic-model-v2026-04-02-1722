/**
 * Custom hook: all Dashboard state, data-loading, and derived computations.
 * Extracted from DashboardPage.tsx to reduce the 57 KB monolith.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Toast } from '@douyinfe/semi-ui';
import { db } from '@/data/db';
import { applyE281ScenarioFallback } from '@/data/e281Fallback';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import {
  computeHarnessCost,
  computeProjectFromHarnesses,
  computeInternalHarnessCost,
  computeInternalProjectFromHarnesses,
  INTERNAL_DEFAULTS,
  DEFAULTS,
} from '@/engine/harness_costing';
import type {
  HarnessResult,
  ProjectHarnessResult,
  InternalHarnessResult,
  InternalProjectResult,
} from '@/types/harness';
import { applyCustomerQuoteSnapshot } from '@/utils/customerQuoteSnapshots';
import { useProjectStore } from '@/store/projectStore';
import { useAllocStore } from '@/store/allocStore';

/* ------------------------------------------------------------------ */
/*  Exported helper types                                              */
/* ------------------------------------------------------------------ */

export interface EffectiveHarnessItem {
  harness: HarnessResult;
  effectiveDeliveredPrice: number;
  activeAllocPerUnit: number;
}

export interface LifecyclePnLRow {
  year: number;
  volume: number;
  revenue: number;
  cost: number;
  allocRecovery: number;
  rebateAmount: number;
  grossProfit: number;
  netProfit: number;
  netMargin: number;
}

export interface LifecyclePnLData {
  rows: LifecyclePnLRow[];
  unitRevenue: number;
  unitCost: number;
  allocUnit: number;
  total: {
    volume: number;
    revenue: number;
    cost: number;
    allocRecovery: number;
    rebateAmount: number;
    grossProfit: number;
    netProfit: number;
    netMargin: number;
  };
  rebateLabel: string;
  hasRebate: boolean;
}

export interface HarnessTableRow {
  key: string;
  harnessId: string;
  name: string;
  ratio: number;
  delivered: number;
  material: number;
  directLabor: number;
  mfgTotal: number;
  indirectLabor: number;
  lowValue: number;
  matConsumption: number;
  factoryAmort: number;
  autoAmort: number;
  otherOH: number;
  materialWaste: number;
  packTotal: number;
  internalCost: number;
  allocPerUnit: number;
  netProfit: number;
  margin: number;
  vehicleContrib: number;
  tags: string[];
  matRatio: number;
  laborRatio: number;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDashboardData() {
  const { id, sid } = useParams<{ id: string; sid: string }>();

  // ---- local state -------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<ProjectHarnessResult | null>(null);
  const [internalProject, setInternalProject] = useState<InternalProjectResult | null>(null);
  const [internalHarnesses, setInternalHarnesses] = useState<InternalHarnessResult[]>([]);
  const [mode, setMode] = useState<'customer' | 'internal'>('internal');
  const [showMultiImport, setShowMultiImport] = useState(false);
  const [showMohDetail, setShowMohDetail] = useState(false);

  // ---- stores ------------------------------------------------------
  const { setCurrentProject, setCurrentScenario } = useProjectStore();
  const {
    allocSummary,
    recoverySummary,
    loadProjectAlloc,
    loadScenarioAlloc,
  } = useAllocStore();

  // ---- data loading ------------------------------------------------
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await db.projects.get(id);
      if (!p) return;
      setProject(p);
      setCurrentProject(p.id, p.meta?.projectName || p.id);

      const rawScenario = sid ? await db.scenarios.get(sid) : null;
      const sc = rawScenario ? applyE281ScenarioFallback(rawScenario) : null;
      setScenario(sc ?? null);
      if (sc) setCurrentScenario(sc.id, sc.scenarioName);

      const hRecords = sid
        ? await db.harnesses.where('scenarioId').equals(sid).toArray()
        : await db.harnesses.where('projectId').equals(id).toArray();

      // FIX #22: use optional chaining with safe defaults instead of sc! non-null assertion
      const rates = sc?.config?.costRates ?? DEFAULTS;
      const metalPrices = sc?.config?.metalPrices ?? { copper: 68400, aluminum: 18200 };
      const internalRates = sc?.config?.internalRates ?? INTERNAL_DEFAULTS;
      const customerQuoteSnapshots = sc?.config?.customerQuoteSnapshots;

      // customer quote per harness
      const harnessResults: HarnessResult[] = hRecords.map((rec) =>
        applyCustomerQuoteSnapshot(
          computeHarnessCost(rec.input, rates, metalPrices),
          customerQuoteSnapshots?.[rec.harnessId],
        ),
      );
      const projectResult = computeProjectFromHarnesses(harnessResults);
      setHarnesses(projectResult);

      // internal cost per harness
      const internalResults: InternalHarnessResult[] = hRecords.map((rec) =>
        computeInternalHarnessCost(rec.input, internalRates, metalPrices),
      );
      const intProjResult = computeInternalProjectFromHarnesses(internalResults);
      setInternalProject(intProjResult);
      setInternalHarnesses(intProjResult.harnesses);

      // allocation data
      if (sid) await loadScenarioAlloc(sid);
      else await loadProjectAlloc(id);
    } catch (err) {
      console.error('Dashboard loadData error:', err);
      Toast.error(
        '\u52A0\u8F7D\u9879\u76EE\u5931\u8D25: ' + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setLoading(false);
    }
  }, [id, sid, setCurrentProject, setCurrentScenario, loadProjectAlloc, loadScenarioAlloc]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- aliases ------------------------------------------------------
  const summary = harnesses;
  const internalSummary = internalProject;
  const snapshotCustomerVehicleCost = summary?.vehicleCost || 0;

  // ---- allocation look-ups -----------------------------------------
  const allocTrackerByHarnessId = useMemo(
    () =>
      new Map(
        (recoverySummary?.trackers || []).map((t: any) => [t.harnessId, t]),
      ),
    [recoverySummary],
  );

  const allocByHarnessId = useMemo(
    () =>
      new Map(
        (allocSummary?.allocations || []).map((a: any) => [a.harnessId, a]),
      ),
    [allocSummary],
  );

  // ---- effective customer harnesses --------------------------------
  const effectiveCustomerHarnesses: EffectiveHarnessItem[] = useMemo(() => {
    return (summary?.harnesses || []).map((harness) => {
      const tracker = allocTrackerByHarnessId.get(harness.harnessId);
      const allocation = allocByHarnessId.get(harness.harnessId);
      const activeAllocPerUnit = tracker?.fullyRecovered
        ? 0
        : allocation?.totalPerUnit || 0;
      const effectiveDeliveredPrice = tracker?.fullyRecovered
        ? harness.exFactoryPrice
        : harness.deliveredPrice;
      return { harness, effectiveDeliveredPrice, activeAllocPerUnit };
    });
  }, [summary, allocByHarnessId, allocTrackerByHarnessId]);

  // ---- derived KPI values ------------------------------------------
  const customerVehicleCost = effectiveCustomerHarnesses.reduce(
    (sum, item) =>
      sum + item.effectiveDeliveredPrice * item.harness.vehicleRatio,
    0,
  );
  const internalVehicleCost = internalSummary?.vehicleCost || 0;

  const grossMargin =
    customerVehicleCost > 0
      ? ((customerVehicleCost - internalVehicleCost) / customerVehicleCost) * 100
      : 0;

  const allocPerVehicle = effectiveCustomerHarnesses.reduce(
    (sum, item) =>
      sum + item.activeAllocPerUnit * item.harness.vehicleRatio,
    0,
  );

  const vehicleCost =
    mode === 'internal' ? internalVehicleCost : customerVehicleCost;
  const harnessCount = summary?.harnessCount || 0;
  const totalHours = summary?.totalProcessHours || 0;

  // ---- lifecycle P&L -----------------------------------------------
  const lifecyclePnL: LifecyclePnLData | null = useMemo(() => {
    if (!project || !scenario || !summary || !internalProject) return null;
    const volumes = (scenario.config.volumes || []).map((v: any) => v.volume);
    const years = volumes.length;
    if (!years) return null;

    const unitRevenue = customerVehicleCost;
    const unitCost = internalProject.vehicleCost;
    const rebate = scenario.config.rebate;
    const allocUnit = allocPerVehicle;

    const rows: LifecyclePnLRow[] = [];
    let totalRevenue = 0;
    let totalCost = 0;
    let totalAlloc = 0;
    let totalRebate = 0;

    for (let i = 0; i < years; i++) {
      const vol = volumes[i] || 0;
      const rev = unitRevenue * vol;
      const cost = unitCost * vol;
      const alloc = allocUnit * vol;
      const reb = rebate?.yearDistribution?.[i] || 0;
      const gross = rev - cost;
      const net = gross - reb - alloc;
      const margin = rev > 0 ? (net / rev) * 100 : 0;
      totalRevenue += rev;
      totalCost += cost;
      totalAlloc += alloc;
      totalRebate += reb;
      rows.push({
        year: i + 1,
        volume: vol,
        revenue: rev,
        cost,
        allocRecovery: alloc,
        rebateAmount: reb,
        grossProfit: gross,
        netProfit: net,
        netMargin: margin,
      });
    }

    const totalGross = totalRevenue - totalCost;
    const totalNet = totalGross - totalRebate - totalAlloc;
    const totalMargin =
      totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;
    const totalVolume = volumes.reduce((s: number, v: number) => s + v, 0);

    return {
      rows,
      unitRevenue,
      unitCost,
      allocUnit,
      total: {
        volume: totalVolume,
        revenue: totalRevenue,
        cost: totalCost,
        allocRecovery: totalAlloc,
        rebateAmount: totalRebate,
        grossProfit: totalGross,
        netProfit: totalNet,
        netMargin: totalMargin,
      },
      rebateLabel: rebate?.label || '\u8FD4\u70B9',
      hasRebate: (rebate?.totalAmount || 0) > 0,
    };
    // FIX #26: added recoverySummary, customerVehicleCost, allocPerVehicle to deps
  }, [project, scenario, summary, internalProject, allocSummary, recoverySummary, customerVehicleCost, allocPerVehicle]);

  // ---- harness profit table rows -----------------------------------
  const harnessTableData: HarnessTableRow[] = useMemo(() => {
    return (summary?.harnesses || []).map((h, i) => {
      const ih = internalHarnesses.find((x) => x.harnessId === h.harnessId);
      const allocItem = allocByHarnessId.get(h.harnessId);
      const tracker = allocTrackerByHarnessId.get(h.harnessId);
      const apu = tracker?.fullyRecovered
        ? 0
        : allocItem?.totalPerUnit || 0;
      const edp = tracker?.fullyRecovered
        ? h.exFactoryPrice
        : h.deliveredPrice;
      const intCost = ih?.internalCost || 0;
      const np = edp - intCost;
      const mg = edp > 0 ? (np / edp) * 100 : 0;
      const vc = np * h.vehicleRatio;

      const matR = intCost > 0 ? (ih?.materialCost || 0) / intCost : 0;
      const labR = intCost > 0 ? (ih?.directLabor || 0) / intCost : 0;
      const fixR =
        intCost > 0
          ? ((ih?.factoryAmortization || 0) +
              (ih?.automationAmortization || 0)) /
            intCost
          : 0;

      const tags: string[] = [];
      if (matR > 0.7) tags.push('\u6750\u6599\u654F\u611F');
      if (labR > 0.2) tags.push('\u5DE5\u65F6\u504F\u9AD8');
      if (fixR > 0.15) tags.push('\u56FA\u5B9A\u6210\u672C\u91CD');
      if (np < 0) tags.push('\u4E8F\u635F');

      return {
        key: String(i),
        harnessId: h.harnessId,
        name: h.harnessName,
        ratio: h.vehicleRatio,
        delivered: edp,
        material: ih?.materialCost || 0,
        directLabor: ih?.directLabor || 0,
        mfgTotal: ih?.mfgOverheadTotal || 0,
        indirectLabor: ih?.indirectLabor || 0,
        lowValue: ih?.lowValueConsumables || 0,
        matConsumption: ih?.materialConsumption || 0,
        factoryAmort: ih?.factoryAmortization || 0,
        autoAmort: ih?.automationAmortization || 0,
        otherOH: ih?.otherOverhead || 0,
        materialWaste: ih?.materialWaste || 0,
        packTotal: ih?.packTotal || 0,
        internalCost: intCost,
        allocPerUnit: apu,
        netProfit: np,
        margin: mg,
        vehicleContrib: vc,
        tags,
        matRatio: matR,
        laborRatio: labR,
      };
    });
  }, [summary, internalHarnesses, allocByHarnessId, allocTrackerByHarnessId]);

  // ---- allocation recovery items -----------------------------------
  const allocRecoveryItems = useMemo(
    () =>
      (allocSummary?.allocations || []).filter((a: any) => a.participates),
    [allocSummary],
  );

  // ---- return -------------------------------------------------------
  return {
    // route params
    id,
    sid,
    // loading / entities
    loading,
    project,
    scenario,
    summary,
    internalSummary,
    internalHarnesses,
    // UI toggles
    mode,
    setMode,
    showMultiImport,
    setShowMultiImport,
    showMohDetail,
    setShowMohDetail,
    // derived KPIs
    effectiveCustomerHarnesses,
    customerVehicleCost,
    internalVehicleCost,
    grossMargin,
    allocPerVehicle,
    vehicleCost,
    harnessCount,
    totalHours,
    snapshotCustomerVehicleCost,
    // store data
    allocSummary,
    recoverySummary,
    allocByHarnessId,
    allocTrackerByHarnessId,
    // table / chart data
    lifecyclePnL,
    harnessTableData,
    allocRecoveryItems,
    // actions
    loadData,
  };
}
