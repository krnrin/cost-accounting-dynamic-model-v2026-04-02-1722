/**
 * dash_version_manager.js
 * 版本CRUD/快照/readDraft/applyDraft + 连接器协议
 * Extracted from dashboard.js — do not edit both files simultaneously.
 */

function versionOptionLabel(group, key) {
  return BASE.versions?.[group]?.[key]?.label || key || '';
}

function orderedVersionEntries(group, options) {
  const entries = Object.entries(options || {});
  const customEntrySorter = ([leftKey], [rightKey]) => {
    const leftOption = options?.[leftKey] || {};
    const rightOption = options?.[rightKey] || {};
    const leftCustom = Boolean(leftOption.userCreated);
    const rightCustom = Boolean(rightOption.userCreated);
    if (leftCustom !== rightCustom) {
      return leftCustom ? -1 : 1;
    }
    if (leftCustom && rightCustom) {
      const leftTime = Date.parse(leftOption.createdAt || '') || 0;
      const rightTime = Date.parse(rightOption.createdAt || '') || 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
    }
    return 0;
  };
  const preferredOrder = VERSION_DISPLAY_ORDER[group];
  if (!preferredOrder || !preferredOrder.length) {
    return entries.sort(customEntrySorter);
  }
  const rankMap = new Map(preferredOrder.map((key, index) => [key, index]));
  return entries.sort(([leftKey], [rightKey]) => {
    const leftRank = rankMap.has(leftKey) ? rankMap.get(leftKey) : -1;
    const rightRank = rankMap.has(rightKey) ? rankMap.get(rightKey) : -1;
    if (leftRank === rightRank) {
      if (leftRank === -1) {
        const customOrder = customEntrySorter([leftKey], [rightKey]);
        if (customOrder !== 0) return customOrder;
      }
      return 0;
    }
    if (leftRank === -1) return -1;
    if (rightRank === -1) return 1;
    return leftRank - rightRank;
  });
}

function resolveVersionFallbackKey(group, excludedKey = '') {
  const options = BASE.versions?.[group] || {};
  const preferredKey = DEFAULT_STATE[group];
  if (preferredKey && preferredKey !== excludedKey && options[preferredKey]) {
    return preferredKey;
  }
  const nextEntry = orderedVersionEntries(group, options).find(([key]) => key !== excludedKey);
  return nextEntry?.[0] || '';
}

function currentScenarioBindings() {
  return Object.keys(DEFAULT_STATE).reduce((acc, group) => {
    if (group === 'scenarioName') return acc;
    if (state[group]) {
      acc[group] = state[group];
    }
    return acc;
  }, {});
}

function savedScenarioRecords() {
  const merged = new Map();
  repo.getHistory().forEach((record) => {
    merged.set(record.id, {
      scenarioId: record.id,
      name: record.name || record.scenarioName || record.id,
      scenarioName: record.scenarioName || record.name || record.id,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      draft: clonePlain(record.draft, {}),
      state: clonePlain(record.state, {}),
      bindings: clonePlain(record.state, {}),
      summary: clonePlain(record.summary, {}),
    });
  });
  (Array.isArray(scenarioVersionState.records) ? scenarioVersionState.records : []).forEach((record) => {
    const key = record.scenarioId || record.id;
    if (!key) return;
    merged.set(key, {
      ...merged.get(key),
      ...record,
      scenarioId: key,
    });
  });
  return Array.from(merged.values())
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
}

function refreshScenarioVersionState(options = {}) {
  if (!scenarioVersionRepo?.listScenarios) {
    scenarioVersionState.records = [];
    scenarioVersionState.ready = Promise.resolve([]);
    return scenarioVersionState.ready;
  }
  if (!options.force && scenarioVersionState.ready) {
    return scenarioVersionState.ready;
  }
  scenarioVersionState.ready = scenarioVersionRepo.listScenarios({ projectCode: PROJECT_CODE })
    .then((records) => {
      scenarioVersionState.records = Array.isArray(records) ? records : [];
      return scenarioVersionState.records;
    })
    .catch((error) => {
      console.warn('[G281Dashboard] Failed to refresh saved scenarios', error);
      scenarioVersionState.records = [];
      return [];
    });
  return scenarioVersionState.ready;
}

async function saveScenarioVersionRecord(model, options = {}) {
  if (!scenarioVersionRepo?.saveScenario) {
    return null;
  }
  try {
    const scenarioId = toText(options.scenarioId, createUniqueScenarioId());
    const record = await scenarioVersionRepo.saveScenario({
      scenarioId,
      name: model?.d?.scenarioName || state.scenarioName || BASE.name,
      scenarioName: model?.d?.scenarioName || state.scenarioName || BASE.name,
      projectCode: PROJECT_CODE,
      note: toText(options.note, ''),
      draft: clonePlain(model?.d, readDraft()),
      state: currentScenarioStateSnapshot(),
      bindings: currentScenarioBindings(),
      summary: {
        revenue: model?.totalRevenue,
        cost: model?.totalCost,
        profit: model?.totalProfit,
        margin: model?.margin,
        paybackYears: model?.paybackYears,
        capitalTotal: model?.capitalTotal,
      },
    });
    await refreshScenarioVersionState({ force: true });
    return record;
  } catch (error) {
    console.warn('[G281Dashboard] Failed to save scenario record', error);
    return null;
  }
}

async function loadSavedScenarioRecord(scenarioId) {
  if (!scenarioId || !scenarioVersionRepo?.getScenario) {
    return false;
  }
  try {
    const record = await scenarioVersionRepo.getScenario(scenarioId);
    if (!record) {
      return false;
    }
    applyStateSnapshot(record.state || record.bindings || {});
    if (!record.state || !record.state.metal) {
      state.metal = recordMetalVersionKey(record);
    }
    if (!record.state || !record.state.sales) {
      state.sales = inferSalesVersion(record.draft?.volumes);
    }
    if (!record.state || !record.state.mix) {
      state.mix = inferMixVersion(record.draft?.mix);
    }
    applyDraft(record.draft || {}, record.scenarioName || record.name || BASE.name);
    lastSavedVersionId = scenarioId;
    renderVersions();
    render(calcModel());
    return true;
  } catch (error) {
    console.warn('[G281Dashboard] Failed to load saved scenario', error);
    return false;
  }
}

async function persistVersionOptionToStore(group, versionKey, option, payload = {}, extra = {}) {
  if (!factorVersionRepo?.saveFactorVersionFromSnapshot) {
    return null;
  }
  const workbookSnapshot = clonePlain(
    payload.templateWorkbookSnapshot ?? payload.workbookSnapshot ?? option?.templateWorkbookSnapshot,
    null,
  );
  if (!workbookSnapshot?.sheetOrder?.length || !workbookSnapshot?.sheets) {
    return null;
  }

  try {
    const stored = await factorVersionRepo.saveFactorVersionFromSnapshot({
      factorType: group,
      projectCode: PROJECT_CODE,
      versionId: versionKey,
      versionLabel: option?.label || versionKey,
      workbookSnapshot,
      workbookName: toText(option?.workbook, option?.label || versionKey),
      sourceType: toText(extra.sourceType, option?.entryMode || 'template'),
      status: toText(extra.status, 'active'),
      meta: {
        workbookVersionKeyFallback: option?.workbookVersionKeyFallback || payload?.workbookVersionKeyFallback || '',
        templateSource: option?.templateSource || payload?.source || '',
        sourceNote: option?.sourceNote || option?.note || '',
      },
    });
    const liveOption = BASE.versions?.[group]?.[versionKey];
    if (liveOption) {
      liveOption.nativeWorkbookVersionId = stored.versionId;
      liveOption.factorSnapshotId = stored.snapshotId;
      liveOption.persistedAt = stored.updatedAt;
      if (group === 'bom' && bomSemanticRepo?.saveBomReleaseFromSnapshot) {
        try {
          const semanticRecord = await bomSemanticRepo.saveBomReleaseFromSnapshot({
            releaseId: stored.versionId,
            versionId: stored.versionId,
            releaseLabel: option?.label || versionKey,
            versionLabel: option?.label || versionKey,
            projectCode: PROJECT_CODE,
            snapshotId: stored.snapshotId,
            baseReleaseId: toText(extra.baseReleaseId, ''),
            workbookSnapshot,
          });
          liveOption.semanticReleaseId = semanticRecord?.releaseId || stored.versionId;
          liveOption.semanticSummary = clonePlain(semanticRecord?.summary, null);
          if (extra.baseReleaseId && extra.baseReleaseId !== liveOption.semanticReleaseId) {
            try {
              const diffRecord = await compareBomSemanticReleases(extra.baseReleaseId, liveOption.semanticReleaseId, {
                forceRefresh: true,
                leftLabel: toText(extra.baseLabel, extra.baseReleaseId),
                rightLabel: toText(option?.label, versionKey),
              });
              if (diffRecord) {
                liveOption.baseSemanticReleaseId = toText(extra.baseReleaseId, '');
                liveOption.latestDiffResultId = toText(diffRecord.diffId, '');
                liveOption.latestDiffSummary = clonePlain(diffRecord.summary, null);
              }
            } catch (diffError) {
              console.warn('[G281Dashboard] Failed to persist BOM diff result', diffError);
            }
          }
        } catch (semanticError) {
          console.warn('[G281Dashboard] Failed to persist BOM semantic release', semanticError);
        }
      }
      persistUserVersions();
    }
    return stored;
  } catch (error) {
    console.warn(`[G281Dashboard] Failed to persist ${group} version store record`, error);
    return null;
  }
}

