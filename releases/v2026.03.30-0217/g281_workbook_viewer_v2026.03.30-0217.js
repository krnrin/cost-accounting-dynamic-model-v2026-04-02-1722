(function (global) {
  'use strict';

  const runtime = global.G281_RUNTIME || {};
  if (!runtime.bomWorkbookCopies?.versions && !runtime.configSheetCopies?.versions) {
    return;
  }

  const DEFAULT_VERSION_LABELS = { quote: '报价版', fixed: '定点版', tt: 'TT版' };
  const THEME_COLORS = {
    0: '#ffffff',
    1: '#000000',
    2: '#e7e6e6',
    3: '#44546a',
    4: '#5b9bd5',
    5: '#ed7d31',
    6: '#a5a5a5',
    7: '#ffc000',
    8: '#4472c4',
    9: '#70ad47',
  };
  const INDEXED_COLORS = {
    0: '#000000',
    1: '#ffffff',
    8: '#000000',
    9: '#ffffff',
    22: '#c0c0c0',
    64: 'transparent',
  };
  const BORDER_WIDTHS = {
    hair: '1px',
    thin: '1px',
    medium: '2px',
    thick: '3px',
    double: '3px',
    dashed: '1px',
    dotted: '1px',
    dashDot: '1px',
    dashDotDot: '1px',
    mediumDashed: '2px',
    mediumDashDot: '2px',
    mediumDashDotDot: '2px',
    slantDashDot: '2px',
  };

  const viewerState = {
    datasetKey: 'bom',
    versionKey: '',
    sheetName: '',
    lastFocused: null,
    ownsBodyLock: false,
  };

  function bridgeVersionLabels() {
    return global.G281DashboardBridge?.getVersionLabels?.() || DEFAULT_VERSION_LABELS;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
  }

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function colLettersToNumber(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) return 0;
    let result = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code < 65 || code > 90) continue;
      result = result * 26 + (code - 64);
    }
    return result;
  }

  function columnLabel(index) {
    let next = Number(index);
    let label = '';
    while (next > 0) {
      const offset = (next - 1) % 26;
      label = String.fromCharCode(65 + offset) + label;
      next = Math.floor((next - 1) / 26);
    }
    return label || 'A';
  }

  function parseCellRef(ref) {
    const match = String(ref || '').trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return {
      col: colLettersToNumber(match[1]),
      row: Number(match[2]),
    };
  }

  function parseRangeRef(ref) {
    const parts = String(ref || '').split(':');
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1] || parts[0]);
    if (!start || !end) return null;
    return {
      startRow: Math.min(start.row, end.row),
      endRow: Math.max(start.row, end.row),
      startCol: Math.min(start.col, end.col),
      endCol: Math.max(start.col, end.col),
    };
  }

  function sanitizePrimitive(value) {
    if (typeof value === 'string' && value.includes('Values must be of type')) {
      return null;
    }
    return value;
  }

  function normalizeRgb(rgb) {
    const text = String(sanitizePrimitive(rgb) || '').trim().replace(/^#/, '');
    if (!/^[0-9A-Fa-f]{6,8}$/.test(text)) return '';
    return `#${text.slice(-6)}`;
  }

  function tintColor(hex, tint) {
    if (!hex || !isFiniteNumber(tint)) return hex;
    const amount = Number(tint);
    if (!amount) return hex;
    const channels = hex.replace('#', '').match(/.{1,2}/g)?.map((item) => parseInt(item, 16)) || [];
    if (channels.length !== 3) return hex;
    const tinted = channels.map((channel) => {
      if (amount < 0) {
        return Math.round(channel * (1 + amount));
      }
      return Math.round(channel * (1 - amount) + 255 * amount);
    });
    return `#${tinted.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  function colorToCss(color, fallback = 'transparent') {
    if (!color || typeof color !== 'object') return fallback;
    const rgb = normalizeRgb(color.rgb);
    if (rgb) {
      return tintColor(rgb, sanitizePrimitive(color.tint));
    }
    const theme = sanitizePrimitive(color.theme);
    if (theme !== null && theme !== undefined && THEME_COLORS[theme] !== undefined) {
      return tintColor(THEME_COLORS[theme], sanitizePrimitive(color.tint));
    }
    const indexed = sanitizePrimitive(color.indexed);
    if (indexed !== null && indexed !== undefined && INDEXED_COLORS[indexed] !== undefined) {
      return INDEXED_COLORS[indexed];
    }
    if (color.auto) return fallback === 'transparent' ? '#0f172a' : fallback;
    return fallback;
  }

  function fillToCss(fill, fallback = 'transparent') {
    if (!fill || typeof fill !== 'object') return fallback;
    const fillType = String(fill.fillType || fill.patternType || '').trim().toLowerCase();
    if (!fillType || fillType === 'none' || fillType === 'gray125') {
      return fallback;
    }
    const foreground = fill.fgColor || null;
    const background = fill.bgColor || null;
    const fgRaw = String(sanitizePrimitive(foreground?.rgb) || '').trim().replace(/^#/, '');
    if (/^[0-9A-Fa-f]{8}$/.test(fgRaw) && fgRaw.slice(0, 2) === '00') {
      const bgCss = colorToCss(background, '');
      return bgCss || fallback;
    }
    const fgCss = colorToCss(foreground, '');
    if (fgCss) return fgCss;
    const bgCss = colorToCss(background, '');
    return bgCss || fallback;
  }

  function borderToCss(side) {
    if (!side?.style) return '';
    const width = BORDER_WIDTHS[side.style] || '1px';
    const style = side.style === 'double' ? 'double' : side.style === 'dotted' ? 'dotted' : side.style.includes('dash') ? 'dashed' : 'solid';
    const color = colorToCss(side.color, '#cbd5e1');
    return `${width} ${style} ${color}`;
  }

  function styleToCss(style) {
    if (!style) return {};
    const font = style.font || {};
    const fill = style.fill || {};
    const alignment = style.alignment || {};
    const border = style.border || {};
    return {
      color: colorToCss(font.color, '#0f172a'),
      background: fillToCss(fill, 'transparent'),
      fontFamily: font.name ? `'${String(font.name).replace(/'/g, "\\'")}', "Microsoft YaHei UI", sans-serif` : '',
      fontSize: isFiniteNumber(font.size) ? `${Number(font.size)}pt` : '',
      fontWeight: font.bold ? '700' : '',
      fontStyle: font.italic ? 'italic' : '',
      textDecoration: [font.underline ? 'underline' : '', font.strike ? 'line-through' : ''].filter(Boolean).join(' '),
      textAlign: alignment.horizontal || '',
      verticalAlign: alignment.vertical === 'center' ? 'middle' : (alignment.vertical || ''),
      whiteSpace: alignment.wrapText ? 'pre-wrap' : 'nowrap',
      borderTop: borderToCss(border.top),
      borderRight: borderToCss(border.right),
      borderBottom: borderToCss(border.bottom),
      borderLeft: borderToCss(border.left),
    };
  }

  function expandColumnDimensions(raw) {
    const map = {};
    Object.values(raw || {}).forEach((entry) => {
      const min = Number(entry?.min) || 0;
      const max = Number(entry?.max) || min;
      for (let column = min; column <= max; column += 1) {
        map[column] = entry;
      }
    });
    return map;
  }

  function expandRowDimensions(raw) {
    const map = {};
    Object.values(raw || {}).forEach((entry) => {
      const row = Number(entry?.row || entry?.r || 0);
      if (row > 0) {
        map[row] = entry;
      }
    });
    return map;
  }

  function cellDisplayValue(cell) {
    const primary = cell?.displayValue ?? cell?.value;
    if (primary === null || primary === undefined) return '';
    return String(primary);
  }

  function cellTitle(cell) {
    const parts = [];
    if (cell?.formula) parts.push(`公式: ${cell.formula}`);
    if (cell?.comment) parts.push(`批注: ${cell.comment}`);
    if (cell?.hyperlink) parts.push(`链接: ${cell.hyperlink}`);
    return parts.join('\n');
  }

  function pxWidth(columnEntry, fallback = 96) {
    const width = Number(columnEntry?.width);
    if (!Number.isFinite(width) || width <= 0) return fallback;
    return Math.max(40, Math.round(width * 7 + 10));
  }

  function pxHeight(rowEntry, fallback = 24) {
    const height = Number(rowEntry?.height);
    if (!Number.isFinite(height) || height <= 0) return fallback;
    return Math.max(20, Math.round(height * 1.35));
  }

  function buildCellMap(cells) {
    return toArray(cells).reduce((map, cell) => {
      const row = Number(cell?.row || cell?.r || 0);
      const col = Number(cell?.column || cell?.c || 0);
      if (row > 0 && col > 0) {
        map.set(`${row}:${col}`, cell);
      }
      return map;
    }, new Map());
  }

  function buildMergeMaps(ranges) {
    const starts = new Map();
    const covered = new Set();
    toArray(ranges).forEach((rangeRef) => {
      const range = typeof rangeRef === 'string' ? parseRangeRef(rangeRef) : rangeRef;
      if (!range) return;
      starts.set(`${range.startRow}:${range.startCol}`, {
        rowSpan: range.endRow - range.startRow + 1,
        colSpan: range.endCol - range.startCol + 1,
      });
      for (let row = range.startRow; row <= range.endRow; row += 1) {
        for (let col = range.startCol; col <= range.endCol; col += 1) {
          if (row === range.startRow && col === range.startCol) continue;
          covered.add(`${row}:${col}`);
        }
      }
    });
    return { starts, covered };
  }

  function normalizeBomDataset() {
    const source = runtime.bomWorkbookCopies;
    const versions = Object.entries(source?.versions || {}).reduce((acc, [versionKey, version]) => {
      acc[versionKey] = {
        key: versionKey,
        label: bridgeVersionLabels()[versionKey] || versionKey,
        sourceFileName: version.sourceFileName || '',
        styleMap: clonePlain(version.styleTable, {}),
        sheets: toArray(version.sheets).map((sheet) => ({
          sheetName: sheet.sheetName,
          maxRow: Number(sheet.maxRow) || 0,
          maxColumn: Number(sheet.maxColumn) || 0,
          freezePane: parseCellRef(sheet.freezePane),
          rowDimensions: expandRowDimensions(sheet.rowDimensions),
          columnDimensions: expandColumnDimensions(sheet.columnDimensions),
          mergedRanges: toArray(sheet.mergedRanges),
          cells: toArray(sheet.cells),
        })),
      };
      return acc;
    }, {});
    return {
      key: 'bom',
      label: 'BOM整表',
      versions,
      versionOrder: toArray(source?.versionOrder),
    };
  }

  function normalizeConfigDataset() {
    const source = runtime.configSheetCopies;
    const versions = Object.entries(source?.versions || {}).reduce((acc, [versionKey, version]) => {
      const snapshot = version.snapshot || {};
      acc[versionKey] = {
        key: versionKey,
        label: bridgeVersionLabels()[versionKey] || versionKey,
        sourceFileName:
          version.sourceFileName
          || version.fileName
          || version.file
          || version.workbook
          || (version.workbookPath ? String(version.workbookPath).split(/[\\/]/).pop() : '')
          || source?.meta?.workbooks?.[versionKey]
          || '',
        styleMap: clonePlain(snapshot.stylePool, {}),
        sheets: [{
          sheetName: snapshot.sheetName || '配置清单',
          maxRow: Number(snapshot.maxRow) || 0,
          maxColumn: Number(snapshot.maxColumn) || 0,
          freezePane: parseCellRef(snapshot.freezePanes),
          rowDimensions: expandRowDimensions(snapshot.rowDimensions),
          columnDimensions: expandColumnDimensions(snapshot.columnDimensions),
          mergedRanges: toArray(snapshot.mergedRanges),
          cells: toArray(snapshot.cells).map((cell) => ({
            row: cell.r,
            column: cell.c,
            address: cell.addr,
            dataType: cell.type,
            styleId: cell.styleId,
            value: cell.value,
            formula: cell.formula,
            hyperlink: cell.hyperlink,
            comment: cell.comment,
            displayValue: cell.displayValue,
          })),
        }],
      };
      return acc;
    }, {});
    return {
      key: 'config',
      label: '配置清单',
      versions,
      versionOrder: Object.keys(versions),
    };
  }

  const datasets = {
    bom: normalizeBomDataset(),
    config: normalizeConfigDataset(),
  };

  function availableDatasetKeys() {
    return Object.values(datasets)
      .filter((dataset) => Object.keys(dataset.versions || {}).length)
      .map((dataset) => dataset.key);
  }

  function ensureToolbarButtons() {
    const toolbar = document.querySelector('#bomValidationModal .bom-validate-toolbar');
    if (!toolbar) return;

    const definitions = [
      { id: 'openBomWorkbookViewerBtn', label: '查看当前 BOM 整表', datasetKey: 'bom' },
      { id: 'openConfigWorkbookViewerBtn', label: '查看 配置清单', datasetKey: 'config' },
    ];

    definitions.forEach((definition) => {
      if (document.getElementById(definition.id)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = definition.id;
      button.className = 'button ghost';
      button.dataset.viewerDataset = definition.datasetKey;
      button.textContent = definition.label;
      toolbar.insertBefore(button, document.getElementById('resetBomValidationBtn') || null);
    });
  }

  function ensureModal() {
    let modal = document.getElementById('workbookViewerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'bom-modal';
    modal.id = 'workbookViewerModal';
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="bom-modal-backdrop" data-workbook-viewer-close></div>
      <section class="bom-modal-panel workbook-viewer-panel" role="dialog" aria-modal="true" aria-labelledby="workbookViewerTitle">
        <div class="bom-modal-head">
          <div>
            <div class="eyebrow">Workbook Viewer</div>
            <h3 id="workbookViewerTitle">Excel 整表查看</h3>
            <p class="section-note">用于按原始 Excel 结构查看 BOM 整表和配置清单，保留合并单元格、行列宽高、基本样式和公式提示。</p>
          </div>
          <div class="bom-validate-toolbar workbook-viewer-toolbar">
            <label class="field">
              <span>数据分类</span>
              <select id="workbookViewerDataset"></select>
            </label>
            <label class="field">
              <span>版本</span>
              <select id="workbookViewerVersion"></select>
            </label>
            <label class="field">
              <span>Sheet</span>
              <select id="workbookViewerSheet"></select>
            </label>
            <button class="button ghost bom-close-btn" id="closeWorkbookViewerBtn" type="button">关闭</button>
          </div>
        </div>
        <div class="bom-validate-summary workbook-viewer-summary" id="workbookViewerSummary"></div>
        <p class="bom-validate-hint" id="workbookViewerHint"></p>
        <div class="workbook-viewer-shell" id="workbookViewerCanvas"></div>
      </section>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  const modal = ensureModal();
  const datasetSelect = modal.querySelector('#workbookViewerDataset');
  const versionSelect = modal.querySelector('#workbookViewerVersion');
  const sheetSelect = modal.querySelector('#workbookViewerSheet');
  const summaryEl = modal.querySelector('#workbookViewerSummary');
  const hintEl = modal.querySelector('#workbookViewerHint');
  const canvasEl = modal.querySelector('#workbookViewerCanvas');

  function resolveDefaultVersionKey(datasetKey) {
    const preferred = global.G281DashboardBridge?.getWorkbookVersionKey?.();
    if (preferred && datasets[datasetKey]?.versions?.[preferred]) {
      return preferred;
    }
    return datasets[datasetKey]?.versionOrder?.find((key) => datasets[datasetKey]?.versions?.[key])
      || Object.keys(datasets[datasetKey]?.versions || {})[0]
      || '';
  }

  function currentVersion() {
    return datasets[viewerState.datasetKey]?.versions?.[viewerState.versionKey] || null;
  }

  function currentSheet() {
    return currentVersion()?.sheets?.find((sheet) => sheet.sheetName === viewerState.sheetName) || currentVersion()?.sheets?.[0] || null;
  }

  function resolveDefaultSheetName(datasetKey, versionKey, preferredSheetName = '') {
    const sheets = datasets[datasetKey]?.versions?.[versionKey]?.sheets || [];
    const hasSheet = (sheetName) => sheetName && sheets.some((sheet) => sheet.sheetName === sheetName);
    const activeHarnessSheet = document.getElementById('bomValidationHarness')?.value || '';
    const candidates = [
      preferredSheetName,
      datasetKey === 'bom' ? activeHarnessSheet : '',
      datasetKey === 'bom' ? '二次物料明细' : '',
      datasetKey === 'config' ? '配置清单' : '',
    ];
    return candidates.find(hasSheet) || sheets[0]?.sheetName || '';
  }

  function populateDatasetSelect() {
    const keys = availableDatasetKeys();
    datasetSelect.innerHTML = keys.map((key) => `<option value="${key}">${escapeHtml(datasets[key].label)}</option>`).join('');
    if (!keys.includes(viewerState.datasetKey)) {
      viewerState.datasetKey = keys[0] || 'bom';
    }
    datasetSelect.value = viewerState.datasetKey;
  }

  function populateVersionSelect() {
    const versionEntries = Object.values(datasets[viewerState.datasetKey]?.versions || {});
    versionSelect.innerHTML = versionEntries
      .map((version) => `<option value="${version.key}">${escapeHtml(version.label)}</option>`)
      .join('');
    if (!datasets[viewerState.datasetKey]?.versions?.[viewerState.versionKey]) {
      viewerState.versionKey = resolveDefaultVersionKey(viewerState.datasetKey);
    }
    versionSelect.value = viewerState.versionKey;
  }

  function populateSheetSelect() {
    const version = currentVersion();
    const sheets = version?.sheets || [];
    sheetSelect.innerHTML = sheets.map((sheet) => `<option value="${escapeHtml(sheet.sheetName)}">${escapeHtml(sheet.sheetName)}</option>`).join('');
    if (!sheets.find((sheet) => sheet.sheetName === viewerState.sheetName)) {
      viewerState.sheetName = sheets[0]?.sheetName || '';
    }
    sheetSelect.value = viewerState.sheetName;
  }

  function setModalOpen(open) {
    if (open) {
      viewerState.lastFocused = document.activeElement;
      viewerState.ownsBodyLock = !document.body.classList.contains('bom-modal-open');
      if (viewerState.ownsBodyLock) {
        document.body.classList.add('bom-modal-open');
      }
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      return;
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (viewerState.ownsBodyLock) {
      document.body.classList.remove('bom-modal-open');
    }
    viewerState.ownsBodyLock = false;
    if (viewerState.lastFocused && typeof viewerState.lastFocused.focus === 'function') {
      viewerState.lastFocused.focus();
    }
  }

  function styleText(styleMap, styleId) {
    const entry = styleMap?.[styleId];
    const css = styleToCss(entry);
    return Object.entries(css)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`)
      .join(';');
  }

  function renderSummary(dataset, version, sheet) {
    const freeze = sheet?.freezePane ? `${columnLabel(sheet.freezePane.col)}${sheet.freezePane.row}` : '无冻结';
    const chip = (label, value) => `<span class="chip"><span class="dot alt"></span><span>${escapeHtml(label)}：${escapeHtml(value)}</span></span>`;
    summaryEl.innerHTML = [
      chip('分类', dataset.label),
      chip('版本', version.label),
      chip('来源', version.sourceFileName || '-'),
      chip('Sheet', sheet.sheetName || '-'),
      chip('尺寸', `${sheet.maxRow} × ${sheet.maxColumn}`),
      chip('冻结', freeze),
    ].join('');
    hintEl.textContent = '公式单元格会在标题提示中显示原公式；当前版本为整表只读查看，用于核对导入结果和格式完整性。';
  }

  function renderTable(sheet, version) {
    if (!sheet) {
      canvasEl.innerHTML = '<div class="workbook-viewer-empty">当前没有可展示的工作表。</div>';
      return;
    }

    const cellMap = buildCellMap(sheet.cells);
    const { starts, covered } = buildMergeMaps(sheet.mergedRanges);
    const rowDimensions = sheet.rowDimensions || {};
    const columnDimensions = sheet.columnDimensions || {};
    const freezeRow = Number(sheet.freezePane?.row) || 1;
    const freezeCol = Number(sheet.freezePane?.col) || 1;

    let html = '<div class="workbook-viewer-table-wrap"><table class="workbook-grid"><colgroup>';
    html += '<col class="workbook-grid-index-col" />';
    for (let col = 1; col <= sheet.maxColumn; col += 1) {
      const width = pxWidth(columnDimensions[col], 96);
      html += `<col style="width:${width}px" />`;
    }
    html += '</colgroup><thead><tr><th class="workbook-grid-corner"></th>';
    for (let col = 1; col <= sheet.maxColumn; col += 1) {
      const className = col < freezeCol ? ' is-frozen-col' : '';
      html += `<th class="workbook-grid-col${className}">${columnLabel(col)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let row = 1; row <= sheet.maxRow; row += 1) {
      const rowHeight = pxHeight(rowDimensions[row], 24);
      const rowClass = row < freezeRow ? ' is-frozen-row' : '';
      html += `<tr style="height:${rowHeight}px"><th class="workbook-grid-row${rowClass}">${row}</th>`;
      for (let col = 1; col <= sheet.maxColumn; col += 1) {
        const key = `${row}:${col}`;
        if (covered.has(key)) continue;

        const merge = starts.get(key);
        const cell = cellMap.get(key);
        const styleAttr = cell ? styleText(version.styleMap, cell.styleId) : '';
        const classes = [
          'workbook-grid-cell',
          row < freezeRow ? 'is-frozen-row' : '',
          col < freezeCol ? 'is-frozen-col' : '',
          cell?.formula ? 'is-formula' : '',
        ].filter(Boolean).join(' ');
        const title = cellTitle(cell);
        const value = cellDisplayValue(cell);
        const content = cell?.hyperlink && value
          ? `<a class="workbook-cell-link" href="${escapeHtml(cell.hyperlink)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`
          : escapeHtml(value);
        const rowspan = merge ? ` rowspan="${merge.rowSpan}"` : '';
        const colspan = merge ? ` colspan="${merge.colSpan}"` : '';
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const styleHtml = styleAttr ? ` style="${styleAttr}"` : '';
        html += `<td class="${classes}"${rowspan}${colspan}${titleAttr}${styleHtml}>${content || '&nbsp;'}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    canvasEl.innerHTML = html;
  }

  function renderCurrentSheet() {
    const dataset = datasets[viewerState.datasetKey];
    const version = currentVersion();
    const sheet = currentSheet();
    if (!dataset || !version || !sheet) {
      canvasEl.innerHTML = '<div class="workbook-viewer-empty">当前没有可展示的数据。</div>';
      summaryEl.innerHTML = '';
      hintEl.textContent = '未找到对应的数据版本，请先检查 BOM/配置清单复制 JSON 是否已生成并打包。';
      return;
    }
    renderSummary(dataset, version, sheet);
    renderTable(sheet, version);
  }

  function syncSelectors() {
    populateDatasetSelect();
    populateVersionSelect();
    populateSheetSelect();
    renderCurrentSheet();
  }

  function openViewer(options = {}) {
    const normalized = typeof options === 'string' ? { datasetKey: options } : (options || {});
    viewerState.datasetKey = datasets[normalized.datasetKey]?.versions ? normalized.datasetKey : availableDatasetKeys()[0] || 'bom';
    viewerState.versionKey = normalized.versionKey && datasets[viewerState.datasetKey]?.versions?.[normalized.versionKey]
      ? normalized.versionKey
      : resolveDefaultVersionKey(viewerState.datasetKey);
    viewerState.sheetName = resolveDefaultSheetName(viewerState.datasetKey, viewerState.versionKey, normalized.sheetName || '');
    syncSelectors();
    setModalOpen(true);
  }

  function bindEvents() {
    ensureToolbarButtons();
    document.addEventListener('click', (event) => {
      const openButton = event.target.closest('[data-viewer-dataset]');
      if (openButton) {
        openViewer({
          datasetKey: openButton.dataset.viewerDataset,
          versionKey: openButton.dataset.viewerVersion || '',
          sheetName: openButton.dataset.viewerSheet || '',
        });
        return;
      }
      if (event.target.closest('[data-workbook-viewer-close]') || event.target.closest('#closeWorkbookViewerBtn')) {
        setModalOpen(false);
      }
    });

    datasetSelect.addEventListener('change', () => {
      viewerState.datasetKey = datasetSelect.value;
      viewerState.versionKey = resolveDefaultVersionKey(viewerState.datasetKey);
      viewerState.sheetName = '';
      syncSelectors();
    });

    versionSelect.addEventListener('change', () => {
      viewerState.versionKey = versionSelect.value;
      viewerState.sheetName = '';
      populateSheetSelect();
      renderCurrentSheet();
    });

    sheetSelect.addEventListener('change', () => {
      viewerState.sheetName = sheetSelect.value;
      renderCurrentSheet();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) {
        setModalOpen(false);
      }
    });
  }

  bindEvents();

  global.G281WorkbookViewer = {
    open: openViewer,
  };
})(window);
