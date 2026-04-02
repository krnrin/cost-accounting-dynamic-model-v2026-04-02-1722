(function (global) {
  'use strict';

  const DATASET_DEFINITIONS = {
    bom: { key: 'bom', label: 'BOM 整表' },
    config: { key: 'config', label: '配置清单' },
  };
  const BOM_VERSION_FALLBACKS = {
    quote: 'freeze',
    fixed: 'light',
    tt: 'regress',
  };
  const WINDOW_MARGIN = 12;
  const WINDOW_MIN_WIDTH = 1120;
  const WINDOW_MIN_HEIGHT = 640;

  const viewerState = {
    datasetKey: 'bom',
    versionKey: '',
    sheetName: '',
    workbookSnapshot: null,
    sourceMeta: null,
    editor: null,
    lastFocused: null,
    ownsBodyLock: false,
    loadToken: 0,
    statusTimer: 0,
    readyTimer: 0,
    layoutFrame: 0,
    windowRect: null,
    pointerSession: null,
  };
  const draftSnapshots = new Map();
  let modal = null;
  const refs = {};

  function getBridge() {
    return global.G281DashboardBridge || null;
  }

  function getRuntime() {
    return getBridge()?.getRuntimeSnapshot?.() || global.G281_RUNTIME || {};
  }

  function getRuntimeHelper() {
    return global.G281BomTemplateRuntime || null;
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

  function clonePlain(value, fallback = null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function toText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function cacheKey(datasetKey, versionKey) {
    return `${datasetKey || ''}:${versionKey || ''}`;
  }

  function isModalOpen() {
    return Boolean(modal && !modal.hidden);
  }

  function requestLayoutRefresh() {
    if (viewerState.layoutFrame) return;
    global.requestAnimationFrame(() => {
      viewerState.layoutFrame = 0;
      global.dispatchEvent(new Event('resize'));
    });
    viewerState.layoutFrame = 1;
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function numericOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function getWindowBounds() {
    return {
      left: WINDOW_MARGIN,
      top: WINDOW_MARGIN,
      right: Math.max(WINDOW_MARGIN, global.innerWidth - WINDOW_MARGIN),
      bottom: Math.max(WINDOW_MARGIN, global.innerHeight - WINDOW_MARGIN),
    };
  }

  function getWindowMinWidth() {
    const available = Math.max(720, global.innerWidth - WINDOW_MARGIN * 2);
    return Math.min(WINDOW_MIN_WIDTH, available);
  }

  function getWindowMinHeight() {
    const available = Math.max(480, global.innerHeight - WINDOW_MARGIN * 2);
    return Math.min(WINDOW_MIN_HEIGHT, available);
  }

  function createDefaultWindowRect() {
    const bounds = getWindowBounds();
    const minWidth = getWindowMinWidth();
    const minHeight = getWindowMinHeight();
    const maxWidth = Math.max(minWidth, bounds.right - bounds.left);
    const maxHeight = Math.max(minHeight, bounds.bottom - bounds.top);
    const width = clampNumber(Math.round(global.innerWidth * 0.88), Math.min(1280, maxWidth), Math.min(1580, maxWidth));
    const height = clampNumber(Math.round(global.innerHeight * 0.84), Math.min(720, maxHeight), Math.min(920, maxHeight));
    return {
      left: clampNumber(Math.round((global.innerWidth - width) / 2), bounds.left, Math.max(bounds.left, bounds.right - width)),
      top: clampNumber(Math.round((global.innerHeight - height) / 2), bounds.top, Math.max(bounds.top, bounds.bottom - height)),
      width,
      height,
    };
  }

  function normalizeWindowRect(rect) {
    const fallback = createDefaultWindowRect();
    const bounds = getWindowBounds();
    const minWidth = getWindowMinWidth();
    const minHeight = getWindowMinHeight();
    const maxWidth = Math.max(minWidth, bounds.right - bounds.left);
    const maxHeight = Math.max(minHeight, bounds.bottom - bounds.top);
    const width = clampNumber(Math.round(numericOr(rect?.width, fallback.width)), minWidth, maxWidth);
    const height = clampNumber(Math.round(numericOr(rect?.height, fallback.height)), minHeight, maxHeight);
    const left = clampNumber(
      Math.round(numericOr(rect?.left, fallback.left)),
      bounds.left,
      Math.max(bounds.left, bounds.right - width),
    );
    const top = clampNumber(
      Math.round(numericOr(rect?.top, fallback.top)),
      bounds.top,
      Math.max(bounds.top, bounds.bottom - height),
    );
    return { left, top, width, height };
  }

  function rememberCurrentWindowRect() {
    if (!refs.panel || modal?.hidden) return viewerState.windowRect;
    const rect = refs.panel.getBoundingClientRect();
    viewerState.windowRect = normalizeWindowRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
    return viewerState.windowRect;
  }

  function clearFloatingWindowRect() {
    if (!refs.panel) return;
    refs.panel.classList.remove('is-window-floating', 'is-window-interacting');
    refs.panel.style.left = '';
    refs.panel.style.top = '';
    refs.panel.style.width = '';
    refs.panel.style.height = '';
    refs.panel.style.maxWidth = '';
    refs.panel.style.maxHeight = '';
  }

  function applyFloatingWindowRect(rect) {
    if (!refs.panel) return;
    const nextRect = normalizeWindowRect(rect);
    viewerState.windowRect = nextRect;
    refs.panel.classList.add('is-window-floating');
    refs.panel.style.left = `${nextRect.left}px`;
    refs.panel.style.top = `${nextRect.top}px`;
    refs.panel.style.width = `${nextRect.width}px`;
    refs.panel.style.height = `${nextRect.height}px`;
    refs.panel.style.maxWidth = `${nextRect.width}px`;
    refs.panel.style.maxHeight = `${nextRect.height}px`;
  }

  function syncFloatingWindowFrame() {
    if (!refs.panel || !modal || modal.hidden) return;
    if (modal.classList.contains('is-window-maximized') || modal.classList.contains('is-window-minimized')) {
      clearFloatingWindowRect();
      return;
    }
    applyFloatingWindowRect(viewerState.windowRect || createDefaultWindowRect());
  }

  function computeMovedWindowRect(startRect, deltaX, deltaY) {
    const bounds = getWindowBounds();
    const width = startRect.width;
    const height = startRect.height;
    return normalizeWindowRect({
      left: clampNumber(startRect.left + deltaX, bounds.left, Math.max(bounds.left, bounds.right - width)),
      top: clampNumber(startRect.top + deltaY, bounds.top, Math.max(bounds.top, bounds.bottom - height)),
      width,
      height,
    });
  }

  function computeResizedWindowRect(startRect, handle, deltaX, deltaY) {
    const bounds = getWindowBounds();
    const minWidth = getWindowMinWidth();
    const minHeight = getWindowMinHeight();
    const right = startRect.left + startRect.width;
    const bottom = startRect.top + startRect.height;
    let left = startRect.left;
    let top = startRect.top;
    let width = startRect.width;
    let height = startRect.height;

    if (handle.includes('e')) {
      width = clampNumber(startRect.width + deltaX, minWidth, Math.max(minWidth, bounds.right - startRect.left));
    }
    if (handle.includes('s')) {
      height = clampNumber(startRect.height + deltaY, minHeight, Math.max(minHeight, bounds.bottom - startRect.top));
    }
    if (handle.includes('w')) {
      left = clampNumber(startRect.left + deltaX, bounds.left, right - minWidth);
      width = right - left;
    }
    if (handle.includes('n')) {
      top = clampNumber(startRect.top + deltaY, bounds.top, bottom - minHeight);
      height = bottom - top;
    }

    return normalizeWindowRect({ left, top, width, height });
  }

  function isInteractiveChromeTarget(target) {
    if (!(target instanceof global.Element)) return false;
    return Boolean(target.closest('button,input,select,textarea,option,a,[role="button"],[role="tab"],[role="textbox"],[data-viewer-action],.window-caption-controls,.workbook-viewer-head-fields'));
  }

  function startWindowPointerSession(mode, event, handle = '') {
    if (!modal || modal.hidden || !refs.panel) return;
    if (modal.classList.contains('is-window-maximized') || modal.classList.contains('is-window-minimized')) return;
    if (Number.isFinite(event.button) && event.button !== 0) return;
    if (mode === 'move' && isInteractiveChromeTarget(event.target)) return;

    const baseRect = rememberCurrentWindowRect() || createDefaultWindowRect();
    viewerState.pointerSession = {
      mode,
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { ...baseRect },
    };
    refs.panel.classList.add('is-window-interacting');
    document.body.classList.add('workbook-window-interacting');
    event.preventDefault();
  }

  function updateWindowPointerSession(event) {
    const session = viewerState.pointerSession;
    if (!session) return;
    if (Number.isFinite(session.pointerId) && Number.isFinite(event.pointerId) && session.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    const nextRect = session.mode === 'resize'
      ? computeResizedWindowRect(session.startRect, session.handle || '', deltaX, deltaY)
      : computeMovedWindowRect(session.startRect, deltaX, deltaY);

    applyFloatingWindowRect(nextRect);
    requestLayoutRefresh();
  }

  function finishWindowPointerSession() {
    if (!viewerState.pointerSession) return;
    viewerState.pointerSession = null;
    refs.panel?.classList.remove('is-window-interacting');
    document.body.classList.remove('workbook-window-interacting');
    requestLayoutRefresh();
  }

  function canUseEditor() {
    return Boolean(global.G281UniverTemplateEditor?.create);
  }

  function isUniverSnapshot(value) {
    return Boolean(value && Array.isArray(value.sheetOrder) && value.sheets && !Array.isArray(value.sheets));
  }

  function getWorkbookSheetNames(snapshot) {
    if (!isUniverSnapshot(snapshot)) return [];
    return snapshot.sheetOrder
      .map((sheetId) => snapshot.sheets?.[sheetId]?.name || '')
      .filter(Boolean);
  }

  function moveSheetToFront(snapshot, sheetName) {
    if (!isUniverSnapshot(snapshot) || !sheetName) return clonePlain(snapshot, null);
    const copied = clonePlain(snapshot, null);
    if (!copied) return null;
    const targetSheetId = copied.sheetOrder.find((sheetId) => copied.sheets?.[sheetId]?.name === sheetName);
    if (!targetSheetId) return copied;
    copied.sheetOrder = [targetSheetId].concat(copied.sheetOrder.filter((sheetId) => sheetId !== targetSheetId));
    return copied;
  }

  function getActiveHarnessSheetName() {
    return toText(document.getElementById('bomValidationHarness')?.value, '');
  }

  function resolvePreferredSheetName(sheetNames, preferredSheetName = '') {
    const candidates = [
      preferredSheetName,
      viewerState.sheetName,
      getActiveHarnessSheetName(),
      viewerState.datasetKey === 'bom' ? '二次物料明细' : '配置清单',
    ].filter(Boolean);
    return candidates.find((name) => sheetNames.includes(name)) || sheetNames[0] || '';
  }

  function listBomVersions() {
    return getBridge()?.listBomVersions?.() || [];
  }

  function normalizeBomVersionKey(versionKey = '') {
    const normalized = toText(versionKey, '');
    const entries = listBomVersions();
    if (entries.some((entry) => entry.key === normalized)) {
      return normalized;
    }
    const fallbackKey = BOM_VERSION_FALLBACKS[normalized];
    if (fallbackKey && entries.some((entry) => entry.key === fallbackKey)) {
      return fallbackKey;
    }
    return '';
  }

  function listConfigVersions() {
    const runtime = getRuntime();
    const versionLabels = getBridge()?.getVersionLabels?.() || {};
    const source = runtime.configSheetCopies || {};
    const order = Array.isArray(source.meta?.versionOrder) ? source.meta.versionOrder : Object.keys(source.versions || {});
    return order
      .filter((key) => source.versions?.[key])
      .map((key) => {
        const record = source.versions[key] || {};
        const workbook = toText(
          record.sourceFileName,
          toText(record.workbook, toText(source.meta?.workbooks?.[key], '')),
        );
        return {
          key,
          label: toText(record.label, `${versionLabels[key] || key} 配置清单`),
          workbookVersionKey: key,
          workbook,
          source: workbook,
          userCreated: false,
        };
      });
  }

  function listVersionEntries(datasetKey) {
    return datasetKey === 'bom' ? listBomVersions() : listConfigVersions();
  }

  function getVersionEntry(datasetKey, versionKey) {
    return listVersionEntries(datasetKey).find((entry) => entry.key === versionKey) || null;
  }

  function availableDatasetKeys() {
    return Object.keys(DATASET_DEFINITIONS).filter((datasetKey) => listVersionEntries(datasetKey).length);
  }

  function normalizeDatasetKey(datasetKey = '') {
    const available = availableDatasetKeys();
    if (available.includes(datasetKey)) return datasetKey;
    if (available.includes('bom')) return 'bom';
    return available[0] || 'bom';
  }

  function resolveDefaultVersionKey(datasetKey) {
    if (datasetKey === 'bom') {
      return normalizeBomVersionKey(getBridge()?.getActiveBomVersionKey?.() || viewerState.versionKey)
        || listBomVersions()[0]?.key
        || '';
    }
    const preferred = toText(getBridge()?.getWorkbookVersionKey?.(), viewerState.versionKey);
    const entries = listConfigVersions();
    return entries.some((entry) => entry.key === preferred) ? preferred : (entries[0]?.key || '');
  }

  function toSnapshotFromWorkbookSource(workbookSource, options = {}) {
    if (!workbookSource) return null;
    if (isUniverSnapshot(workbookSource)) {
      return clonePlain(workbookSource, null);
    }
    const helper = getRuntimeHelper();
    if (!helper?.convertIntermediateWorkbookToUniverSnapshot) {
      return null;
    }
    const settings = {};
    const workbookName = toText(options.workbookName, toText(workbookSource.workbookName, ''));
    if (workbookName) {
      settings.workbookName = workbookName;
    }
    return helper.convertIntermediateWorkbookToUniverSnapshot(workbookSource, settings);
  }

  function convertConfigVersionToSnapshot(record) {
    if (!record?.snapshot) return null;
    const helper = getRuntimeHelper();
    if (!helper?.convertIntermediateWorkbookToUniverSnapshot) return null;

    const sourceSnapshot = record.snapshot || {};
    const workbookIntermediate = {
      workbookName: toText(record.workbook, toText(record.sourceFileName, toText(sourceSnapshot.sheetName, '配置清单'))),
      sourceFileName: toText(record.sourceFileName, toText(record.workbook, '')),
      styleTable: clonePlain(sourceSnapshot.stylePool, {}) || {},
      sheets: [{
        sheetName: toText(sourceSnapshot.sheetName, '配置清单'),
        maxRow: Number(sourceSnapshot.maxRow) || 0,
        maxColumn: Number(sourceSnapshot.maxColumn) || 0,
        freezePane: sourceSnapshot.freezePanes || null,
        mergedRanges: clonePlain(sourceSnapshot.mergedRanges, []) || [],
        rowDimensions: Object.entries(sourceSnapshot.rowDimensions || {}).map(([row, entry]) => ({
          row: Number(row) || 0,
          ...clonePlain(entry, {}),
        })),
        columnDimensions: Object.values(sourceSnapshot.columnDimensions || {}).map((entry) => clonePlain(entry, {})),
        cells: (sourceSnapshot.cells || []).map((cell) => ({
          row: Number(cell?.r) || 0,
          column: Number(cell?.c) || 0,
          address: cell?.addr || '',
          dataType: cell?.type || '',
          styleId: cell?.styleId,
          value: cell?.value,
          formula: cell?.formula || '',
          comment: cell?.comment || '',
          hyperlink: cell?.hyperlink || '',
        })),
      }],
    };

    return helper.convertIntermediateWorkbookToUniverSnapshot(workbookIntermediate, {
      workbookName: workbookIntermediate.workbookName,
    });
  }

  async function resolveBomSource(versionKey) {
    const bridge = getBridge();
    const normalizedKey = normalizeBomVersionKey(versionKey)
      || normalizeBomVersionKey(bridge?.getActiveBomVersionKey?.() || '')
      || listBomVersions()[0]?.key
      || '';
    const versionEntry = getVersionEntry('bom', normalizedKey);
    const option = bridge?.getBomVersionOption?.(normalizedKey) || null;

    if (option?.templateWorkbookSnapshot?.sheetOrder?.length && option.templateWorkbookSnapshot.sheets) {
      return {
        datasetKey: 'bom',
        versionKey: normalizedKey,
        versionLabel: toText(option.label, toText(versionEntry?.label, normalizedKey)),
        sourceLabel: toText(option.templateSource || option.source, toText(option.workbook, '')),
        workbookName: toText(option.workbook, toText(option.label, normalizedKey)),
        workbookVersionKey: toText(option.workbookVersionKeyFallback, toText(versionEntry?.workbookVersionKey, '')),
        userCreated: Boolean(option.userCreated),
        canSave: true,
        snapshot: clonePlain(option.templateWorkbookSnapshot, null),
      };
    }

    const nativeVersionId = toText(option?.nativeWorkbookVersionId, toText(versionEntry?.nativeWorkbookVersionId, ''));
    if (nativeVersionId && global.G281BomDb?.getVersion) {
      try {
        await global.G281BomDb.init?.({});
        const record = await global.G281BomDb.getVersion(nativeVersionId);
        const snapshot = toSnapshotFromWorkbookSource(record?.workbook, {
          workbookName: toText(record?.workbook?.workbookName, toText(record?.versionLabel, toText(option?.label, ''))),
        });
        if (snapshot) {
          return {
            datasetKey: 'bom',
            versionKey: normalizedKey,
            versionLabel: toText(option?.label, toText(record?.versionLabel, toText(versionEntry?.label, normalizedKey))),
            sourceLabel: toText(record?.workbook?.sourceFileName, toText(option?.source, toText(versionEntry?.source, ''))),
            workbookName: toText(record?.workbook?.workbookName, toText(record?.versionLabel, toText(option?.label, normalizedKey))),
            workbookVersionKey: toText(option?.workbookVersionKeyFallback, toText(versionEntry?.workbookVersionKey, bridge?.getWorkbookVersionKey?.() || '')),
            userCreated: Boolean(option?.userCreated),
            canSave: true,
            snapshot,
          };
        }
      } catch (error) {
        console.warn('[G281WorkbookViewer] Failed to resolve native BOM workbook', error);
      }
    }

    const helper = getRuntimeHelper();
    const workbookVersionKey = toText(
      option?.workbookVersionKeyFallback,
      toText(versionEntry?.workbookVersionKey, bridge?.getWorkbookVersionKey?.() || ''),
    );
    if (helper?.buildVersionTemplateContextWithUniver && workbookVersionKey) {
      try {
        const context = helper.buildVersionTemplateContextWithUniver({
          versionKey: workbookVersionKey,
          source: getRuntime().bomWorkbookCopies,
        });
        if (context?.workbookSnapshot) {
          return {
            datasetKey: 'bom',
            versionKey: normalizedKey,
            versionLabel: toText(versionEntry?.label, normalizedKey),
            sourceLabel: toText(context?.workbook?.sourceFileName, toText(versionEntry?.source, '')),
            workbookName: toText(context?.workbook?.workbookName, toText(versionEntry?.workbook, normalizedKey)),
            workbookVersionKey,
            userCreated: Boolean(option?.userCreated),
            canSave: true,
            snapshot: clonePlain(context.workbookSnapshot, null),
          };
        }
      } catch (error) {
        console.warn('[G281WorkbookViewer] Failed to resolve runtime BOM workbook copy', error);
      }
    }

    return {
      datasetKey: 'bom',
      versionKey: normalizedKey,
      versionLabel: toText(versionEntry?.label, normalizedKey || 'BOM'),
      sourceLabel: toText(option?.source, toText(versionEntry?.source, '')),
      workbookName: toText(option?.workbook, toText(versionEntry?.workbook, '')),
      workbookVersionKey,
      userCreated: Boolean(option?.userCreated),
      canSave: true,
      snapshot: null,
      error: `当前 BOM 版本 ${toText(versionEntry?.label, normalizedKey || 'BOM')} 没有可加载的整表快照。`,
    };
  }

  function resolveConfigSource(versionKey) {
    const runtime = getRuntime();
    const normalizedKey = toText(versionKey, '') || resolveDefaultVersionKey('config');
    const entry = getVersionEntry('config', normalizedKey);
    const record = runtime.configSheetCopies?.versions?.[normalizedKey] || null;
    const snapshot = convertConfigVersionToSnapshot(record);
    return {
      datasetKey: 'config',
      versionKey: normalizedKey,
      versionLabel: toText(entry?.label, normalizedKey || '配置清单'),
      sourceLabel: toText(entry?.source, toText(record?.workbook, '')),
      workbookName: toText(record?.workbook, toText(entry?.label, normalizedKey || '配置清单')),
      workbookVersionKey: normalizedKey,
      userCreated: false,
      canSave: false,
      snapshot,
      error: snapshot ? '' : `配置清单版本 ${toText(entry?.label, normalizedKey || '配置清单')} 暂时无法加载。`,
    };
  }

  async function resolveWorkbookSource(datasetKey, versionKey) {
    return datasetKey === 'config'
      ? resolveConfigSource(versionKey)
      : resolveBomSource(versionKey);
  }

  function stashCurrentSnapshot() {
    if (!viewerState.datasetKey || !viewerState.versionKey || !viewerState.editor?.saveSnapshot) return null;
    const snapshot = viewerState.editor.saveSnapshot();
    if (!isUniverSnapshot(snapshot)) return null;
    viewerState.workbookSnapshot = clonePlain(snapshot, null);
    draftSnapshots.set(cacheKey(viewerState.datasetKey, viewerState.versionKey), {
      snapshot: clonePlain(viewerState.workbookSnapshot, null),
    });
    return viewerState.workbookSnapshot;
  }

  function captureWorkbookSnapshot(options = {}) {
    const snapshot = viewerState.editor?.saveSnapshot?.() || viewerState.workbookSnapshot;
    if (!isUniverSnapshot(snapshot)) return null;
    viewerState.workbookSnapshot = clonePlain(snapshot, null);
    if (!options.skipCache) {
      draftSnapshots.set(cacheKey(viewerState.datasetKey, viewerState.versionKey), {
        snapshot: clonePlain(viewerState.workbookSnapshot, null),
      });
    }
    if (!options.skipUi) {
      renderSheetSelect();
      renderSummary();
      updateStatusMeta();
    }
    return viewerState.workbookSnapshot;
  }

  function ensureToolbarButtons() {
    const toolbar = document.querySelector('#bomValidationModal .bom-validate-toolbar');
    if (!toolbar) return;

    const definitions = [
      { id: 'openBomWorkbookViewerBtn', label: '查看当前 BOM 整表', datasetKey: 'bom' },
      { id: 'openConfigWorkbookViewerBtn', label: '查看配置清单', datasetKey: 'config' },
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
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'bom-modal';
    modal.id = 'workbookViewerModal';
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="bom-modal-backdrop" data-workbook-viewer-close></div>
      <section class="bom-modal-panel version-template-panel workbook-editor-panel is-bom-sheet-mode" role="dialog" aria-modal="true" aria-labelledby="workbookViewerTitle">
        <div class="bom-modal-head version-template-head workbook-viewer-head">
          <div class="version-template-head-main">
            <div class="version-template-head-copy">
              <div class="eyebrow" id="workbookViewerEyebrow">BOM Workspace</div>
              <h3 id="workbookViewerTitle">Excel 整表编辑</h3>
              <p class="section-note" id="workbookViewerSubtitle">参考录入页面，可直接修改整表、切换 Sheet、缩放窗口，并把结果保存回 BOM 版本。</p>
            </div>
            <div class="workbook-viewer-head-fields">
              <label class="field">
                <span>版本名称</span>
                <input id="workbookViewerName" type="text" placeholder="请输入版本名称" />
              </label>
              <label class="field">
                <span>来源说明</span>
                <input id="workbookViewerSource" type="text" placeholder="例如：BOM 整表编辑 / 导入 Excel 复核" />
              </label>
            </div>
            <div class="workbook-viewer-head-actions">
              <button class="button primary" id="workbookViewerSaveBtn" type="button">保存当前工作版</button>
              <button class="button ghost" id="workbookViewerSaveAsBtn" type="button">另存为新 BOM 版本</button>
              <div class="window-caption-controls" aria-label="窗口控制">
                <button class="window-caption-btn is-minimize" id="minimizeWorkbookViewerBtn" type="button" aria-label="最小化" title="最小化"></button>
                <button class="window-caption-btn is-maximize" id="toggleWorkbookViewerWindowBtn" type="button" aria-label="放大窗口" title="放大窗口"></button>
                <button class="window-caption-btn is-close" id="closeWorkbookViewerBtn" type="button" aria-label="关闭" title="关闭"></button>
              </div>
            </div>
          </div>
        </div>
        <div class="workbook-viewer-toolbar-row">
          <label class="field">
            <span>分类</span>
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
          <div class="workbook-viewer-summary" id="workbookViewerSummary"></div>
        </div>
        <div class="version-template-quickbar workbook-viewer-quickbar">
          <div class="workbook-viewer-quick-group">
            <button class="button ghost version-template-quickbtn" data-viewer-action="insert-row" type="button">插入行</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="insert-column" type="button">插入列</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="merge" type="button">合并</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="unmerge" type="button">取消合并</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="filter" type="button">筛选</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="conditional" type="button">条件格式</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="image" type="button">图片</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="add-sheet" type="button">新增 Sheet</button>
          </div>
          <div class="workbook-viewer-quick-group workbook-viewer-zoom-group">
            <button class="button ghost version-template-quickbtn" data-viewer-action="zoom-out" type="button">缩小</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="zoom-reset" type="button">100%</button>
            <button class="button ghost version-template-quickbtn" data-viewer-action="zoom-in" type="button">放大</button>
          </div>
        </div>
        <div class="version-template-main workbook-viewer-main">
          <div class="version-template-fields" id="workbookViewerFields"></div>
        </div>
        <div class="version-template-statusbar workbook-viewer-statusbar">
          <div class="version-template-status" id="workbookViewerStatus">待加载工作簿。</div>
          <div class="version-template-statusbar-meta">
            <span id="workbookViewerSelectionMeta">当前选区 -</span>
            <span id="workbookViewerZoomMeta">缩放 100%</span>
            <span id="workbookViewerSheetMeta">Sheet -</span>
          </div>
        </div>
        <div class="workbook-window-resizer is-n" data-window-resize-handle="n" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-e" data-window-resize-handle="e" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-s" data-window-resize-handle="s" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-w" data-window-resize-handle="w" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-ne" data-window-resize-handle="ne" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-se" data-window-resize-handle="se" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-sw" data-window-resize-handle="sw" aria-hidden="true"></div>
        <div class="workbook-window-resizer is-nw" data-window-resize-handle="nw" aria-hidden="true"></div>
      </section>
    `;
    document.body.appendChild(modal);

    refs.backdrop = modal.querySelector('[data-workbook-viewer-close]');
    refs.panel = modal.querySelector('.workbook-editor-panel');
    refs.head = modal.querySelector('.workbook-viewer-head');
    refs.eyebrow = modal.querySelector('#workbookViewerEyebrow');
    refs.title = modal.querySelector('#workbookViewerTitle');
    refs.subtitle = modal.querySelector('#workbookViewerSubtitle');
    refs.name = modal.querySelector('#workbookViewerName');
    refs.source = modal.querySelector('#workbookViewerSource');
    refs.save = modal.querySelector('#workbookViewerSaveBtn');
    refs.saveAs = modal.querySelector('#workbookViewerSaveAsBtn');
    refs.dataset = modal.querySelector('#workbookViewerDataset');
    refs.version = modal.querySelector('#workbookViewerVersion');
    refs.sheet = modal.querySelector('#workbookViewerSheet');
    refs.summary = modal.querySelector('#workbookViewerSummary');
    refs.fields = modal.querySelector('#workbookViewerFields');
    refs.status = modal.querySelector('#workbookViewerStatus');
    refs.selectionMeta = modal.querySelector('#workbookViewerSelectionMeta');
    refs.zoomMeta = modal.querySelector('#workbookViewerZoomMeta');
    refs.sheetMeta = modal.querySelector('#workbookViewerSheetMeta');
    refs.minimize = modal.querySelector('#minimizeWorkbookViewerBtn');
    refs.maximize = modal.querySelector('#toggleWorkbookViewerWindowBtn');
    refs.close = modal.querySelector('#closeWorkbookViewerBtn');

    bindModalEvents();
    return modal;
  }

  function ensureLoadingOverlay() {
    if (!refs.fields) return null;
    let overlay = refs.fields.querySelector('.version-template-loading');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'version-template-loading';
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="version-template-loading-card">
          <div class="version-template-loading-spinner" aria-hidden="true"></div>
          <div class="version-template-loading-text">正在加载 Excel 工作台…</div>
        </div>
      `;
      refs.fields.appendChild(overlay);
    }
    return overlay;
  }

  function setLoadingState(active, text = '') {
    const overlay = ensureLoadingOverlay();
    if (!overlay) return;
    overlay.hidden = !active;
    if (text) {
      const textNode = overlay.querySelector('.version-template-loading-text');
      if (textNode) textNode.textContent = text;
    }
  }

  function stopReadyWatch() {
    if (viewerState.readyTimer) {
      global.clearInterval(viewerState.readyTimer);
      viewerState.readyTimer = 0;
    }
  }

  function startReadyWatch() {
    stopReadyWatch();
    let attempts = 0;
    viewerState.readyTimer = global.setInterval(() => {
      attempts += 1;
      const ready = refs.fields?.querySelector('canvas,svg');
      if (ready || attempts >= 50) {
        stopReadyWatch();
        setLoadingState(false);
      }
    }, 160);
  }

  function stopStatusPolling() {
    if (viewerState.statusTimer) {
      global.clearInterval(viewerState.statusTimer);
      viewerState.statusTimer = 0;
    }
  }

  function updateStatusMeta() {
    const selection = viewerState.editor?.getSelectionSnapshot?.() || null;
    const zoomRatio = viewerState.editor?.getZoomRatio?.() || 1;
    const zoomLabel = `${Math.round((Number(zoomRatio) || 1) * 100)}%`;
    if (refs.selectionMeta) {
      refs.selectionMeta.textContent = selection?.a1 ? `当前选区 ${selection.a1}` : '当前选区 -';
    }
    if (refs.zoomMeta) {
      refs.zoomMeta.textContent = `缩放 ${zoomLabel}`;
    }
    if (refs.sheetMeta) {
      refs.sheetMeta.textContent = `Sheet ${viewerState.sheetName || '-'}`;
    }
  }

  function startStatusPolling() {
    stopStatusPolling();
    updateStatusMeta();
    viewerState.statusTimer = global.setInterval(updateStatusMeta, 320);
  }

  function destroyEditor() {
    stopReadyWatch();
    if (!viewerState.editor) return;
    try {
      viewerState.editor.destroy?.();
    } catch (error) {
      console.error('[G281WorkbookViewer] Failed to destroy editor', error);
    }
    viewerState.editor = null;
    if (refs.fields) {
      refs.fields.innerHTML = '';
    }
  }

  function ensureEditor() {
    if (viewerState.editor) return viewerState.editor;
    if (!canUseEditor() || !refs.fields) return null;
    refs.fields.innerHTML = '';
    viewerState.editor = global.G281UniverTemplateEditor.create(refs.fields);
    return viewerState.editor;
  }

  function setStatus(message) {
    if (refs.status) {
      refs.status.textContent = message || '';
    }
  }

  function syncWindowCaptionState() {
    const minimized = modal?.classList.contains('is-window-minimized');
    const maximized = modal?.classList.contains('is-window-maximized');
    if (refs.minimize) {
      refs.minimize.title = minimized ? '还原窗口' : '最小化';
      refs.minimize.setAttribute('aria-label', minimized ? '还原窗口' : '最小化');
      refs.minimize.classList.toggle('is-active', Boolean(minimized));
      refs.minimize.setAttribute('aria-pressed', minimized ? 'true' : 'false');
    }
    refs.maximize?.classList.toggle('is-restored', Boolean(maximized));
    if (refs.maximize) {
      refs.maximize.title = maximized ? '还原窗口' : '放大窗口';
      refs.maximize.setAttribute('aria-label', maximized ? '还原窗口' : '放大窗口');
      refs.maximize.setAttribute('aria-pressed', maximized ? 'true' : 'false');
    }
  }

  function applyWindowShellState() {
    if (!modal || !viewerState.ownsBodyLock) return;
    const active = !modal.hidden;
    const minimized = modal.classList.contains('is-window-minimized');
    document.body.classList.toggle('bom-modal-open', active && !minimized);
  }

  function setWindowMinimized(force) {
    if (!modal || modal.hidden) return;
    if (!modal.classList.contains('is-window-maximized')) {
      rememberCurrentWindowRect();
    }
    const next = typeof force === 'boolean'
      ? force
      : !modal.classList.contains('is-window-minimized');
    modal.classList.toggle('is-window-minimized', next);
    if (next) {
      modal.classList.remove('is-window-maximized');
      refs.panel?.classList.remove('is-window-maximized');
      clearFloatingWindowRect();
    } else {
      syncFloatingWindowFrame();
      startStatusPolling();
    }
    syncWindowCaptionState();
    applyWindowShellState();
    requestLayoutRefresh();
  }

  function setWindowMaximized(force) {
    if (!modal || modal.hidden) return;
    if (modal.classList.contains('is-window-minimized')) {
      modal.classList.remove('is-window-minimized');
    }
    if (!modal.classList.contains('is-window-maximized')) {
      rememberCurrentWindowRect();
    }
    const next = typeof force === 'boolean'
      ? force
      : !modal.classList.contains('is-window-maximized');
    modal.classList.toggle('is-window-maximized', next);
    refs.panel?.classList.toggle('is-window-maximized', next);
    if (next) {
      clearFloatingWindowRect();
    } else {
      syncFloatingWindowFrame();
    }
    syncWindowCaptionState();
    applyWindowShellState();
    requestLayoutRefresh();
  }

  function primeWindowStateForOpen(datasetKey) {
    ensureModal();
    if (!modal) return;
    const shouldMaximize = normalizeDatasetKey(datasetKey || viewerState.datasetKey) === 'bom';
    modal.classList.remove('is-window-minimized');
    modal.classList.toggle('is-window-maximized', shouldMaximize);
    refs.panel?.classList.toggle('is-window-maximized', shouldMaximize);
    if (!shouldMaximize) {
      viewerState.windowRect = viewerState.windowRect || createDefaultWindowRect();
    }
    syncFloatingWindowFrame();
  }

  function setModalOpen(open) {
    ensureModal();
    if (open) {
      viewerState.lastFocused = document.activeElement;
      viewerState.ownsBodyLock = !document.body.classList.contains('bom-modal-open');
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      startStatusPolling();
      syncWindowCaptionState();
      applyWindowShellState();
      syncFloatingWindowFrame();
      requestLayoutRefresh();
      return;
    }

    stashCurrentSnapshot();
    finishWindowPointerSession();
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-window-minimized', 'is-window-maximized');
    refs.panel?.classList.remove('is-window-maximized');
    clearFloatingWindowRect();
    syncWindowCaptionState();
    if (viewerState.ownsBodyLock) {
      document.body.classList.remove('bom-modal-open');
    }
    viewerState.ownsBodyLock = false;
    stopStatusPolling();
    destroyEditor();
    viewerState.workbookSnapshot = null;
    viewerState.sourceMeta = null;
    if (viewerState.lastFocused && typeof viewerState.lastFocused.focus === 'function') {
      viewerState.lastFocused.focus();
    }
  }

  function chip(label, value) {
    return `
      <span class="workbook-viewer-chip">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value || '-')}</span>
      </span>
    `;
  }

  function renderDatasetSelect() {
    const available = availableDatasetKeys();
    if (!available.includes(viewerState.datasetKey)) {
      viewerState.datasetKey = normalizeDatasetKey(viewerState.datasetKey);
    }
    refs.dataset.innerHTML = available
      .map((datasetKey) => `<option value="${datasetKey}">${escapeHtml(DATASET_DEFINITIONS[datasetKey]?.label || datasetKey)}</option>`)
      .join('');
    refs.dataset.value = viewerState.datasetKey;
  }

  function renderVersionSelect() {
    const entries = listVersionEntries(viewerState.datasetKey);
    if (!entries.some((entry) => entry.key === viewerState.versionKey)) {
      viewerState.versionKey = resolveDefaultVersionKey(viewerState.datasetKey);
    }
    refs.version.innerHTML = entries.map((entry) => {
      const suffix = entry.userCreated ? ' · 自建' : '';
      return `<option value="${escapeHtml(entry.key)}">${escapeHtml(`${entry.label || entry.key}${suffix}`)}</option>`;
    }).join('');
    refs.version.value = viewerState.versionKey;
  }

  function renderSheetSelect() {
    const sheetNames = getWorkbookSheetNames(viewerState.workbookSnapshot);
    viewerState.sheetName = resolvePreferredSheetName(sheetNames, viewerState.sheetName);
    refs.sheet.innerHTML = sheetNames
      .map((sheetName) => `<option value="${escapeHtml(sheetName)}">${escapeHtml(sheetName)}</option>`)
      .join('');
    refs.sheet.disabled = !sheetNames.length;
    refs.sheet.value = viewerState.sheetName;
  }

  function renderSummary() {
    const sourceMeta = viewerState.sourceMeta || {};
    const chips = [
      chip('分类', DATASET_DEFINITIONS[viewerState.datasetKey]?.label || viewerState.datasetKey),
      chip('版本', sourceMeta.versionLabel || viewerState.versionKey || '-'),
      chip('来源', sourceMeta.sourceLabel || sourceMeta.workbookName || '-'),
      chip('Sheet', viewerState.sheetName || '-'),
      chip('保存', viewerState.datasetKey === 'bom'
        ? (sourceMeta.userCreated ? '可覆盖 / 可另存' : '建议另存为新版本')
        : '仅临时编辑'),
    ];
    refs.summary.innerHTML = chips.join('');
  }

  function suggestedVersionName() {
    if (viewerState.datasetKey !== 'bom') {
      return viewerState.sourceMeta?.versionLabel || '';
    }
    if (viewerState.sourceMeta?.userCreated) {
      return viewerState.sourceMeta?.versionLabel || '';
    }
    return `${viewerState.sourceMeta?.versionLabel || 'BOM版本'}-整表编辑`;
  }

  function syncHeadInputs(force = false) {
    if (!refs.name || !refs.source) return;
    if (force || refs.name.dataset.boundVersionKey !== viewerState.versionKey) {
      refs.name.value = suggestedVersionName();
      refs.name.dataset.boundVersionKey = viewerState.versionKey;
    }
    if (force || refs.source.dataset.boundVersionKey !== viewerState.versionKey) {
      refs.source.value = viewerState.sourceMeta?.sourceLabel || viewerState.sourceMeta?.workbookName || '';
      refs.source.dataset.boundVersionKey = viewerState.versionKey;
    }
  }

  function syncChrome() {
    const isBom = viewerState.datasetKey === 'bom';
    if (refs.eyebrow) {
      refs.eyebrow.textContent = isBom ? 'BOM Workspace' : 'Config Workspace';
    }
    if (refs.title) {
      refs.title.textContent = isBom ? 'Excel 整表编辑' : '配置清单工作台';
    }
    if (refs.subtitle) {
      refs.subtitle.textContent = isBom
        ? '参考录入页面，可直接修改整表、切换 Sheet、缩放窗口，并把结果保存回 BOM 版本。'
        : '沿用 Excel 菜单和窗口能力查看配置清单；当前不回写 BOM 版本库。';
    }
    if (refs.save) {
      refs.save.hidden = !isBom;
    }
    if (refs.saveAs) {
      refs.saveAs.hidden = !isBom;
    }
  }

  function showEmpty(message) {
    destroyEditor();
    if (refs.fields) {
      refs.fields.innerHTML = `<div class="workbook-viewer-empty">${escapeHtml(message || '当前没有可展示的数据。')}</div>`;
    }
    viewerState.workbookSnapshot = null;
    renderSheetSelect();
    renderSummary();
    setStatus(message || '当前没有可展示的数据。');
    setLoadingState(false);
  }

  function syncBomSelectionToDashboard(versionKey) {
    if (viewerState.datasetKey !== 'bom' || !versionKey) return;
    try {
      getBridge()?.applyVersionStatePatch?.({ bom: versionKey });
    } catch (error) {
      console.warn('[G281WorkbookViewer] Failed to sync active BOM version', error);
    }
  }

  async function loadWorkbook(options = {}) {
    const preferredSheetName = toText(options.sheetName, '');
    const token = ++viewerState.loadToken;

    renderDatasetSelect();
    renderVersionSelect();
    syncChrome();
    renderSummary();
    setLoadingState(true, viewerState.datasetKey === 'bom' ? '正在加载 BOM 整表工作台…' : '正在加载配置清单工作台…');
    setStatus(viewerState.datasetKey === 'bom' ? '正在载入 BOM 整表…' : '正在载入配置清单…');

    const sourceMeta = await resolveWorkbookSource(viewerState.datasetKey, viewerState.versionKey);
    if (token !== viewerState.loadToken) return;

    viewerState.sourceMeta = sourceMeta || null;
    syncChrome();
    renderSummary();
    syncHeadInputs();

    const cached = draftSnapshots.get(cacheKey(viewerState.datasetKey, viewerState.versionKey));
    const snapshotSource = cached?.snapshot || sourceMeta?.snapshot;
    if (!snapshotSource) {
      showEmpty(sourceMeta?.error || '当前版本没有可加载的工作簿。');
      return;
    }

    const workingSnapshot = clonePlain(snapshotSource, null);
    const sheetNames = getWorkbookSheetNames(workingSnapshot);
    viewerState.sheetName = resolvePreferredSheetName(sheetNames, preferredSheetName);
    viewerState.workbookSnapshot = moveSheetToFront(workingSnapshot, viewerState.sheetName);
    draftSnapshots.set(cacheKey(viewerState.datasetKey, viewerState.versionKey), {
      snapshot: clonePlain(viewerState.workbookSnapshot, null),
    });

    renderSheetSelect();
    renderSummary();

    if (!canUseEditor()) {
      showEmpty('当前环境未加载 Excel 编辑器，无法打开整表工作台。');
      return;
    }

    try {
      const editor = ensureEditor();
      if (!editor) {
        showEmpty('Excel 编辑器初始化失败。');
        return;
      }
      setLoadingState(true, viewerState.datasetKey === 'bom' ? '正在初始化 Excel 工作台…' : '正在初始化配置清单工作台…');
      editor.loadTemplate({
        workbookSnapshot: clonePlain(viewerState.workbookSnapshot, null),
      });
      startReadyWatch();
      startStatusPolling();
      updateStatusMeta();
      setStatus(`已打开 ${sourceMeta?.versionLabel || viewerState.versionKey || ''}${viewerState.sheetName ? ` · ${viewerState.sheetName}` : ''}`);
      requestLayoutRefresh();
    } catch (error) {
      console.error('[G281WorkbookViewer] Failed to load workbook into editor', error);
      showEmpty('Excel 工作台初始化失败，请稍后重试。');
    }
  }

  async function reloadFromWorkingSnapshot(preferredSheetName = '') {
    const snapshot = captureWorkbookSnapshot({ skipUi: true });
    if (!snapshot || !viewerState.editor) return false;
    const nextSheetName = resolvePreferredSheetName(getWorkbookSheetNames(snapshot), preferredSheetName);
    viewerState.sheetName = nextSheetName;
    viewerState.workbookSnapshot = moveSheetToFront(snapshot, nextSheetName);
    draftSnapshots.set(cacheKey(viewerState.datasetKey, viewerState.versionKey), {
      snapshot: clonePlain(viewerState.workbookSnapshot, null),
    });
    renderSheetSelect();
    renderSummary();
    setLoadingState(true, '正在切换工作表…');
    viewerState.editor.loadTemplate({
      workbookSnapshot: clonePlain(viewerState.workbookSnapshot, null),
    });
    startReadyWatch();
    updateStatusMeta();
    requestLayoutRefresh();
    return true;
  }

  async function saveWorkbook(mode) {
    if (viewerState.datasetKey !== 'bom') {
      setStatus('当前只有 BOM 整表支持保存回版本库。');
      return false;
    }

    const bridge = getBridge();
    if (!bridge?.saveEditableBomWorkbookVersion) {
      setStatus('主程序尚未挂载整表保存接口。');
      return false;
    }

    const snapshot = captureWorkbookSnapshot({ skipUi: true });
    if (!snapshot) {
      setStatus('未检测到可保存的工作簿内容。');
      return false;
    }

    const label = toText(refs.name?.value, suggestedVersionName());
    const source = toText(refs.source?.value, viewerState.sourceMeta?.sourceLabel || viewerState.sourceMeta?.workbookName || '');

    try {
      const result = bridge.saveEditableBomWorkbookVersion({
        mode,
        baseVersionKey: viewerState.versionKey,
        label,
        source,
        workbookSnapshot: snapshot,
      });
      const previousCacheKey = cacheKey(viewerState.datasetKey, viewerState.versionKey);
      const nextVersionKey = toText(result?.versionKey, viewerState.versionKey);
      const nextOption = bridge.getBomVersionOption?.(nextVersionKey) || result?.option || null;

      viewerState.versionKey = nextVersionKey;
      viewerState.sourceMeta = {
        datasetKey: 'bom',
        versionKey: nextVersionKey,
        versionLabel: toText(nextOption?.label, toText(result?.versionLabel, label)),
        sourceLabel: toText(nextOption?.templateSource || nextOption?.source, source),
        workbookName: toText(nextOption?.workbook, toText(nextOption?.label, label)),
        workbookVersionKey: toText(nextOption?.workbookVersionKeyFallback, viewerState.sourceMeta?.workbookVersionKey || ''),
        userCreated: true,
        canSave: true,
        snapshot: clonePlain(snapshot, null),
      };
      viewerState.workbookSnapshot = clonePlain(snapshot, null);
      draftSnapshots.delete(previousCacheKey);
      draftSnapshots.set(cacheKey('bom', nextVersionKey), {
        snapshot: clonePlain(snapshot, null),
      });

      renderVersionSelect();
      renderSheetSelect();
      renderSummary();
      syncChrome();
      syncHeadInputs(true);
      updateStatusMeta();
      setStatus(toText(result?.message, '已保存 BOM 整表版本。'));
      return true;
    } catch (error) {
      console.error('[G281WorkbookViewer] Failed to save editable workbook', error);
      setStatus(error?.message || '保存失败，请稍后重试。');
      return false;
    }
  }

  async function handleQuickAction(action) {
    if (!action) return false;
    if (action === 'zoom-out') {
      const success = Boolean(viewerState.editor?.changeZoom?.(-0.1));
      if (success) {
        updateStatusMeta();
        setStatus('已缩小视图。');
      } else {
        setStatus('当前无法缩小视图。');
      }
      return success;
    }
    if (action === 'zoom-in') {
      const success = Boolean(viewerState.editor?.changeZoom?.(0.1));
      if (success) {
        updateStatusMeta();
        setStatus('已放大视图。');
      } else {
        setStatus('当前无法放大视图。');
      }
      return success;
    }
    if (action === 'zoom-reset') {
      const success = Boolean(viewerState.editor?.resetZoom?.());
      if (success) {
        updateStatusMeta();
        setStatus('已恢复为 100% 缩放。');
      } else {
        setStatus('当前无法恢复缩放。');
      }
      return success;
    }
    if (action === 'save-current') {
      return saveWorkbook('update-current');
    }
    if (action === 'save-as-new') {
      return saveWorkbook('save-as-new');
    }

    if (!viewerState.editor) {
      setStatus('Excel 工作台尚未准备好，请稍候。');
      return false;
    }

    let success = false;
    let message = '';
    switch (action) {
      case 'insert-row':
        success = Boolean(viewerState.editor.insertRowsAfterSelection?.(1));
        message = '已在当前选区后插入 1 行。';
        break;
      case 'insert-column':
        success = Boolean(viewerState.editor.insertColumnsAfterSelection?.(1));
        message = '已在当前选区后插入 1 列。';
        break;
      case 'merge':
        success = Boolean(viewerState.editor.mergeSelection?.());
        message = '已合并当前选区。';
        break;
      case 'unmerge':
        success = Boolean(viewerState.editor.unmergeSelection?.());
        message = '已取消当前选区合并。';
        break;
      case 'filter':
        success = Boolean(viewerState.editor.toggleFilter?.());
        message = '已打开筛选命令。';
        break;
      case 'conditional':
        success = Boolean(viewerState.editor.openConditionalFormattingPanel?.());
        message = '已打开条件格式面板。';
        break;
      case 'image':
        success = Boolean(viewerState.editor.openImageMenu?.());
        message = '已打开图片菜单。';
        break;
      case 'add-sheet':
        success = Boolean(viewerState.editor.appendSheet?.());
        message = '已新增一个 Sheet。';
        break;
      default:
        success = false;
    }

    if (!success) {
      setStatus('当前操作未成功，请先在表格中选中目标区域后再试。');
      return false;
    }

    captureWorkbookSnapshot({ skipUi: action === 'filter' || action === 'conditional' || action === 'image' });
    if (action === 'add-sheet') {
      const sheetNames = getWorkbookSheetNames(viewerState.workbookSnapshot);
      viewerState.sheetName = sheetNames[sheetNames.length - 1] || viewerState.sheetName;
      renderSheetSelect();
      renderSummary();
    }
    updateStatusMeta();
    setStatus(message);
    requestLayoutRefresh();
    return true;
  }

  async function openViewer(options = {}) {
    ensureModal();
    const normalized = typeof options === 'string' ? { datasetKey: options } : (options || {});
    const datasetKey = normalizeDatasetKey(normalized.datasetKey || viewerState.datasetKey);

    if (isModalOpen()) {
      stashCurrentSnapshot();
    }

    viewerState.datasetKey = datasetKey;
    if (datasetKey === 'bom') {
      viewerState.versionKey = normalizeBomVersionKey(normalized.versionKey || viewerState.versionKey)
        || resolveDefaultVersionKey('bom');
      syncBomSelectionToDashboard(viewerState.versionKey);
    } else {
      viewerState.versionKey = toText(normalized.versionKey, viewerState.versionKey);
      if (!listConfigVersions().some((entry) => entry.key === viewerState.versionKey)) {
        viewerState.versionKey = resolveDefaultVersionKey('config');
      }
    }

    primeWindowStateForOpen(datasetKey);
    setModalOpen(true);
    syncChrome();
    await loadWorkbook({
      sheetName: toText(normalized.sheetName, ''),
    });
  }

  function bindModalEvents() {
    refs.backdrop?.addEventListener('click', () => setModalOpen(false));
    refs.close?.addEventListener('click', () => setModalOpen(false));
    refs.minimize?.addEventListener('click', () => setWindowMinimized(!modal.classList.contains('is-window-minimized')));
    refs.maximize?.addEventListener('click', () => setWindowMaximized(!modal.classList.contains('is-window-maximized')));
    refs.save?.addEventListener('click', () => { void saveWorkbook('update-current'); });
    refs.saveAs?.addEventListener('click', () => { void saveWorkbook('save-as-new'); });

    refs.dataset?.addEventListener('change', async () => {
      stashCurrentSnapshot();
      viewerState.datasetKey = normalizeDatasetKey(refs.dataset.value);
      viewerState.versionKey = resolveDefaultVersionKey(viewerState.datasetKey);
      viewerState.sheetName = '';
      if (viewerState.datasetKey === 'bom') {
        syncBomSelectionToDashboard(viewerState.versionKey);
      }
      await loadWorkbook();
    });

    refs.version?.addEventListener('change', async () => {
      stashCurrentSnapshot();
      viewerState.versionKey = viewerState.datasetKey === 'bom'
        ? (normalizeBomVersionKey(refs.version.value) || resolveDefaultVersionKey('bom'))
        : refs.version.value;
      viewerState.sheetName = '';
      if (viewerState.datasetKey === 'bom') {
        syncBomSelectionToDashboard(viewerState.versionKey);
      }
      await loadWorkbook();
    });

    refs.sheet?.addEventListener('change', async () => {
      const nextSheetName = toText(refs.sheet.value, '');
      if (!nextSheetName || nextSheetName === viewerState.sheetName) return;
      await reloadFromWorkingSnapshot(nextSheetName);
      setStatus(`已切换到 Sheet：${nextSheetName}`);
    });

    modal?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-viewer-action]');
      if (!button) return;
      void handleQuickAction(button.dataset.viewerAction || '');
    });

    refs.head?.addEventListener('pointerdown', (event) => {
      startWindowPointerSession('move', event, 'move');
    });

    modal?.addEventListener('pointerdown', (event) => {
      const handle = event.target.closest('[data-window-resize-handle]');
      if (!handle) return;
      startWindowPointerSession('resize', event, handle.dataset.windowResizeHandle || '');
    });

    document.addEventListener('click', (event) => {
      const openButton = event.target.closest('[data-viewer-dataset]');
      if (!openButton) return;
      void openViewer({
        datasetKey: openButton.dataset.viewerDataset || 'bom',
        versionKey: openButton.dataset.viewerVersion || '',
        sheetName: openButton.dataset.viewerSheet || '',
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isModalOpen()) {
        setModalOpen(false);
      }
    });

    document.addEventListener('pointermove', updateWindowPointerSession);
    document.addEventListener('pointerup', finishWindowPointerSession);
    document.addEventListener('pointercancel', finishWindowPointerSession);
    global.addEventListener('resize', () => {
      if (!isModalOpen() || modal?.classList.contains('is-window-maximized') || modal?.classList.contains('is-window-minimized')) {
        return;
      }
      if (!viewerState.windowRect) return;
      applyFloatingWindowRect(viewerState.windowRect);
    });
  }

  ensureToolbarButtons();
  ensureModal();

  global.G281WorkbookViewer = {
    open: openViewer,
    close: () => setModalOpen(false),
    reload: () => loadWorkbook({ sheetName: viewerState.sheetName }),
  };
})(window);