function readUserVersionStore() {
  try {
    const raw = window.localStorage.getItem(USER_VERSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function persistUserVersions() {
  try {
    const payload = USER_VERSION_GROUPS.reduce((acc, group) => {
      const options = BASE.versions?.[group] || {};
      const customEntries = Object.entries(options).reduce((groupAcc, [key, option]) => {
        if (!option?.userCreated) return groupAcc;
        groupAcc[key] = clonePlain(option, option);
        return groupAcc;
      }, {});
      if (Object.keys(customEntries).length) {
        acc[group] = customEntries;
      }
      return acc;
    }, {});
    window.localStorage.setItem(USER_VERSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function normalizeTargetMarginPercent(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(-99.99, Math.min(99.99, Number(numeric.toFixed(2))));
}

function loadStoredTargetMarginPercent() {
  try {
    return normalizeTargetMarginPercent(window.localStorage.getItem(TARGET_MARGIN_STORAGE_KEY));
  } catch (error) {
    return null;
  }
}

function loadStoredWireCatalogShowAll() {
  try {
    return normalizeStoredBoolean(window.localStorage.getItem(WIRE_CATALOG_VIEW_STORAGE_KEY), false);
  } catch (error) {
    return false;
  }
}

function persistWireCatalogShowAll(value) {
  try {
    if (!value) {
      window.localStorage.removeItem(WIRE_CATALOG_VIEW_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(WIRE_CATALOG_VIEW_STORAGE_KEY, '1');
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function setWireCatalogShowAll(value) {
  showInactiveWireModels = !!value;
  persistWireCatalogShowAll(showInactiveWireModels);
  render(calcModel());
}

function updateWireCatalogToggleButton(hiddenCount = 0) {
  if (!el.toggleWireCatalogViewBtn) return;
  const showAll = !!showInactiveWireModels;
  const suffix = hiddenCount > 0 && !showAll ? `（${hiddenCount}）` : '';
  el.toggleWireCatalogViewBtn.textContent = showAll ? '隐藏非版本导线' : `显示非版本导线${suffix}`;
  el.toggleWireCatalogViewBtn.setAttribute('aria-pressed', showAll ? 'true' : 'false');
  el.toggleWireCatalogViewBtn.disabled = !showAll && hiddenCount <= 0;
  el.toggleWireCatalogViewBtn.title = showAll
    ? '恢复为只显示当前版本实际使用的导线型号'
    : '展开显示当前版本未用、零用量或缺失的导线型号';
}

function clearProfitInsightsCache() {
  profitInsightsCacheKey = '';
  profitInsightsCacheValue = null;
}

function persistTargetMarginOverride(value) {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(TARGET_MARGIN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TARGET_MARGIN_STORAGE_KEY, String(value));
  } catch (error) {
    // Ignore local persistence failures in offline browser mode.
  }
}

function setCustomTargetMarginPercent(value) {
  const normalized = normalizeTargetMarginPercent(value);
  if (normalized === null) return;
  customTargetMarginPercent = normalized;
  persistTargetMarginOverride(normalized);
  clearProfitInsightsCache();
  render(calcModel());
}

function resetCustomTargetMarginPercent(options = {}) {
  customTargetMarginPercent = null;
  persistTargetMarginOverride(null);
  clearProfitInsightsCache();
  if (!options.skipRender) {
    render(calcModel());
  }
}

function hydrateUserVersions() {
  const store = readUserVersionStore();
  USER_VERSION_GROUPS.forEach((group) => {
    const entries = store?.[group];
    if (!entries || typeof entries !== 'object') return;
    BASE.versions[group] = {
      ...(BASE.versions[group] || {}),
      ...clonePlain(entries, {}),
    };
  });
}

function cleanupVersionManagement() {
  Object.entries(VERSION_CLEANUP_KEEP_KEYS).forEach(([group, keepKeys]) => {
    const options = BASE.versions?.[group];
    if (!options || typeof options !== 'object') return;
    const nextOptions = keepKeys.reduce((acc, key) => {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        acc[key] = options[key];
      }
      return acc;
    }, {});
    if (Object.keys(nextOptions).length) {
      BASE.versions[group] = nextOptions;
    }
  });

  Object.keys(DEFAULT_STATE).forEach((group) => {
    const options = BASE.versions?.[group];
    if (!options || typeof options !== 'object') return;
    if (options[state[group]]) return;
    const fallbackKey = resolveVersionFallbackKey(group);
    if (fallbackKey) {
      state[group] = fallbackKey;
    }
  });

  connectorPricingState = sanitizeConnectorPricing(
    connectorPricingState,
    BASE.versions?.connector?.[state.connector] ? state.connector : DEFAULT_STATE.connector
  );
}

function isUserCreatedVersion(group, key = state[group]) {
  return Boolean(BASE.versions?.[group]?.[key]?.userCreated);
}

function currentBomDraftSnapshot() {
  return {
    bomWireDrawing: Number(controls.bomWireDrawing.value) || 0,
    bomWireEat: Number(controls.bomWireEat.value) || 0,
    bomWireHidden: Number(controls.bomWireHidden.value) || 0,
    bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0,
    bomTapeWidth: Number(controls.bomTapeWidth.value) || 0,
    bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0,
  };
}

function currentLaborDraftSnapshot() {
  return {
    directHours: Number(controls.directHours.value) || 0,
    directRate: Number(controls.directRate.value) || 0,
    manufacturingHours: Number(controls.manufacturingHours.value) || 0,
    manufacturingRate: Number(controls.manufacturingRate.value) || 0,
  };
}

function currentPackagingDraftSnapshot() {
  return {
    packInner: Number(controls.packInner.value) || 0,
    packFreight: Number(controls.packFreight.value) || 0,
    packWarehouse: Number(controls.packWarehouse.value) || 0,
    packOther: Number(controls.packOther.value) || 0,
  };
}

function currentSalesDraftSnapshot() {
  return yearInputs.map((input) => Math.max(0, Number(input.value) || 0));
}

function currentMixDraftSnapshot() {
  return normalizeMix(mixInputs.map((input) => input.value));
}

function ensureVersionAddButtons() {
  document.querySelectorAll('.version-group').forEach((groupElement) => {
    const optionRow = groupElement.querySelector('.option-row[data-group]');
    const title = groupElement.querySelector('.version-title');
    if (!optionRow || !title) return;
    const group = optionRow.dataset.group;
    let side = title.querySelector('.version-title-side');
    if (!side) {
      side = document.createElement('div');
      side.className = 'version-title-side';
      const subtitle = title.children[1];
      if (subtitle) {
        side.appendChild(subtitle);
      }
      title.appendChild(side);
    }
    if (side.querySelector(`[data-add-version="${group}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'version-add-btn';
    button.dataset.addVersion = group;
    button.title = `新增${VERSION_GROUP_LABELS[group] || group}`;
    button.textContent = '+';
    side.appendChild(button);
  });
}

function buildUserVersionOption(group, label, payload = {}) {
  const activeKey = state[group];
  const activeOption = clonePlain(BASE.versions?.[group]?.[activeKey] || {}, {});
  const createdAt = new Date().toISOString();
  const currentLabel = versionOptionLabel(group, activeKey) || VERSION_GROUP_LABELS[group] || group;
  const manualPayload = payload && Object.keys(payload).length > 0;
  const templateSource = toText(payload.source, toText(activeOption.templateSource || activeOption.source || activeOption.workbook || ''));
  const baseOption = {
    ...activeOption,
    label,
    userCreated: true,
    createdAt,
    entryMode: manualPayload ? 'template' : 'clone',
    templateSource,
    templateNote: payload.templateNote !== undefined ? payload.templateNote : toText(activeOption.templateNote || ''),
    templateRawInputs: clonePlain(payload.templateRawInputs, clonePlain(activeOption.templateRawInputs, null)) || null,
    templateFieldAddressMap: clonePlain(payload.templateFieldAddressMap, clonePlain(activeOption.templateFieldAddressMap, null)) || null,
    templateWorkbookSeed: clonePlain(payload.templateWorkbookSeed, clonePlain(activeOption.templateWorkbookSeed, null)) || null,
    templateWorkbookSnapshot: clonePlain(payload.templateWorkbookSnapshot, clonePlain(activeOption.templateWorkbookSnapshot, null)) || null,
    note: payload.note || `离线新增版本，复制自${currentLabel}，保存在当前浏览器。`,
  };

  if (group === 'bom') {
    const snapshot = bomVersionSnapshot(activeKey);
    const draft = {
      ...(snapshot?.draft || {}),
      ...currentBomDraftSnapshot(),
      ...(payload.draft || {}),
    };
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      factor: payload.factor !== undefined ? coerceNumber(payload.factor, 1) : (Number(snapshot?.materialFactor) || Number(activeOption.factor) || 1),
      wireFactor: payload.wireFactor !== undefined ? coerceNumber(payload.wireFactor, 1) : (Number(snapshot?.wireFactor) || Number(activeOption.wireFactor) || 1),
      draft,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，BOM参数按当前页面快照保存。`,
      workbook: templateSource || payload.workbook || snapshot?.workbook || '',
      totalMeter: payload.totalMeter !== undefined ? coerceNumber(payload.totalMeter, 0) : (Number(snapshot?.totalMeter) || 0),
      wireMeter: payload.wireMeter !== undefined ? coerceNumber(payload.wireMeter, 0) : (Number(snapshot?.wireMeter) || 0),
      tapeMeter: payload.tapeMeter !== undefined ? coerceNumber(payload.tapeMeter, 0) : (Number(snapshot?.tapeMeter) || 0),
      tubeMeter: payload.tubeMeter !== undefined ? coerceNumber(payload.tubeMeter, 0) : (Number(snapshot?.tubeMeter) || 0),
      actualLengthChangeSummary: payload.actualLengthChangeSummary || snapshot?.actualLengthChangeSummary || null,
    };
  }
  if (group === 'metal') {
    return {
      ...baseOption,
      copperPrice: payload.copperPrice !== undefined ? Math.max(0, coerceNumber(payload.copperPrice, 0)) : (Number(controls.copperPrice.value) || 0),
      aluminumPrice: payload.aluminumPrice !== undefined ? Math.max(0, coerceNumber(payload.aluminumPrice, 0)) : (Number(controls.aluminumPrice.value) || 0),
      manualManaged: payload.manualManaged !== undefined ? Boolean(payload.manualManaged) : true,
      seedSourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，铜铝基价按当前页面快照保存。`,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，铜铝基价按当前页面快照保存。`,
    };
  }
  if (group === 'connector') {
    const connectorSourceKey = connectorVersionSet.has(payload.sourceKey)
      ? payload.sourceKey
      : (connectorVersionSet.has(activeOption.sourceKey) ? activeOption.sourceKey : DEFAULT_STATE.connector);
    return {
      ...baseOption,
      factor: payload.factor !== undefined ? coerceNumber(payload.factor, Number(activeOption.factor) || 1) : (Number(activeOption.factor) || 1),
      sourceKey: connectorSourceKey,
      overrides: sanitizeConnectorPricing(payload.overrides || connectorPricingState, connectorSourceKey),
      templateRows: clonePlain(payload.templateRows, clonePlain(activeOption.templateRows, [])) || [],
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，保留当前连接器覆盖项。`,
    };
  }
  if (group === 'labor') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      directHours: payload.directHours !== undefined ? coerceNumber(payload.directHours, 0) : currentLaborDraftSnapshot().directHours,
      directRate: payload.directRate !== undefined ? coerceNumber(payload.directRate, 0) : currentLaborDraftSnapshot().directRate,
      manufacturingHours: payload.manufacturingHours !== undefined ? coerceNumber(payload.manufacturingHours, 0) : currentLaborDraftSnapshot().manufacturingHours,
      manufacturingRate: payload.manufacturingRate !== undefined ? coerceNumber(payload.manufacturingRate, 0) : currentLaborDraftSnapshot().manufacturingRate,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，工时与费率按当前页面快照保存。`,
    };
  }
  if (group === 'equipment') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      factor: payload.factor !== undefined ? coerceNumber(payload.factor, 1) : (Number(activeOption.factor) || 1),
      equipment: payload.equipment !== undefined ? coerceNumber(payload.equipment, 0) : activeOption.equipment,
      tooling: payload.tooling !== undefined ? coerceNumber(payload.tooling, 0) : activeOption.tooling,
      fixtures: payload.fixtures !== undefined ? coerceNumber(payload.fixtures, 0) : activeOption.fixtures,
      rnd: payload.rnd !== undefined ? coerceNumber(payload.rnd, 0) : activeOption.rnd,
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，当前设备投资系数 ${fmtNumber(Number(activeOption.factor) || 1, 3)}。`,
    };
  }
  if (group === 'packaging') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      packInner: payload.packInner !== undefined ? coerceNumber(payload.packInner, 0) : currentPackagingDraftSnapshot().packInner,
      packFreight: payload.packFreight !== undefined ? coerceNumber(payload.packFreight, 0) : currentPackagingDraftSnapshot().packFreight,
      packWarehouse: payload.packWarehouse !== undefined ? coerceNumber(payload.packWarehouse, 0) : currentPackagingDraftSnapshot().packWarehouse,
      packOther: payload.packOther !== undefined ? coerceNumber(payload.packOther, 0) : currentPackagingDraftSnapshot().packOther,
      sourceNote: payload.sourceNote ?? activeOption.sourceNote ?? '',
    };
  }
  if (group === 'configSheet') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      workbook: toText(payload.workbook, templateSource || activeOption.workbook || label),
      workbookVersionKeyFallback: toText(
        payload.workbookVersionKeyFallback,
        toText(activeOption.workbookVersionKeyFallback, activeKey || state.configSheet),
      ),
      sourceNote: payload.sourceNote || `来源：配置清单 Excel 式版本，复制自 ${currentLabel}。`,
    };
  }
  if (group === 'sales') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      volumes: Array.isArray(payload.volumes) ? payload.volumes.map((value) => Math.max(0, coerceNumber(value, 0))) : currentSalesDraftSnapshot(),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，销量预测按当前页面快照保存。`,
    };
  }
  if (group === 'mix') {
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      values: Array.isArray(payload.values) ? normalizeMix(payload.values) : currentMixDraftSnapshot(),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，配置比例按当前页面快照保存。`,
    };
  }
  if (group === 'annualDrop') {
    const fallbackSnapshot = annualDropVersionSnapshot(activeKey);
    const yearRows = Array.isArray(payload.yearRows)
      ? normalizeAnnualDropYearRows(payload.yearRows, lifecycleTemplateYears(), payload.annualRate)
      : fallbackSnapshot.yearRows;
    const annualRate = yearRows.find((row, index) => index > 0 && Number(row?.rate) > 0)?.rate
      ?? yearRows.find((row) => Number(row?.rate) > 0)?.rate
      ?? Math.max(0, coerceNumber(fallbackSnapshot.annualRate, 0));
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      yearRows,
      annualRate: Math.max(0, coerceNumber(annualRate, 0)),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，${annualDropSnapshotSummary({ yearRows })}。`,
    };
  }
  if (group === 'oneTimeCustomer') {
    const fallbackSnapshot = oneTimeCustomerVersionSnapshot(activeKey);
    const entries = Array.isArray(payload.entries)
      ? normalizeOneTimeCustomerEntries(payload.entries, lifecycleTemplateYears(), payload.amountTotal)
      : fallbackSnapshot.entries;
    const amountTotal = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      entries,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，${oneTimeCustomerSnapshotSummary({ entries })}。`,
    };
  }
  if (group === 'rebate') {
    const fallbackSnapshot = rebateVersionSnapshot(activeKey);
    const yearRows = Array.isArray(payload.yearRows)
      ? normalizeRebateYearRows(payload.yearRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), payload.amountPerSet)
      : fallbackSnapshot.yearRows;
    const amountTotal = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
    const amountPerSet = lifecycleVolumeTotal() ? amountTotal / lifecycleVolumeTotal() : 0;
    return {
      ...baseOption,
      kind: payload.kind || activeOption.kind || 'custom',
      yearRows,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
      amountPerSet: Math.max(0, coerceNumber(amountPerSet, 0)),
      sourceNote: payload.sourceNote || `来源：离线新增版本，复制自${currentLabel}，${rebateSnapshotSummary({ yearRows })}。`,
    };
  }
  if (group === 'vave') {
    return {
      ...baseOption,
      savings: Number(activeOption.savings) || 0,
      sourceNote: `来源：离线新增版本，复制自${currentLabel}，当前VAVE降本 ${fmtMoney(Number(activeOption.savings) || 0)} 元/套。`,
    };
  }
  return baseOption;
}

function createUserVersion(group) {
  if (!BASE.versions?.[group]) return;
  if (openVersionTemplateModal(group)) return;
  const suggestedLabel = suggestNewVersionLabel(group);
  const rawLabel = window.prompt(`请输入${VERSION_GROUP_LABELS[group] || group}的新版本名称`, suggestedLabel);
  if (rawLabel === null) return;
  const label = rawLabel.trim();
  if (!label) {
    window.alert('版本名称不能为空。');
    return;
  }
  const key = makeUserVersionKey(group);
  BASE.versions[group][key] = buildUserVersionOption(group, label);
  if (group === 'metal') {
    metalVersionLocks[key] = true;
  }
  state[group] = key;
  applyVersionPreset(group, key);
  persistUserVersions();
  renderVersions();
  queueRender();
}

function deleteUserVersion(group, key) {
  const option = BASE.versions?.[group]?.[key] || null;
  if (!option?.userCreated) return false;
  const label = versionOptionLabel(group, key) || key;
  const groupLabel = VERSION_GROUP_LABELS[group] || group;
  const confirmed = window.confirm(`确定删除${groupLabel}版本“${label}”吗？删除后不会影响内置版本。`);
  if (!confirmed) return false;

  const fallbackKey = resolveVersionFallbackKey(group, key);
  delete BASE.versions[group][key];
  if (group === 'metal') {
    delete metalVersionLocks[key];
  }

  if (state[group] === key) {
    state[group] = fallbackKey;
    if (fallbackKey) {
      applyVersionPreset(group, fallbackKey);
    }
  }

  if (group === 'connector') {
    connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector || DEFAULT_STATE.connector);
  }

  persistUserVersions();
  renderVersions();
  queueRender();
  return true;
}

function syncTemplateStateToVersion(option, patch = {}) {
  if (!option?.userCreated) return;
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const nextRawInputs = clonePlain(option.templateRawInputs, {}) || {};
  let changed = false;
  keys.forEach((key) => {
    if (nextRawInputs[key] === patch[key]) return;
    nextRawInputs[key] = patch[key];
    changed = true;
  });
  if (!changed && option.templateRawInputs) return;
  option.templateRawInputs = nextRawInputs;
  if (changed && option.templateWorkbookSnapshot) {
    option.templateWorkbookSnapshot = null;
  }
}

function syncActiveCustomVersionsFromInputs() {
  const activeBom = BASE.versions?.bom?.[state.bom];
  if (activeBom?.userCreated) {
    const draft = currentBomDraftSnapshot();
    activeBom.draft = draft;
    syncTemplateStateToVersion(activeBom, draft);
  }
  const activeLabor = BASE.versions?.labor?.[state.labor];
  if (activeLabor?.userCreated) {
    const draft = currentLaborDraftSnapshot();
    Object.assign(activeLabor, draft);
    syncTemplateStateToVersion(activeLabor, draft);
  }
  const activePackaging = BASE.versions?.packaging?.[state.packaging];
  if (activePackaging?.userCreated) {
    const draft = currentPackagingDraftSnapshot();
    Object.assign(activePackaging, draft);
    syncTemplateStateToVersion(activePackaging, draft);
  }
  const activeSales = BASE.versions?.sales?.[state.sales];
  if (activeSales?.userCreated) {
    const volumes = currentSalesDraftSnapshot();
    activeSales.volumes = volumes;
    syncTemplateStateToVersion(activeSales, BASE.years.reduce((acc, year, index) => {
      acc[`sales_${year}`] = volumes[index];
      return acc;
    }, {}));
  }
  const activeMix = BASE.versions?.mix?.[state.mix];
  if (activeMix?.userCreated) {
    const values = currentMixDraftSnapshot();
    activeMix.values = values;
    syncTemplateStateToVersion(activeMix, BASE.configNames.reduce((acc, _name, index) => {
      acc[`mix_${index}`] = values[index];
      return acc;
    }, {}));
  }
  persistUserVersions();
}

function syncActiveConnectorCustomVersion() {
  const option = BASE.versions?.connector?.[state.connector];
  if (!option?.userCreated) return;
  option.overrides = { ...connectorPricingState };
  persistUserVersions();
}

function prepareMetalVersions() {
  Object.values(BASE.versions?.metal || {}).forEach((version) => {
    if (!version) return;
    if (!version.seedSourceNote) {
      version.seedSourceNote = version.sourceNote || '来源：g281_data_master.json 铜铝基价预设。';
    }
    if (typeof version.manualManaged !== 'boolean') {
      version.manualManaged = false;
    }
  });
}

function ensureMetalVersionLocks() {
  Object.keys(BASE.versions?.metal || {}).forEach((key) => {
    if (!(key in metalVersionLocks)) {
      metalVersionLocks[key] = true;
    }
  });
}

function setMetalVersionValues(versionKey, patch = {}, options = {}) {
  const version = BASE.versions?.metal?.[versionKey];
  if (!version) return;
  const nextCopper = Number(patch.copperPrice);
  const nextAluminum = Number(patch.aluminumPrice);
  if (patch.copperPrice !== undefined && Number.isFinite(nextCopper)) {
    version.copperPrice = nextCopper;
  }
  if (patch.aluminumPrice !== undefined && Number.isFinite(nextAluminum)) {
    version.aluminumPrice = nextAluminum;
  }
  if (options.manualManaged) {
    version.manualManaged = true;
  }
}

function metalVersionSnapshot(versionKey) {
  const version = BASE.versions.metal?.[versionKey];
  if (!version) return null;
  return {
    key: versionKey,
    label: version.label || versionOptionLabel('metal', versionKey),
    copperPrice: Number(version.copperPrice ?? BASE.copperPrice) || 0,
    aluminumPrice: Number(version.aluminumPrice ?? BASE.aluminumPrice) || 0,
    manualManaged: Boolean(version.manualManaged),
    sourceNote: version.manualManaged ? '来源：左侧版本价维护。' : (version.seedSourceNote || version.sourceNote || '来源：g281_data_master.json 铜铝基价预设。'),
  };
}

function applyMetalVersion(versionKey) {
  const snapshot = metalVersionSnapshot(versionKey);
  if (!snapshot) return;
  controls.copperPrice.value = snapshot.copperPrice;
  controls.aluminumPrice.value = snapshot.aluminumPrice;
}

function metalVersionSummary(versionKey) {
  const snapshot = metalVersionSnapshot(versionKey);
  if (!snapshot) return '';
  return `铜 ${fmtMoney(snapshot.copperPrice, 0)} 元/吨 / 铝 ${fmtMoney(snapshot.aluminumPrice, 0)} 元/吨`;
}

function metalVersionSourceText(versionKey) {
  const snapshot = metalVersionSnapshot(versionKey);
  if (!snapshot) return '';
  return `${snapshot.sourceNote} ${metalVersionSummary(versionKey)}。`;
}

function renderMetalVersionEditor() {
  if (!el.metalVersionEditor) return;
  ensureMetalVersionLocks();
  const entries = orderedVersionEntries('metal', BASE.versions?.metal || {});
  el.metalVersionEditor.innerHTML = entries.map(([key]) => {
    const snapshot = metalVersionSnapshot(key);
    if (!snapshot) return '';
    const locked = metalVersionLocks[key] !== false;
    const active = state.metal === key;
    const stateText = active ? '当前生效' : '待切换';
    const lockText = locked ? '已锁定' : '编辑中';
    return `
      <div class="metal-version-row${active ? ' active' : ''}">
        <div class="metal-version-row-head">
          <div class="metal-version-meta">
            <span class="metal-version-badge">${escapeHtml(snapshot.label)}</span>
            <span class="metal-version-state">${escapeHtml(stateText)}</span>
          </div>
          <button class="metal-lock-toggle${locked ? '' : ' is-unlocked'}" type="button" data-metal-lock="${escapeHtml(key)}">${escapeHtml(lockText)}</button>
        </div>
        <div class="metal-version-grid">
          <label class="metal-version-field">
            <span>铜价（元/吨）</span>
            <input data-metal-key="${escapeHtml(key)}" data-metal-field="copperPrice" type="number" step="100" min="50000" max="100000" value="${snapshot.copperPrice}" ${locked ? 'readonly' : ''} />
          </label>
          <label class="metal-version-field">
            <span>铝价（元/吨）</span>
            <input data-metal-key="${escapeHtml(key)}" data-metal-field="aluminumPrice" type="number" step="100" min="12000" max="30000" value="${snapshot.aluminumPrice}" ${locked ? 'readonly' : ''} />
          </label>
        </div>
        <div class="metal-version-source">${escapeHtml(snapshot.sourceNote)}</div>
      </div>
    `;
  }).join('');
}

function inferMetalVersion(copperPrice, aluminumPrice) {
  const targetCopper = Number(copperPrice);
  const targetAluminum = Number(aluminumPrice);
  const options = BASE.versions.metal || {};
  return Object.keys(options).find((key) => {
    const version = options[key] || {};
    return Number(version.copperPrice) === targetCopper && Number(version.aluminumPrice) === targetAluminum;
  }) || DEFAULT_STATE.metal;
}

function recordMetalVersionKey(record) {
  return record?.state?.metal || inferMetalVersion(record?.draft?.copperPrice, record?.draft?.aluminumPrice);
}

function salesVersionVolumes(versionKey) {
  const version = BASE.versions.sales?.[versionKey];
  return Array.isArray(version?.volumes) && version.volumes.length ? version.volumes : BASE.volumes.slice();
}

function salesVersionAsp(versionKey) {
  const version = BASE.versions.sales?.[versionKey];
  if (Array.isArray(version?.asp) && version.asp.length) {
    return version.asp.map((value) => Number(value) || 0);
  }
  const financialSeries = FINANCIAL_VERSIONS?.versions?.[versionKey]?.asp;
  if (Array.isArray(financialSeries) && financialSeries.length) {
    return financialSeries.map((value) => Number(value) || 0);
  }
  return Array.isArray(BASE.asp) ? BASE.asp.slice() : [];
}

function applySalesVersion(versionKey) {
  const volumes = salesVersionVolumes(versionKey);
  yearInputs.forEach((input, index) => {
    input.value = volumes[index] ?? BASE.volumes[index] ?? 0;
  });
}

function salesVersionStats(versionKey) {
  const volumes = salesVersionVolumes(versionKey);
  return {
    total: volumes.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    firstYear: Math.max(0, Number(volumes[0]) || 0),
  };
}

function inferSalesVersion(volumes) {
  const target = Array.isArray(volumes) ? volumes.map((value) => Math.max(0, Number(value) || 0)) : [];
  const options = BASE.versions.sales || {};
  return Object.keys(options).find((key) => {
    const preset = salesVersionVolumes(key);
    return preset.length === target.length && preset.every((value, index) => Number(value || 0) === Number(target[index] || 0));
  }) || DEFAULT_STATE.sales;
}

function mixVersionValues(versionKey) {
  const version = BASE.versions.mix?.[versionKey];
  return Array.isArray(version?.values) && version.values.length ? normalizeMix(version.values) : BASE.baselineMix.slice();
}

function applyMixVersion(versionKey) {
  const values = mixVersionValues(versionKey);
  mixInputs.forEach((input, index) => {
    input.value = values[index] ?? BASE.baselineMix[index] ?? 0;
  });
}

function mixVersionSummary(versionKey) {
  const values = mixVersionValues(versionKey);
  return values.map((value, index) => `${BASE.configNames[index]} ${Number(value || 0).toFixed(0)}%`).join(' / ');
}

function inferMixVersion(values) {
  const target = Array.isArray(values) ? normalizeMix(values) : [];
  const options = BASE.versions.mix || {};
  return Object.keys(options).find((key) => {
    const preset = mixVersionValues(key);
    return preset.length === target.length && preset.every((value, index) => Number(value || 0) === Number(target[index] || 0));
  }) || DEFAULT_STATE.mix;
}

function seededVersionRecord(group, versionKey) {
  return HISTORY_SEED.find((record) => record?.state?.[group] === versionKey) || null;
}

function bomVersionSnapshot(versionKey) {
  const option = BASE.versions?.bom?.[versionKey] || {};
  if (option.userCreated) {
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('bom', versionKey)}BOM`,
      materialFactor: Number.isFinite(Number(option.factor)) ? Number(option.factor) : 1,
      wireFactor: Number.isFinite(Number(option.wireFactor)) ? Number(option.wireFactor) : 1,
      draft: option.draft || null,
      workbook: option.workbook || '',
      totalMeter: Number(option.totalMeter) || 0,
      wireMeter: Number(option.wireMeter) || 0,
      tapeMeter: Number(option.tapeMeter) || 0,
      tubeMeter: Number(option.tubeMeter) || 0,
      actualLengthChangeSummary: option.actualLengthChangeSummary || null,
      sourceNote: option.sourceNote || '',
    };
  }
  const keyMap = {
    freeze: 'quote',
    light: 'fixed',
    regress: 'tt',
  };
  const snapshotKey = keyMap[versionKey];
  const snapshot = snapshotKey ? BOM_VERSIONS.versionSnapshots?.[snapshotKey] || null : null;
  return {
    kind: snapshot?.kind || snapshotKey || versionKey || '',
    label: snapshot?.label || `${versionOptionLabel('bom', versionKey)}BOM`,
    materialFactor: Number.isFinite(Number(snapshot?.materialFactor)) ? Number(snapshot.materialFactor) : (Number(option.factor) || 1),
    wireFactor: Number.isFinite(Number(snapshot?.wireFactor)) ? Number(snapshot.wireFactor) : 1,
    draft: snapshot?.draft || null,
    workbook: snapshot?.workbook || '',
    totalMeter: Number(snapshot?.totalMeter) || 0,
    wireMeter: Number(snapshot?.wireMeter) || 0,
    tapeMeter: Number(snapshot?.tapeMeter) || 0,
    tubeMeter: Number(snapshot?.tubeMeter) || 0,
    actualLengthChangeSummary: snapshot?.actualLengthChangeSummary || null,
  };
}

function applyBomVersion(versionKey) {
  const snapshot = bomVersionSnapshot(versionKey);
  const draft = snapshot?.draft;
  if (!draft) return;
  if (draft.bomWireDrawing !== null && draft.bomWireDrawing !== undefined) controls.bomWireDrawing.value = draft.bomWireDrawing;
  if (draft.bomWireEat !== null && draft.bomWireEat !== undefined) controls.bomWireEat.value = draft.bomWireEat;
  if (draft.bomWireHidden !== null && draft.bomWireHidden !== undefined) controls.bomWireHidden.value = draft.bomWireHidden;
  if (draft.bomTapeDiameter !== null && draft.bomTapeDiameter !== undefined) controls.bomTapeDiameter.value = draft.bomTapeDiameter;
  if (draft.bomTapeWidth !== null && draft.bomTapeWidth !== undefined) controls.bomTapeWidth.value = draft.bomTapeWidth;
  if (draft.bomTapeOverlap !== null && draft.bomTapeOverlap !== undefined) controls.bomTapeOverlap.value = draft.bomTapeOverlap;
}

function bomVersionSourceText(versionKey) {
  const snapshot = bomVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  const summary = `导线 ${snapshot.wireMeter.toFixed(3)} m / 胶带 ${snapshot.tapeMeter.toFixed(3)} m / 套管 ${snapshot.tubeMeter.toFixed(3)} m / 材料系数 ${((snapshot.materialFactor - 1) * 100).toFixed(1)}%`;
  if (versionKey === 'regress' && snapshot.actualLengthChangeSummary) {
    const change = snapshot.actualLengthChangeSummary;
    return `来源：${snapshot.workbook || 'TT BOM'}《二次物料明细》+ 各线束页实际开线长度回填，${summary}，已回填 ${change.changedHarnessCount} 条线束 / ${change.changedRowCount} 处长度行。`;
  }
  return `来源：${snapshot.workbook || 'BOM 工作簿'}《二次物料明细》，${summary}。`;
}

function laborVersionSnapshot(versionKey) {
  const option = BASE.versions?.labor?.[versionKey] || {};
  if (option.userCreated || Object.prototype.hasOwnProperty.call(option, 'directHours')) {
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('labor', versionKey)}工时`,
      directHours: option.directHours,
      directRate: option.directRate,
      manufacturingHours: option.manufacturingHours,
      manufacturingRate: option.manufacturingRate,
      sourceNote: option.sourceNote || '',
    };
  }
  if (versionKey === 'base') return LABOR_VALIDATION.versionSnapshots?.quote || null;
  if (versionKey === 'optimize') return LABOR_VALIDATION.versionSnapshots?.fixed || null;
  const record = seededVersionRecord('labor', versionKey);
  if (!record?.draft) return null;
  return {
    kind: 'tt',
    label: `${versionOptionLabel('labor', versionKey)}工时`,
    directHours: record.draft.directHours,
    directRate: record.draft.directRate,
    manufacturingHours: record.draft.manufacturingHours,
    manufacturingRate: record.draft.manufacturingRate,
    sourceNote: `来源：g281_data_history.json ${record.id} 试制场景草稿`,
  };
}

function applyLaborVersion(versionKey) {
  const snapshot = laborVersionSnapshot(versionKey);
  if (!snapshot) return;
  if (snapshot.directHours !== null && snapshot.directHours !== undefined) controls.directHours.value = snapshot.directHours;
  if (snapshot.directRate !== null && snapshot.directRate !== undefined) controls.directRate.value = snapshot.directRate;
  if (snapshot.manufacturingHours !== null && snapshot.manufacturingHours !== undefined) controls.manufacturingHours.value = snapshot.manufacturingHours;
  if (snapshot.manufacturingRate !== null && snapshot.manufacturingRate !== undefined) controls.manufacturingRate.value = snapshot.manufacturingRate;
}

function laborVersionSourceText(versionKey) {
  const snapshot = laborVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  if (versionKey === 'base' || versionKey === 'optimize') {
    const directSource = snapshot.sources?.directHours || '';
    const manufacturingSource = snapshot.sources?.manufacturingHours || '';
    return `来源：${directSource}${manufacturingSource ? `；${manufacturingSource}` : ''}`;
  }
  return snapshot.sourceNote || '';
}

function packagingVersionSnapshot(versionKey) {
  const option = BASE.versions?.packaging?.[versionKey] || {};
  if (option.userCreated || Object.prototype.hasOwnProperty.call(option, 'packInner')) {
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('packaging', versionKey)}包装`,
      packInner: option.packInner,
      packFreight: option.packFreight,
      packWarehouse: option.packWarehouse,
      packOther: option.packOther,
      sourceNote: option.sourceNote || '',
    };
  }
  if (versionKey === 'base') return PACKAGING_VALIDATION.versionSnapshots?.quote || null;
  if (versionKey === 'optimize') return PACKAGING_VALIDATION.versionSnapshots?.fixed || null;
  const record = seededVersionRecord('packaging', versionKey);
  if (!record?.draft) return null;
  return {
    kind: 'tt',
    label: `${versionOptionLabel('packaging', versionKey)}包装`,
    packInner: record.draft.packInner,
    packFreight: record.draft.packFreight,
    packWarehouse: record.draft.packWarehouse,
    packOther: record.draft.packOther,
    sourceNote: `来源：g281_data_history.json ${record.id} 试制场景草稿`,
  };
}

function applyPackagingVersion(versionKey) {
  const snapshot = packagingVersionSnapshot(versionKey);
  if (!snapshot) return;
  if (snapshot.packInner !== null && snapshot.packInner !== undefined) controls.packInner.value = snapshot.packInner;
  if (snapshot.packFreight !== null && snapshot.packFreight !== undefined) controls.packFreight.value = snapshot.packFreight;
  if (snapshot.packWarehouse !== null && snapshot.packWarehouse !== undefined) controls.packWarehouse.value = snapshot.packWarehouse;
  if (snapshot.packOther !== null && snapshot.packOther !== undefined) controls.packOther.value = snapshot.packOther;
}

function packagingVersionSourceText(versionKey) {
  return '';
}

function annualDropVersionSourceText(versionKey) {
  const snapshot = annualDropVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  return `来源：版本管理维护。${annualDropSnapshotSummary(snapshot)}。`;
  return `来源：版本管理维护。当前年降 ${fmtPct(snapshot.annualRate || 0)}。`;
}

function oneTimeCustomerVersionSourceText(versionKey) {
  const snapshot = oneTimeCustomerVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  return `来源：版本管理维护。${oneTimeCustomerSnapshotSummary(snapshot)}。`;
  return `来源：版本管理维护。客户一次性费用 ${fmtMoney(snapshot.amountTotal || 0)} 元。`;
}

function rebateVersionSourceText(versionKey) {
  const snapshot = rebateVersionSnapshot(versionKey);
  if (!snapshot) return '';
  if (snapshot.sourceNote) return snapshot.sourceNote;
  return `来源：版本管理维护。${rebateSnapshotSummary(snapshot)}。`;
  return `来源：版本管理维护。返点 ${fmtMoney(snapshot.amountPerSet || 0)} 元/套。`;
}

function equipmentVersionSourceText(versionKey) {
  const snapshot = equipmentVersionSnapshot(versionKey);
  const option = BASE.versions?.equipment?.[versionKey] || {};
  if (snapshot?.sourceNote) {
    return snapshot.sourceNote;
  }
  if (option.userCreated && ['equipment', 'tooling', 'fixtures', 'rnd'].some((key) => option[key] !== undefined && option[key] !== null && option[key] !== '')) {
    return `来源：离线模板版本。设备 ${fmtMoney(snapshot?.equipment || 0)} 元 / 模具 ${fmtMoney(snapshot?.tooling || 0)} 元 / 工装 ${fmtMoney(snapshot?.fixtures || 0)} 元 / 研发 ${fmtMoney(snapshot?.rnd || 0)} 元。`;
  }
  if (option.userCreated) {
    return option.sourceNote || `来源：离线新增版本，当前设备投资系数 ${fmtNumber(Number(option.factor) || 1, 3)}。`;
  }
  const meta = CAPITAL_VALIDATION.meta || {};
  if (versionKey === 'base') {
    return `来源：${meta.quoteWorkbook || '报价核算'}《设备投资明细》《项目专用模具》《项目工装投入》`;
  }
  if (versionKey === 'shared') {
    return `来源：${meta.fixedWorkbook || '定点核算'}《设备投资明细》《项目专用模具》《项目工装投入》`;
  }
  const factor = Number(BASE.versions?.equipment?.[versionKey]?.factor) || 1;
  return `来源：定点版投资汇总 × ${factor.toFixed(2)}，当前 TT 工作簿未包含设备/模具/工装核算页`;
}

function applyConnectorVersion(versionKey) {
  const option = BASE.versions?.connector?.[versionKey];
  if (option?.userCreated) {
    const sourceKey = connectorVersionSet.has(option.sourceKey) ? option.sourceKey : DEFAULT_STATE.connector;
    connectorPricingState = sanitizeConnectorPricing(option.overrides || {}, sourceKey);
    return;
  }
  connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
}

function applyVersionPreset(group, key) {
  if (group === 'bom') {
    applyBomVersion(key);
    dispatchDashboardVersionChange(group, key, {
      bomVersionKey: key,
      workbookVersionKey: resolveWorkbookVersionKeyFromBomState(key),
    });
    return;
  }
  if (group === 'metal') {
    applyMetalVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'connector') {
    applyConnectorVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'sales') {
    applySalesVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'mix') {
    applyMixVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'labor') {
    applyLaborVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'packaging') {
    applyPackagingVersion(key);
    dispatchDashboardVersionChange(group, key);
    return;
  }
  if (group === 'annualDrop' || group === 'oneTimeCustomer' || group === 'rebate' || group === 'equipment' || group === 'configSheet' || group === 'vave') {
    dispatchDashboardVersionChange(group, key);
    return;
  }
}

function sanitizeConnectorPricing(raw = {}, defaultKey = '') {
  return Object.entries(raw || {}).reduce((acc, [itemId, versionKey]) => {
    if (connectorItemIdSet.has(itemId) && connectorVersionSet.has(versionKey) && versionKey !== defaultKey) {
      acc[itemId] = versionKey;
    }
    return acc;
  }, {});
}

function connectorOverrideCount(pricing = {}, defaultKey = state.connector) {
  return Object.keys(sanitizeConnectorPricing(pricing, defaultKey)).length;
}

function connectorStageClass(stageKey) {
  if (stageKey === 'fixed') return 'protocol';
  if (stageKey === 'quote') return 'sample';
  if (stageKey === 'progress') return 'progress';
  return 'batch';
}

function connectorStageMeta(stageKey) {
  return connectorStageMetaMap[stageKey] || connectorStageMetaMap[state.connector] || { label: '跟随默认', note: '' };
}

function recommendedConnectorStage(summary) {
  if (!summary) return '';
  const sourceCount = Number(summary.sourceCount) || 0;
  const confirmed = protocolCount(summary, 'confirmed');
  if (sourceCount && confirmed === sourceCount) return 'fixed';
  if (confirmed > 0) return 'progress';
  return 'quote';
}

function protocolSummaryForItem(itemId) {
  return protocolPortfolioMap.get(itemId) || null;
}

function protocolCount(summary, key) {
  return Number(summary?.statusCounts?.[key]) || 0;
}

function protocolCountPills(summary) {
  return Object.entries(protocolStatusConfig)
    .map(([key, config]) => {
      const count = protocolCount(summary, key);
      if (!count) return '';
      return `<span class="protocol-count-pill ${config.className}">${config.label} ${count}</span>`;
    })
    .filter(Boolean)
    .join('');
}

function protocolCountsInline(summary) {
  return Object.entries(protocolStatusConfig)
    .map(([key, config]) => {
      const count = protocolCount(summary, key);
      return count ? `${config.label} ${count}` : '';
    })
    .filter(Boolean)
    .join(' / ');
}

function protocolRolledUpLabel(summary) {
  if (!summary) return '';
  const sourceCount = Number(summary.sourceCount) || 0;
  const confirmed = protocolCount(summary, 'confirmed');
  const quotedPending = protocolCount(summary, 'quoted_pending');
  const noReply = protocolCount(summary, 'no_reply');
  const devPending = protocolCount(summary, 'dev_pending');
  if (sourceCount && confirmed === sourceCount) return '已达成';
  if (devPending && !quotedPending && !noReply && !confirmed) return '开发中';
  if (quotedPending && !noReply && !devPending && !confirmed) return '待确认';
  if (noReply && !quotedPending && !devPending && !confirmed) return '暂无回复';
  return '部分达成';
}

function protocolReason(summary) {
  if (!summary) return '';
  const recommendedStage = recommendedConnectorStage(summary);
  if (recommendedStage === 'fixed') {
    return '当前映射项已全部达成，可直接按定点版价格执行。';
  }
  if (recommendedStage === 'progress') {
    return '已达成部分按定点版执行，其余部分按报价版执行。';
  }
  if (protocolCount(summary, 'dev_pending')) {
    return '仍有开发中项，初始化先按报价版。';
  }
  if (protocolCount(summary, 'quoted_pending')) {
    return '仍有待确认项，初始化先按报价版。';
  }
  if (protocolCount(summary, 'no_reply')) {
    return '仍有暂无回复项，初始化先按报价版。';
  }
  return '按当前默认版本执行。';
}

function protocolProgressText(item) {
  const confirmedShare = Number(item?.progressMeta?.confirmedShare) || 0;
  const quoteShare = Number(item?.progressMeta?.quoteShare) || 0;
  if (!confirmedShare && !quoteShare) return '';
  return `定点覆盖 ${fmtPct(confirmedShare)} / 报价覆盖 ${fmtPct(quoteShare)}`;
}

function protocolRowsForItem(itemId) {
  return protocolRowsByPortfolio[itemId] || [];
}

function protocolRowDisplayLabel(row) {
  return row?.functionBrief || row?.functionRaw || row?.groupLabel || '';
}

function protocolFunctionLines(itemId) {
  const summary = protocolSummaryForItem(itemId);
  const lines = Array.isArray(summary?.functionBriefs) && summary.functionBriefs.length
    ? summary.functionBriefs
    : protocolRowsForItem(itemId).map((row) => protocolRowDisplayLabel(row));
  return [...new Set(lines.filter((line) => String(line || '').trim()))];
}

function protocolSupplierLabel(itemId, fallback = '') {
  const summary = protocolSummaryForItem(itemId);
  const rows = protocolRowsForItem(itemId);
  const lines = Array.isArray(summary?.supplierNames) && summary.supplierNames.length
    ? summary.supplierNames
    : rows.map((row) => row?.supplierRaw || row?.supplier || '');
  const unique = [...new Set(lines.filter((line) => String(line || '').trim()))];
  return unique.length ? unique.join(' / ') : fallback;
}

function protocolStatusLabel(statusKey, fallback = '') {
  return protocolStatusConfig[statusKey]?.label || fallback || statusKey || '';
}

function protocolAssemblyNo(row) {
  const raw = String(row?.functionRaw || row?.functionBrief || '').trim();
  if (!raw) return row?.partNumber || '-';
  const first = raw.split(' / ')[0].trim();
  return first || raw;
}

function protocolAssemblyMeta(row) {
  const raw = String(row?.functionBrief || row?.functionRaw || '').trim();
  const assemblyNo = protocolAssemblyNo(row);
  if (!raw || !assemblyNo) return '';
  if (!raw.startsWith(assemblyNo)) return raw;
  return raw.slice(assemblyNo.length).replace(/^\s*\/\s*/, '').trim();
}

function renderProtocolPartDetail(row) {
  const partNumber = String(row?.partNumber || '').trim();
  const partName = String(row?.partNameRaw || row?.partName || '').trim();
  const assemblyRemark = String(row?.assemblyRemark || '').trim();
  const customerRemark = String(row?.customerRemark || '').trim();
  const notes = [assemblyRemark, customerRemark].filter(Boolean);
  if (!partNumber && !partName && !notes.length) return '';

  const partLine = [partNumber, partName].filter(Boolean)
    .map((text, index) => `<span class="${index === 0 ? 'connector-part-code' : 'connector-part-name'}">${escapeHtml(text)}</span>`)
    .join('<span class="connector-part-sep">/</span>');
  const noteLine = notes.length
    ? `<div class="connector-part-notes">${notes.map((text) => `<span class="connector-mini-note">${escapeHtml(text)}</span>`).join('')}</div>`
    : '';

  return `<div class="connector-part-detail">
    ${partLine ? `<div class="connector-part-line">${partLine}</div>` : ''}
    ${noteLine}
  </div>`;
}

function protocolRowWeight(row) {
  const targetWeight = Number(row?.targetProtocolPrice);
  if (Number.isFinite(targetWeight) && targetWeight > 0) return targetWeight;
  const replyWeight = Number(row?.replyPrice);
  if (Number.isFinite(replyWeight) && replyWeight > 0) return replyWeight;
  return 1;
}

function protocolRowInitialQuote(row) {
  const initialQuote = Number(row?.initialQuote);
  return Number.isFinite(initialQuote) ? initialQuote : null;
}

function protocolStatusMark(row, statusKey) {
  if (row?.statusKey !== statusKey) {
    return '<span class="connector-check connector-check-empty">-</span>';
  }
  const className = protocolStatusConfig[statusKey]?.className || 'confirmed';
  return `<span class="connector-check connector-check-${className}">✓</span>`;
}

function renderProtocolDetailRows(itemId) {
  const rows = protocolRowsForItem(itemId);
  if (!rows.length) {
    return '<div class="connector-detail-empty">未映射套件状态</div>';
  }
  return `<div class="connector-detail-list">${rows.map((row) => `
    <div class="connector-detail-item">
      <span class="connector-detail-name" title="${escapeHtml(protocolRowDisplayLabel(row))}">${escapeHtml(protocolRowDisplayLabel(row))}</span>
      <span class="protocol-count-pill ${protocolStatusConfig[row.statusKey]?.className || 'blank'}">${escapeHtml(protocolStatusLabel(row.statusKey, row.statusLabel))}</span>
    </div>
  `).join('')}</div>`;
}

function applyConnectorProtocolInitialization() {
  connectorPricingState = protocolPortfolios.reduce((acc, summary) => {
    const itemId = summary?.portfolioId;
    const stageKey = recommendedConnectorStage(summary);
    if (!connectorItemIdSet.has(itemId) || !connectorVersionSet.has(stageKey) || stageKey === state.connector) {
      return acc;
    }
    acc[itemId] = stageKey;
    return acc;
  }, {});
  syncActiveConnectorCustomVersion();
  renderVersions();
  queueRender();
}

function renderConnectorProtocolOverview() {
  if (!el.connectorProtocolStats || !el.connectorProtocolHint) return;
  const summary = PROTOCOL_STATUS.summary || {};
  const recommendationCounts = protocolPortfolios.reduce((acc, item) => {
    const stageKey = recommendedConnectorStage(item);
    if (!stageKey) return acc;
    acc[stageKey] = (acc[stageKey] || 0) + 1;
    return acc;
  }, { fixed: 0, progress: 0, quote: 0 });
  const stats = [
    `协议范围 <strong>${summary.totalRows || 0}</strong> 项`,
    `已达成 <strong>${summary.confirmed || 0}</strong>`,
    `待确认 <strong>${summary.quotedPending || 0}</strong>`,
    `暂无回复 <strong>${summary.noReply || 0}</strong>`,
    `开发中 <strong>${summary.devPending || 0}</strong>`,
    `聚合建议定点版 <strong>${recommendationCounts.fixed || 0}</strong>`,
    `聚合建议进度价 <strong>${recommendationCounts.progress || 0}</strong>`,
    `聚合建议报价版 <strong>${recommendationCounts.quote || 0}</strong>`,
  ];
  stats[0] = `状态明细 <strong>${summary.totalRows || 0}</strong> 项`;
  el.connectorProtocolStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');
  const note = '初始化规则：同一聚合连接器下全部映射项已达成时切定点版；若已有部分达成则切进度价；若仍全部未达成，则先按报价版。下方明细按 Excel 平铺展示，初始报价直接取自当前导入报价核算表的“二次物料明细”，未匹配到对应总成时留空。';
  el.connectorProtocolHint.textContent = note;
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.disabled = !protocolPortfolios.length;
  }
}

function readDraft() {
  connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
  return { scenarioName: el.scenarioName.value.trim() || BASE.name, copperPrice: Number(controls.copperPrice.value) || 0, aluminumPrice: Number(controls.aluminumPrice.value) || 0, directHours: Number(controls.directHours.value) || 0, directRate: Number(controls.directRate.value) || 0, manufacturingHours: Number(controls.manufacturingHours.value) || 0, manufacturingRate: Number(controls.manufacturingRate.value) || 0, packInner: Number(controls.packInner.value) || 0, packFreight: Number(controls.packFreight.value) || 0, packWarehouse: Number(controls.packWarehouse.value) || 0, packOther: Number(controls.packOther.value) || 0, bomWireDrawing: Number(controls.bomWireDrawing.value) || 0, bomWireEat: Number(controls.bomWireEat.value) || 0, bomWireHidden: Number(controls.bomWireHidden.value) || 0, bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0, bomTapeWidth: Number(controls.bomTapeWidth.value) || 0, bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0, connectorPricing: { ...connectorPricingState }, mix: normalizeMix(mixInputs.map((input) => input.value)), volumes: yearInputs.map((input) => Math.max(0, Number(input.value) || 0)), asp: salesVersionAsp(state.sales) };
}
window.readDraft = readDraft;

function calcModel() {
  return window.G281Engine.computeModel(RUNTIME, readDraft(), state);
}

function applyStateSnapshot(snapshot = {}) {
  Object.keys(DEFAULT_STATE).forEach((group) => {
    const nextValue = snapshot[group];
    state[group] = BASE.versions[group][nextValue] ? nextValue : DEFAULT_STATE[group];
  });
}

function applyDraft(draft = {}, fallbackScenarioName = '') {
  const nextDraft = {
    scenarioName: fallbackScenarioName || draft.scenarioName || BASE.name,
    copperPrice: draft.copperPrice ?? BASE.copperPrice,
    aluminumPrice: draft.aluminumPrice ?? BASE.aluminumPrice,
    directHours: draft.directHours ?? BASE.baseDirectHours,
    directRate: draft.directRate ?? BASE.baseDirectRate,
    manufacturingHours: draft.manufacturingHours ?? BASE.baseMfgHours,
    manufacturingRate: draft.manufacturingRate ?? BASE.baseMfgRate,
    packInner: draft.packInner ?? 3.2,
    packFreight: draft.packFreight ?? 4.1,
    packWarehouse: draft.packWarehouse ?? 2.95,
    packOther: draft.packOther ?? 2.3943008441667,
    bomWireDrawing: draft.bomWireDrawing ?? BASE.bomDefaults.wireDrawing,
    bomWireEat: draft.bomWireEat ?? BASE.bomDefaults.wireEat,
    bomWireHidden: draft.bomWireHidden ?? BASE.bomDefaults.wireHidden,
    bomTapeDiameter: draft.bomTapeDiameter ?? BASE.bomDefaults.tapeDiameter,
    bomTapeWidth: draft.bomTapeWidth ?? BASE.bomDefaults.tapeWidth,
    bomTapeOverlap: draft.bomTapeOverlap ?? BASE.bomDefaults.tapeOverlap,
    mix: Array.isArray(draft.mix) && draft.mix.length ? normalizeMix(draft.mix) : BASE.baselineMix.slice(),
    volumes: Array.isArray(draft.volumes) && draft.volumes.length ? draft.volumes.map((value) => Math.max(0, Number(value) || 0)) : BASE.volumes.slice(),
  };
  connectorPricingState = sanitizeConnectorPricing(draft.connectorPricing || {}, state.connector);

  state.scenarioName = nextDraft.scenarioName;
  el.scenarioName.value = nextDraft.scenarioName;
  controls.copperPrice.value = nextDraft.copperPrice;
  controls.aluminumPrice.value = nextDraft.aluminumPrice;
  if (BASE.versions?.metal?.[state.metal]) {
    setMetalVersionValues(
      state.metal,
      {
        copperPrice: nextDraft.copperPrice,
        aluminumPrice: nextDraft.aluminumPrice,
      },
      {
        manualManaged: Object.prototype.hasOwnProperty.call(draft, 'copperPrice') || Object.prototype.hasOwnProperty.call(draft, 'aluminumPrice'),
      },
    );
  }
  controls.directHours.value = nextDraft.directHours;
  controls.directRate.value = nextDraft.directRate;
  controls.manufacturingHours.value = nextDraft.manufacturingHours;
  controls.manufacturingRate.value = nextDraft.manufacturingRate;
  controls.packInner.value = nextDraft.packInner;
  controls.packFreight.value = nextDraft.packFreight;
  controls.packWarehouse.value = nextDraft.packWarehouse;
  controls.packOther.value = nextDraft.packOther;
  controls.bomWireDrawing.value = nextDraft.bomWireDrawing;
  controls.bomWireEat.value = nextDraft.bomWireEat;
  controls.bomWireHidden.value = nextDraft.bomWireHidden;
  controls.bomTapeDiameter.value = nextDraft.bomTapeDiameter;
  controls.bomTapeWidth.value = nextDraft.bomTapeWidth;
  controls.bomTapeOverlap.value = nextDraft.bomTapeOverlap;
  yearInputs.forEach((input, index) => { input.value = nextDraft.volumes[index] ?? BASE.volumes[index]; });
  mixInputs.forEach((input, index) => { input.value = nextDraft.mix[index] ?? BASE.baselineMix[index]; });
}

function historyPreview(record) {
  if (record.summary && Number.isFinite(Number(record.summary.profit))) {
    const paybackYears = record.summary.paybackYears === null || record.summary.paybackYears === '' ? Infinity : Number(record.summary.paybackYears);
    return {
      totalProfit: Number(record.summary.profit) || 0,
      paybackYears,
    };
  }
  return window.G281Engine.computeModel(RUNTIME, record.draft || readDraft(), record.state || state);
}

function loadHistoryRecord(historyId) {
  const record = repo.getHistory().find((item) => item.id === historyId);
  if (!record) return;
  applyStateSnapshot(record.state || {});
  if (!record.state || !record.state.metal) {
    state.metal = recordMetalVersionKey(record);
  }
  if (!record.state || !record.state.sales) {
    state.sales = inferSalesVersion(record.draft?.volumes);
  }
  if (!record.state || !record.state.mix) {
    state.mix = inferMixVersion(record.draft?.mix);
  }
  applyDraft(record.draft || {}, record.scenarioName || record.name || BASE.name);
  lastSavedVersionId = record.id;
  renderVersions();
  render(calcModel());
}
