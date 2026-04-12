/**
 * engine/snapshot_resolver.js
 * Issue #9: 版本快照解析 + financial exact 匹配
 * 依赖: shared_utils.js
 */
(function (global) {
  'use strict';

  // P0#1: 防御性解构 — 提供内联 fallback
  const U = global.G281SharedUtils || {};
  const numberOr = U.numberOr || function (v, fb) { var n = Number(v); return Number.isFinite(n) ? n : fb; };
  const safeArray = U.safeArray || function (v) { return Array.isArray(v) ? v : []; };
  const approxEqual = U.approxEqual || function (a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); };
  const arraysClose = U.arraysClose || function (a, b, eps) { if (!a || !b || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > (eps || 1e-9)) return false; } return true; };
  const normalizeMix = U.normalizeMix || function (m) { return Array.isArray(m) ? m : []; };

  // ── financial version 访问 ──────────────────
  function financialVersionEntries(runtime) {
    return runtime && runtime.financialVersions && runtime.financialVersions.versions
      ? runtime.financialVersions.versions : {};
  }
  function financialVersion(runtime, key) {
    if (!key) return null;
    return financialVersionEntries(runtime)[key] || null;
  }
  function financialVersionData(runtime, versionKey) {
    return financialVersion(runtime, versionKey);
  }

  // ── 资产验证 ────────────────────────────────
  function validationCapitalAmount(validation, scopeId, kind, fallback) {
    const summaryKey = kind === 'quote' ? 'quoteSummary' : 'fixedSummary';
    const amount = Number(validation && validation.comparisons && validation.comparisons[scopeId]
      && validation.comparisons[scopeId][summaryKey] && validation.comparisons[scopeId][summaryKey].totalNewAmount);
    return Number.isFinite(amount) ? amount : (Number(fallback) || 0);
  }

  // ── BOM 版本快照 ────────────────────────────
  function bomVersionSnapshot(runtime, base, versionKey) {
    const keyMap = { freeze: 'quote', light: 'fixed', regress: 'tt' };
    const snapshotKey = keyMap[versionKey];
    const runtimeSnapshots = runtime && runtime.bomVersions && runtime.bomVersions.versionSnapshots;
    const snapshot = snapshotKey && runtimeSnapshots ? runtimeSnapshots[snapshotKey] : null;
    const fallbackFactor = Number(base && base.versions && base.versions.bom
      && base.versions.bom[versionKey] && base.versions.bom[versionKey].factor);
    return {
      kind: snapshot && snapshot.kind ? snapshot.kind : (snapshotKey || versionKey || ''),
      factor: snapshot && Number.isFinite(Number(snapshot.materialFactor))
        ? Number(snapshot.materialFactor)
        : (Number.isFinite(fallbackFactor) ? fallbackFactor : 1),
      snapshot: snapshot || null,
    };
  }

  // ── 资本版本快照 ──────────────────────────
  function capitalVersionSnapshot(runtime, base, versionKey) {
    const quoteSnapshot = {
      equipment: validationCapitalAmount(runtime && runtime.capitalValidation, 'equipment', 'quote', base && base.capital && base.capital.equipment),
      tooling: validationCapitalAmount(runtime && runtime.capitalValidation, 'tooling', 'quote', base && base.capital && base.capital.tooling),
      fixtures: validationCapitalAmount(runtime && runtime.capitalValidation, 'fixtures', 'quote', base && base.capital && base.capital.fixtures),
      rnd: Number(base && base.capital && base.capital.rnd) || 0,
      sourceKind: 'quote',
    };
    const fixedSnapshot = {
      equipment: validationCapitalAmount(runtime && runtime.capitalValidation, 'equipment', 'fixed', base && base.capital && base.capital.equipment),
      tooling: validationCapitalAmount(runtime && runtime.capitalValidation, 'tooling', 'fixed', base && base.capital && base.capital.tooling),
      fixtures: validationCapitalAmount(runtime && runtime.capitalValidation, 'fixtures', 'fixed', base && base.capital && base.capital.fixtures),
      rnd: Number(base && base.capital && base.capital.rnd) || 0,
      sourceKind: 'fixed',
    };
    const option = base && base.versions && base.versions.equipment ? base.versions.equipment[versionKey] || {} : {};
    const hasExplicitCapital = ['equipment', 'tooling', 'fixtures', 'rnd'].some((k) =>
      option && option[k] !== undefined && option[k] !== null && option[k] !== '');
    if (hasExplicitCapital) {
      return { equipment: Number(option.equipment) || 0, tooling: Number(option.tooling) || 0,
               fixtures: Number(option.fixtures) || 0, rnd: Number(option.rnd) || 0, sourceKind: 'custom' };
    }
    if (versionKey === 'base') return quoteSnapshot;
    if (versionKey === 'shared') return fixedSnapshot;
    const factor = Number(option && option.factor);
    const scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
    return { equipment: fixedSnapshot.equipment * scale, tooling: fixedSnapshot.tooling * scale,
             fixtures: fixedSnapshot.fixtures * scale, rnd: fixedSnapshot.rnd, sourceKind: 'tt' };
  }

  // ── 生命周期版本一致性检测 ───────────────
  function lifecycleVersionKey(stateSnapshot) {
    const maps = {
      bom: { freeze: 'quote', light: 'fixed', regress: 'tt' },
      metal: { quote: 'quote', fixed: 'fixed', tt: 'tt' },
      connector: { quote: 'quote', fixed: 'fixed' },
      labor: { base: 'quote', optimize: 'fixed', ramp: 'tt' },
      equipment: { base: 'quote', shared: 'fixed', dedicated: 'tt' },
      packaging: { base: 'quote', optimize: 'fixed', longhaul: 'tt' },
      sales: { quote: 'quote', fixed: 'fixed', tt: 'tt' },
      mix: { quote: 'quote', fixed: 'fixed', tt: 'tt' },
    };
    const versions = Object.keys(maps).map((k) => maps[k][stateSnapshot && stateSnapshot[k]] || null);
    if (!versions.length || versions.some((k) => !k)) return null;
    return versions.every((k) => k === versions[0]) ? versions[0] : null;
  }

  function lifecycleMetalBaseline(base, lifecycleKey) {
    const option = base && base.versions && base.versions.metal ? base.versions.metal[lifecycleKey] || {} : {};
    return {
      copperPrice: numberOr(option.copperPrice, numberOr(base && base.copperPrice, 0)),
      aluminumPrice: numberOr(option.aluminumPrice, numberOr(base && base.aluminumPrice, 0)),
    };
  }

  function lifecycleMixBaseline(base, lifecycleKey) {
    const option = base && base.versions && base.versions.mix ? base.versions.mix[lifecycleKey] || {} : {};
    const source = Array.isArray(option.values) && option.values.length ? option.values
      : (base && base.baselineMix ? base.baselineMix : []);
    return normalizeMix(source);
  }

  function lifecycleLaborSnapshot(runtime, lifecycleKey) {
    if (lifecycleKey !== 'quote' && lifecycleKey !== 'fixed') return null;
    return runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
      ? runtime.laborValidation.versionSnapshots[lifecycleKey] || null : null;
  }

  function lifecyclePackagingSnapshot(runtime, lifecycleKey) {
    if (lifecycleKey !== 'quote' && lifecycleKey !== 'fixed') return null;
    return runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots
      ? runtime.packagingValidation.versionSnapshots[lifecycleKey] || null : null;
  }

  // ── BOM draft 匹配 ──────────────────────────
  function bomDraftMatches(draft, snapshotDraft) {
    if (!snapshotDraft) return true;
    const keys = ['bomWireDrawing', 'bomWireEat', 'bomWireHidden', 'bomTapeDiameter', 'bomTapeWidth', 'bomTapeOverlap'];
    return keys.every((k) => {
      if (snapshotDraft[k] === undefined || snapshotDraft[k] === null || snapshotDraft[k] === '') return true;
      return approxEqual(draft && draft[k], snapshotDraft[k], 1e-6);
    });
  }

  // ── 精确财务版本解析 ────────────────────
  function resolveExactFinancialVersion(runtime, base, currentState, draft, bomSnapshot, connectorScenario) {
    const lifecycleKey = lifecycleVersionKey(currentState);
    if (lifecycleKey !== 'quote' && lifecycleKey !== 'fixed') return null;
    const SN = global.G281StateNormalizer;
    if (SN.stateFinancialVersionKey('connector', currentState && currentState.connector) !== lifecycleKey) return null;
    if ((currentState && currentState.vave) !== 'none') return null;
    if (Number(connectorScenario && connectorScenario.overrideCount) > 0) return null;
    const financial = financialVersionData(runtime, lifecycleKey);
    if (!financial) return null;
    if (!arraysClose(draft && draft.volumes, financial.volumes || [], 1e-6)) return null;
    if (!arraysClose(draft && draft.asp, financial.asp || [], 1e-6)) return null;
    const metalBaseline = lifecycleMetalBaseline(base, lifecycleKey);
    if (!approxEqual(draft && draft.copperPrice, metalBaseline.copperPrice, 1e-6)) return null;
    if (!approxEqual(draft && draft.aluminumPrice, metalBaseline.aluminumPrice, 1e-6)) return null;
    if (!arraysClose(draft && draft.mix, lifecycleMixBaseline(base, lifecycleKey), 1e-6)) return null;
    const laborSnap = lifecycleLaborSnapshot(runtime, lifecycleKey);
    if (laborSnap) {
      if (!approxEqual(draft && draft.directHours, laborSnap.directHours, 1e-6)) return null;
      if (!approxEqual(draft && draft.directRate, laborSnap.directRate, 1e-6)) return null;
      if (!approxEqual(draft && draft.manufacturingHours, laborSnap.manufacturingHours, 1e-6)) return null;
      if (!approxEqual(draft && draft.manufacturingRate, laborSnap.manufacturingRate, 1e-6)) return null;
    }
    const packSnap = lifecyclePackagingSnapshot(runtime, lifecycleKey);
    if (packSnap) {
      if (!approxEqual(draft && draft.packInner, packSnap.packInner, 1e-6)) return null;
      if (!approxEqual(draft && draft.packFreight, packSnap.packFreight, 1e-6)) return null;
      if (!approxEqual(draft && draft.packWarehouse, packSnap.packWarehouse, 1e-6)) return null;
      if (!approxEqual(draft && draft.packOther, packSnap.packOther, 1e-6)) return null;
    }
    if (!bomDraftMatches(draft, bomSnapshot && bomSnapshot.snapshot ? bomSnapshot.snapshot.draft : null)) return null;
    return { key: lifecycleKey, financial };
  }

  // ── 财务漂移警告 ────────────────────────
  function detectFinancialDriftWarnings(runtime, base, financialKey, draft) {
    const warnings = [];
    const version = financialVersion(runtime, financialKey);
    if (!version) return warnings;
    if (!arraysClose(draft && draft.volumes, version.volumes, 1e-6))
      warnings.push(`当前销量输入与 ${version.label || financialKey} financialVersions 不一致，已按 Excel 精确版口径计算。`);
    if (!arraysClose(draft && draft.asp, version.asp, 1e-6))
      warnings.push(`当前 ASP 输入与 ${version.label || financialKey} financialVersions 不一致，已按 Excel 精确版口径计算。`);
    const metal = base && base.versions && base.versions.metal ? base.versions.metal[financialKey] : null;
    if (metal) {
      if (!approxEqual(draft && draft.copperPrice, metal.copperPrice, 1e-3))
        warnings.push(`当前铜价输入与 ${version.label || financialKey} 金属基价不一致，已按 financialVersions 精确版口径计算。`);
      if (!approxEqual(draft && draft.aluminumPrice, metal.aluminumPrice, 1e-3))
        warnings.push(`当前铝价输入与 ${version.label || financialKey} 金属基价不一致，已按 financialVersions 精确版口径计算。`);
    }
    const labor = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
      ? runtime.laborValidation.versionSnapshots[financialKey] : null;
    if (labor) {
      if (!approxEqual(draft && draft.directHours, labor.directHours, 1e-3)
        || !approxEqual(draft && draft.directRate, labor.directRate, 1e-2)
        || !approxEqual(draft && draft.manufacturingHours, labor.manufacturingHours, 1e-3)
        || !approxEqual(draft && draft.manufacturingRate, labor.manufacturingRate, 1e-2))
        warnings.push(`当前工时输入与 ${version.label || financialKey} 工时版不一致，已按 financialVersions 精确版口径计算。`);
    }
    const packaging = runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots
      ? runtime.packagingValidation.versionSnapshots[financialKey] : null;
    if (packaging) {
      if (!approxEqual(draft && draft.packInner, packaging.packInner, 1e-3)
        || !approxEqual(draft && draft.packFreight, packaging.packFreight, 1e-3)
        || !approxEqual(draft && draft.packWarehouse, packaging.packWarehouse, 1e-3)
        || !approxEqual(draft && draft.packOther, packaging.packOther, 1e-3))
        warnings.push(`当前包装物流输入与 ${version.label || financialKey} 包装版不一致，已按 financialVersions 精确版口径计算。`);
    }
    return warnings;
  }

  // ── 精确版 draft 覆盖 ─────────────────────
  function effectiveDraftForFinancial(runtime, base, draft, financialKey) {
    const version = financialVersion(runtime, financialKey);
    if (!version) return draft;
    const labor = runtime && runtime.laborValidation && runtime.laborValidation.versionSnapshots
      ? runtime.laborValidation.versionSnapshots[financialKey] : null;
    const packaging = runtime && runtime.packagingValidation && runtime.packagingValidation.versionSnapshots
      ? runtime.packagingValidation.versionSnapshots[financialKey] : null;
    const metal = base && base.versions && base.versions.metal ? base.versions.metal[financialKey] : null;
    return {
      ...draft,
      copperPrice: metal ? numberOr(metal.copperPrice, draft.copperPrice) : draft.copperPrice,
      aluminumPrice: metal ? numberOr(metal.aluminumPrice, draft.aluminumPrice) : draft.aluminumPrice,
      directHours: labor ? numberOr(labor.directHours, draft.directHours) : draft.directHours,
      directRate: labor ? numberOr(labor.directRate, draft.directRate) : draft.directRate,
      manufacturingHours: labor ? numberOr(labor.manufacturingHours, draft.manufacturingHours) : draft.manufacturingHours,
      manufacturingRate: labor ? numberOr(labor.manufacturingRate, draft.manufacturingRate) : draft.manufacturingRate,
      packInner: packaging ? numberOr(packaging.packInner, draft.packInner) : draft.packInner,
      packFreight: packaging ? numberOr(packaging.packFreight, draft.packFreight) : draft.packFreight,
      packWarehouse: packaging ? numberOr(packaging.packWarehouse, draft.packWarehouse) : draft.packWarehouse,
      packOther: packaging ? numberOr(packaging.packOther, draft.packOther) : draft.packOther,
      volumes: safeArray(version.volumes).length ? version.volumes.map((v) => numberOr(v, 0)) : draft.volumes,
      asp: safeArray(version.asp).length ? version.asp.map((v) => numberOr(v, 0)) : draft.asp,
    };
  }

  // ── 导出 ────────────────────────────────────
  global.G281SnapshotResolver = {
    financialVersionEntries,
    financialVersion,
    financialVersionData,
    validationCapitalAmount,
    bomVersionSnapshot,
    capitalVersionSnapshot,
    lifecycleVersionKey,
    lifecycleMetalBaseline,
    lifecycleMixBaseline,
    lifecycleLaborSnapshot,
    lifecyclePackagingSnapshot,
    bomDraftMatches,
    resolveExactFinancialVersion,
    detectFinancialDriftWarnings,
    effectiveDraftForFinancial,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281SnapshotResolver;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
