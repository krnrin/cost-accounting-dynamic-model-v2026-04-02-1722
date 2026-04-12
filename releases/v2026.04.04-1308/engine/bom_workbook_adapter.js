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

  function resolveWorkbook(runtimeInput, versionKey) {
    const runtime = resolveRuntime(runtimeInput);
    const repoWorkbook = runtimeInput && typeof runtimeInput.getBomWorkbookVersion === 'function'
      ? runtimeInput.getBomWorkbookVersion(versionKey || 'quote')
      : null;
    if (repoWorkbook) return repoWorkbook;
    const versions = runtime && runtime.bomWorkbookCopies && runtime.bomWorkbookCopies.versions
      ? runtime.bomWorkbookCopies.versions
      : {};
    return versions[versionKey || 'quote'] || versions.quote || null;
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

  function load(runtimeInput, versionKey, options) {
    const runtime = resolveRuntime(runtimeInput);
    const config = global.ConfigLoader && typeof global.ConfigLoader.active === 'function'
      ? global.ConfigLoader.active()
      : null;
    const safeOptions = options || {};
    const workbook = resolveWorkbook(runtimeInput, versionKey || safeOptions.versionKey || 'quote');
    if (!workbook) {
      return {
        status: 'missing',
        versionKey: versionKey || safeOptions.versionKey || 'quote',
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

    return {
      status: 'ready',
      versionKey: versionKey || safeOptions.versionKey || 'quote',
      workbookName: toText(workbook && workbook.workbookName, ''),
      sections,
      harnesses,
      harnessMap,
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
        Workbook ${escapeHtml(result.versionKey)} / harness sheets ${result.harnesses.length}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
        ${cards}
      </div>
    `;
  }

  global.G281BomWorkbookAdapter = {
    load,
    renderWorkbench,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
