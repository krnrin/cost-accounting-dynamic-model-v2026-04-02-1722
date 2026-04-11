(function (global) {
  'use strict';

  const Shared = global.G281Shared || {};
  const numberOr = Shared.numberOr || ((value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  });
  const safeArray = Shared.safeArray || ((value) => (Array.isArray(value) ? value : []));
  const toText = Shared.toText || ((value, fallback) => {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  });
  const safeObject = Shared.safeObject || ((value) => (value && typeof value === 'object' ? value : {}));

  const STAGE_PRESETS = {
    quote: {
      stageKey: 'quote',
      label: 'Quote',
      financialKey: 'quote',
      bomWorkbookKey: 'quote',
      comparisonKey: 'fixed',
      mode: 'baseline',
    },
    fixed: {
      stageKey: 'fixed',
      label: 'Fixed',
      financialKey: 'fixed',
      bomWorkbookKey: 'fixed',
      comparisonKey: 'quote',
      mode: 'baseline',
    },
    change: {
      stageKey: 'change',
      label: 'Change',
      financialKey: 'fixed',
      bomWorkbookKey: 'fixed',
      comparisonKey: 'quote',
      mode: 'delta',
    },
    annualDrop: {
      stageKey: 'annualDrop',
      label: 'Annual Drop',
      financialKey: 'fixed',
      bomWorkbookKey: 'fixed',
      comparisonKey: 'quote',
      mode: 'lifecycle_delta',
    },
  };

  function escapeHtml(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveRuntime(runtimeInput) {
    if (runtimeInput && runtimeInput.master) return runtimeInput;
    if (runtimeInput && typeof runtimeInput.getRuntime === 'function') return runtimeInput.getRuntime() || {};
    return global.G281_RUNTIME || {};
  }

  function normalizeStageKey(stageKey) {
    const normalized = toText(stageKey, 'quote')
      .replace(/[\s_-]+/g, '')
      .toLowerCase();
    if (!normalized) return 'quote';
    if (normalized === 'quotationbaseline' || normalized === 'quotation' || normalized === 'quotebaseline') return 'quote';
    if (normalized === 'fixedbaseline' || normalized === 'target' || normalized === 'fixedpoint') return 'fixed';
    if (normalized === 'delta' || normalized === 'diff' || normalized === 'changes') return 'change';
    if (normalized === 'annualdrop' || normalized === 'annualreduce' || normalized === 'annualreduction') return 'annualDrop';
    return Object.prototype.hasOwnProperty.call(STAGE_PRESETS, normalized) ? STAGE_PRESETS[normalized].stageKey : 'quote';
  }

  function collectAvailableVersionKeys(runtime) {
    const available = new Set();
    const financialVersions = safeObject(runtime && runtime.financialVersions && runtime.financialVersions.versions);
    const bomVersions = safeObject(runtime && runtime.bomWorkbookCopies && runtime.bomWorkbookCopies.versions);
    Object.keys(financialVersions).forEach((key) => available.add(normalizeStageKey(key)));
    Object.keys(bomVersions).forEach((key) => available.add(normalizeStageKey(key)));
    if (!available.size) {
      available.add('quote');
      available.add('fixed');
    }
    return Array.from(available);
  }

  function pickAvailableKey(availableKeys, preferredKey, fallbackKey) {
    const preferred = normalizeStageKey(preferredKey);
    const fallback = normalizeStageKey(fallbackKey);
    if (availableKeys.includes(preferred)) return preferred;
    if (availableKeys.includes(fallback)) return fallback;
    return availableKeys[0] || 'quote';
  }

  function resolveStageMeta(runtimeInput, stageKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const safeOptions = safeObject(options);
    const requestedStageKey = normalizeStageKey(
      stageKey
      || safeOptions.stageKey
      || safeOptions.baselineKey
      || safeOptions.versionKey
      || 'quote'
    );
    const preset = STAGE_PRESETS[requestedStageKey] || STAGE_PRESETS.quote;
    const availableKeys = collectAvailableVersionKeys(runtime);
    const financialKey = pickAvailableKey(availableKeys, safeOptions.financialKey || preset.financialKey, 'quote');
    const bomWorkbookKey = pickAvailableKey(availableKeys, safeOptions.bomWorkbookKey || safeOptions.versionKey || preset.bomWorkbookKey, financialKey);
    const comparisonKey = safeOptions.comparisonKey
      ? pickAvailableKey(availableKeys, safeOptions.comparisonKey, preset.comparisonKey)
      : pickAvailableKey(
        availableKeys.filter((key) => key !== financialKey),
        preset.comparisonKey,
        financialKey === 'quote' ? 'fixed' : 'quote'
      );

    return {
      requestedStageKey,
      stageKey: preset.stageKey,
      label: preset.label,
      mode: preset.mode,
      financialKey,
      bomWorkbookKey,
      comparisonKey,
      hasComparison: Boolean(comparisonKey && comparisonKey !== financialKey),
      usesDelta: preset.mode !== 'baseline',
      availableKeys,
    };
  }

  function resolveWorkbook(runtimeInput, versionKey) {
    const runtime = resolveRuntime(runtimeInput);
    const stageMeta = resolveStageMeta(runtimeInput, versionKey);
    const resolvedVersionKey = stageMeta.bomWorkbookKey;
    const repoWorkbook = runtimeInput && typeof runtimeInput.getBomWorkbookVersion === 'function'
      ? runtimeInput.getBomWorkbookVersion(resolvedVersionKey || 'quote')
      : null;
    if (repoWorkbook) return repoWorkbook;
    const versions = runtime && runtime.bomWorkbookCopies && runtime.bomWorkbookCopies.versions
      ? runtime.bomWorkbookCopies.versions
      : {};
    return versions[resolvedVersionKey || 'quote'] || versions.quote || null;
  }

  function inferRole(sheetName, config) {
    const normalized = toText(sheetName, '').toLowerCase();
    const configuredRoles = safeArray(config && config.bom && config.bom.sheetRoleMap);
    const configuredMatch = configuredRoles.find((entry) => {
      const keyword = toText(entry && entry.matchKeyword, '').toLowerCase();
      const pattern = toText(entry && entry.matchPattern, '');
      if (keyword && normalized.includes(keyword)) return true;
      if (pattern) {
        try {
          return new RegExp(pattern).test(sheetName);
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    if (configuredMatch) return toText(configuredMatch.role, 'sheet');
    if (/^\d{6,}/.test(normalized)) return 'harness';
    if (normalized.includes('总成') || normalized.includes('散件')) return 'assembly_parts';
    if (normalized.includes('二次')) return 'secondary_materials';
    if (normalized.includes('变更')) return 'change_history';
    if (normalized.includes('ksk')) return 'ksk_detail';
    return 'sheet';
  }

  function buildCellGrid(sheet) {
    const rowMap = new Map();
    safeArray(sheet && sheet.cells).forEach((cell) => {
      const rowKey = numberOr(cell && cell.row, 0);
      const columnKey = numberOr(cell && cell.column, 0);
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, new Map());
      rowMap.get(rowKey).set(columnKey, cell);
    });
    return rowMap;
  }

  function displayCell(cell) {
    if (!cell) return '';
    const numeric = Number(cell.numericValue);
    if (Number.isFinite(numeric)) return numeric;
    return toText(cell.value || cell.formattedValue || cell.formula || '', '');
  }

  function previewRows(sheet, rowLimit, columnLimit) {
    const grid = buildCellGrid(sheet);
    const rows = [];
    const maxRows = numberOr(sheet && sheet.maxRow, 0);
    for (let rowNumber = 1; rowNumber <= Math.min(maxRows || rowLimit, rowLimit); rowNumber += 1) {
      const row = [];
      for (let columnNumber = 1; columnNumber <= columnLimit; columnNumber += 1) {
        row.push(displayCell(grid.get(rowNumber) && grid.get(rowNumber).get(columnNumber)));
      }
      if (row.some((value) => toText(value, '') !== '')) rows.push({ rowNumber, cells: row });
    }
    return rows;
  }

  function matchesSheetMapping(sheetName, mapping) {
    if (!mapping) return false;
    const value = toText(mapping.matchValue || mapping.matchText || mapping.sheetName, '');
    if (!value) return false;
    const strategy = toText(mapping.matchStrategy, 'keyword');
    const normalizedSheet = toText(sheetName, '').toLowerCase();
    const normalizedValue = value.toLowerCase();
    if (strategy === 'exact') return normalizedSheet === normalizedValue;
    if (strategy === 'pattern') {
      try {
        return new RegExp(value).test(sheetName || '');
      } catch (error) {
        return false;
      }
    }
    return normalizedValue && normalizedSheet.includes(normalizedValue);
  }

  function buildSheetBindings(sections, config) {
    const mappings = safeArray(config && config.sheetMappings);
    return mappings.map((mapping) => {
      const matches = sections.filter((section) => matchesSheetMapping(section.sheetName, mapping));
      return {
        id: mapping.id,
        workbookRole: mapping.workbookRole,
        sheetRole: mapping.sheetRole,
        matchStrategy: mapping.matchStrategy,
        matchValue: mapping.matchValue,
        matchText: mapping.matchText,
        matches: matches.map((section) => ({
          sheetName: section.sheetName,
          role: section.role,
          rowCount: section.rowCount,
          columnCount: section.columnCount,
          previewRows: section.previewRows,
        })),
      };
    });
  }

  function buildCoverageSummary(sections, harnesses, sheetBindings) {
    const matchedBindings = safeArray(sheetBindings).filter((binding) => safeArray(binding.matches).length > 0);
    return {
      totalSheets: sections.length,
      harnessSheets: harnesses.length,
      totalBindings: safeArray(sheetBindings).length,
      matchedBindings: matchedBindings.length,
      unmatchedBindings: safeArray(sheetBindings).length - matchedBindings.length,
      bindingDetails: safeArray(sheetBindings).map((binding) => ({
        id: binding.id,
        sheetRole: binding.sheetRole,
        matchCount: safeArray(binding.matches).length,
      })),
    };
  }

  function load(runtimeInput, versionKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const config = global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
    const safeOptions = options || {};
    const stageMeta = resolveStageMeta(runtimeInput, versionKey || safeOptions.versionKey || safeOptions.stageKey, safeOptions);
    const workbook = resolveWorkbook(runtimeInput, stageMeta.stageKey);
    if (!workbook) {
      return {
        status: 'missing',
        stageKey: stageMeta.stageKey,
        requestedStageKey: stageMeta.requestedStageKey,
        versionKey: stageMeta.bomWorkbookKey,
        stageMeta,
        sections: [],
        harnesses: [],
        harnessMap: {},
      };
    }

    const sections = safeArray(workbook.sheets).map((sheet, index) => {
      const sheetName = toText(sheet && sheet.sheetName, `sheet-${index + 1}`);
      const role = inferRole(sheetName, config);
      const section = {
        sheetName,
        role,
        sheetOrderKey: toText(sheet && sheet.sheetOrderKey, ''),
        hidden: Boolean(sheet && sheet.isHidden),
        workbookSheetIndex: numberOr(sheet && sheet.workbookSheetIndex, index),
        rowCount: numberOr(sheet && sheet.maxRow, 0),
        columnCount: numberOr(sheet && sheet.maxColumn, 0),
        previewRows: previewRows(sheet, numberOr(safeOptions.previewRowLimit, 8), numberOr(safeOptions.previewColumnLimit, 8)),
      };
      if (role === 'harness') {
        section.harnessId = sheetName.match(/\d{6,}/) ? sheetName.match(/\d{6,}/)[0] : sheetName;
      }
      return section;
    });

    const harnesses = sections.filter((section) => section.role === 'harness');
    const harnessMap = harnesses.reduce((accumulator, section) => {
      accumulator[section.harnessId] = section;
      return accumulator;
    }, {});
    const sheetBindings = buildSheetBindings(sections, config);
    const coverageSummary = buildCoverageSummary(sections, harnesses, sheetBindings);

    return {
      status: 'ready',
      stageKey: stageMeta.stageKey,
      requestedStageKey: stageMeta.requestedStageKey,
      versionKey: stageMeta.bomWorkbookKey,
      stageMeta,
      workbookName: toText(workbook && workbook.workbookName, ''),
      sections,
      harnesses,
      harnessMap,
      sheetBindings,
      coverageSummary,
    };
  }

  function renderWorkbench(container, snapshot, options) {
    if (!container) return;
    const result = snapshot && snapshot.sections ? snapshot : load(options && options.runtime, options && options.versionKey, options);
    if (!result || result.status !== 'ready') {
      container.innerHTML = '<div class="bom-workbench-empty">No BOM workbook snapshot available.</div>';
      return;
    }

    const cards = result.sections.map((section) => {
      const preview = safeArray(section.previewRows).slice(0, 4).map((row) => {
        const cells = row.cells.map((value) => `<td>${escapeHtml(value)}</td>`).join('');
        return `<tr><th>${row.rowNumber}</th>${cells}</tr>`;
      }).join('');
      return `
        <article style="border:1px solid #2a2a3e;border-radius:8px;padding:12px;background:#111125;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <strong>${escapeHtml(section.sheetName)}</strong>
            <span style="font-size:11px;color:#9ca3af;">${escapeHtml(section.role)}</span>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#9ca3af;">rows ${section.rowCount} / cols ${section.columnCount}</div>
          <div style="overflow:auto;margin-top:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <tbody>${preview}</tbody>
            </table>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:8px;font-size:12px;color:#9ca3af;">
        Stage ${escapeHtml(result.stageKey || result.versionKey)} / workbook ${escapeHtml(result.versionKey)} / harness sheets ${result.harnesses.length}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
        ${cards}
      </div>
    `;
  }

  global.G281BomWorkbookAdapter = {
    load,
    renderWorkbench,
    normalizeStageKey,
    resolveRuntime,
    resolveStageMeta,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
