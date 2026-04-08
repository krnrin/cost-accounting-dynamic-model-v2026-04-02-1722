/**
 * dash_version_template.js
 * Univer电子表格编辑器 + 模板规格
 * Extracted from dashboard.js — do not edit both files simultaneously.
 */

function templateColumnLabel(index) {
  let next = Number(index) + 1;
  let label = '';
  while (next > 0) {
    const offset = (next - 1) % 26;
    label = String.fromCharCode(65 + offset) + label;
    next = Math.floor((next - 1) / 26);
  }
  return label || 'A';
}

function templateValueColumnIndex(group) {
  return 5;
}

function templateFieldAddress(group, index) {
  return `${templateColumnLabel(templateValueColumnIndex(group))}${index + 2}`;
}

function isLocalFileProtocol() {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:';
}

function canUseUniverTemplateEditor() {
  return Boolean(window.G281UniverTemplateEditor?.create);
}

function versionTemplatePasteHintText(context) {
  if (context?.editorMode === 'univer') {
    if (isLocalFileProtocol()) {
      return '右侧为 Excel 式编辑区。离线首次打开会先初始化 1-3 秒，随后可直接粘贴区域、输入公式、拖动填充。';
    }
    return '右侧已切换为 Excel 式编辑区，可直接粘贴区域、输入公式、拖动填充。';
  }
  return context?.pasteHint || '可直接在右侧模板中录入、粘贴和保存。';
}

function versionTemplateStatusText(context) {
  if (!context) return '';
  if (context.editorMode === 'univer') {
    if (isLocalFileProtocol()) {
      return `当前参考版本：${context.activeLabel}。右侧保持 Excel 式编辑区，离线首次打开会先初始化工作表，请等待 1-3 秒后再开始编辑。`;
    }
    return `当前参考版本：${context.activeLabel}。右侧可直接像 Excel 一样录入、粘贴和写公式，保存后生成新版本。`;
  }
  return `当前参考版本：${context.activeLabel}。当前使用内置表格模板，可直接录入、粘贴和保存为新版本。`;
}

function syncVersionTemplateChromeLabels() {
  const textMap = new Map([
    [el.versionTemplateSaveInlineBtn, '保存为新版本'],
    [el.versionTemplateResetBtn, '恢复当前值'],
    [el.versionTemplateParseBtn, '解析粘贴'],
    [el.versionTemplateInsertRowBtn, '插入行'],
    [el.versionTemplateInsertColumnBtn, '插入列'],
    [el.versionTemplateMergeBtn, '合并单元格'],
    [el.versionTemplateUnmergeBtn, '取消合并'],
    [el.versionTemplateFilterBtn, '筛选'],
    [el.versionTemplateConditionalBtn, '条件格式'],
    [el.versionTemplateInsertImageBtn, '图片'],
    [el.versionTemplateAddSheetBtn, '新增 Sheet'],
    [el.versionTemplateSaveBtn, '保存为新版本'],
  ]);
  textMap.forEach((text, node) => {
    if (node) node.textContent = text;
  });

  const nameLabel = el.versionTemplateName?.closest('.version-template-name-field')?.querySelector('span');
  if (nameLabel) nameLabel.textContent = '版本名称';
  if (el.versionTemplateName) el.versionTemplateName.placeholder = '请输入版本名称';

  const sourceLabel = el.versionTemplateSource?.closest('.field')?.querySelector('span');
  if (sourceLabel) sourceLabel.textContent = '来源文件 / 说明';
  if (el.versionTemplateSource) {
    el.versionTemplateSource.placeholder = '例如：新增核算表 / 手工试算 / Excel 片段';
  }

  const noteLabel = el.versionTemplateNote?.closest('.field')?.querySelector('span');
  if (noteLabel) noteLabel.textContent = '备注';
  if (el.versionTemplateNote) {
    el.versionTemplateNote.placeholder = '可补充版本用途、适用阶段、人工假设等信息';
  }

  const pasteTitle = el.versionTemplatePasteHint?.closest('.version-template-paste-head')?.querySelector('strong');
  if (pasteTitle) pasteTitle.textContent = 'Excel 粘贴区';
  if (el.versionTemplatePaste) {
    el.versionTemplatePaste.placeholder = '把 Excel 选中的区域直接粘贴到这里';
  }

  if (el.versionTemplateStatus && !versionTemplateDraft) {
    el.versionTemplateStatus.textContent = '当前还未粘贴数据，可直接在右侧模板里手工填写。';
  }
  if (el.versionTemplateSelectionMeta) el.versionTemplateSelectionMeta.textContent = '当前选区 --';
  if (el.versionTemplateSheetMeta) el.versionTemplateSheetMeta.textContent = '工作表 --';
  if (el.versionTemplateEditorMeta) el.versionTemplateEditorMeta.textContent = 'Excel 编辑区';
  const captionControls = el.toggleVersionTemplateWindowBtn?.closest('.window-caption-controls');
  if (captionControls) {
    captionControls.setAttribute('aria-label', '窗口控制');
  }

  if (el.minimizeVersionTemplateWindowBtn) {
    el.minimizeVersionTemplateWindowBtn.setAttribute('aria-label', '最小化');
    el.minimizeVersionTemplateWindowBtn.setAttribute('title', '最小化');
  }
  if (el.closeVersionTemplateBtn) {
    el.closeVersionTemplateBtn.setAttribute('aria-label', '关闭');
    el.closeVersionTemplateBtn.setAttribute('title', '关闭');
  }
}

function versionTemplateEditorMetaText(context = versionTemplateDraft) {
  if (!context) return '编辑模式待定';
  if (context.editorMode === 'univer') {
    return isLocalFileProtocol() ? '离线 Excel 编辑区' : 'Excel 编辑区';
  }
  return '内置表格模板';
}

function versionTemplateDebugEnabled() {
  return new URLSearchParams(window.location.search).has('debugTemplateState');
}

function pushVersionTemplateDebugError(source, error) {
  if (!versionTemplateDebugEnabled()) return;
  VERSION_TEMPLATE_DEBUG_ERRORS.push({
    time: new Date().toISOString(),
    source,
    message: String(error && error.stack || error),
  });
  if (VERSION_TEMPLATE_DEBUG_ERRORS.length > 8) {
    VERSION_TEMPLATE_DEBUG_ERRORS.splice(0, VERSION_TEMPLATE_DEBUG_ERRORS.length - 8);
  }
}

function ensureVersionTemplateDebugPanel() {
  if (!versionTemplateDebugEnabled()) return null;
  if (versionTemplateDebugPanel && document.body.contains(versionTemplateDebugPanel)) {
    return versionTemplateDebugPanel;
  }
  versionTemplateDebugPanel = document.createElement('pre');
  versionTemplateDebugPanel.className = 'version-template-debug-panel';
  document.body.appendChild(versionTemplateDebugPanel);
  return versionTemplateDebugPanel;
}

function updateVersionTemplateDebugPanel() {
  const panel = ensureVersionTemplateDebugPanel();
  if (!panel) return;
  const modalPanel = versionTemplatePanelElement();
  const main = el.versionTemplateFields?.parentElement || null;
  const fields = el.versionTemplateFields;
  const overlay = fields?.querySelector('.version-template-loading');
  const rect = fields?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const panelRect = modalPanel?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const mainRect = main?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const style = fields ? window.getComputedStyle(fields) : null;
  const lines = [
    `debug=${new Date().toISOString()}`,
    `protocol=${window.location.protocol}`,
    `modalHidden=${Boolean(el.versionTemplateModal?.hidden)}`,
    `draftGroup=${versionTemplateDraft?.group || ''}`,
    `editorMode=${versionTemplateDraft?.editorMode || ''}`,
    `editorReason=${versionTemplateDraft?.editorReason || ''}`,
    `hasEditor=${Boolean(versionTemplateEditor)}`,
    `panelClass=${modalPanel?.className || ''}`,
    `panelRect=${Math.round(panelRect.width)}x${Math.round(panelRect.height)}`,
    `mainRect=${Math.round(mainRect.width)}x${Math.round(mainRect.height)}`,
    `canvasCount=${fields?.querySelectorAll('canvas').length || 0}`,
    `svgCount=${fields?.querySelectorAll('svg').length || 0}`,
    `childCount=${fields?.childElementCount || 0}`,
    `htmlLength=${fields?.innerHTML?.length || 0}`,
    `overlayHidden=${overlay ? overlay.hidden : 'n/a'}`,
    `overlayText=${overlay?.textContent?.trim() || ''}`,
    `rect=${Math.round(rect.width)}x${Math.round(rect.height)}`,
    `display=${style?.display || ''}`,
    `visibility=${style?.visibility || ''}`,
    `position=${style?.position || ''}`,
    `firstChild=${fields?.firstElementChild?.className || fields?.firstElementChild?.tagName || ''}`,
    `status=${el.versionTemplateStatus?.textContent || ''}`,
  ];
  if (VERSION_TEMPLATE_DEBUG_ERRORS.length) {
    lines.push('errors=');
    VERSION_TEMPLATE_DEBUG_ERRORS.forEach((item) => {
      lines.push(`${item.time} ${item.source}: ${item.message}`);
    });
  }
  panel.textContent = lines.join('\n');
}

function startVersionTemplateDebugPanel() {
  if (!versionTemplateDebugEnabled()) return;
  stopVersionTemplateDebugPanel();
  ensureVersionTemplateDebugPanel();
  updateVersionTemplateDebugPanel();
  versionTemplateDebugTimer = window.setInterval(updateVersionTemplateDebugPanel, 300);
}

function stopVersionTemplateDebugPanel() {
  if (versionTemplateDebugTimer) {
    window.clearInterval(versionTemplateDebugTimer);
    versionTemplateDebugTimer = 0;
  }
}

function installVersionTemplateDebugHooks() {
  if (!versionTemplateDebugEnabled() || versionTemplateDebugHooksApplied) return;
  versionTemplateDebugHooksApplied = true;
  window.addEventListener('error', (event) => {
    pushVersionTemplateDebugError('window.error', event.error || event.message || 'unknown error');
    updateVersionTemplateDebugPanel();
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    pushVersionTemplateDebugError('window.unhandledrejection', event.reason || 'unknown rejection');
    updateVersionTemplateDebugPanel();
  });
}

function templateSheetCellValue(rawInput, fallbackValue = '') {
  if (rawInput === null || rawInput === undefined || rawInput === '') {
    return fallbackValue ?? '';
  }
  if (typeof rawInput === 'number' || typeof rawInput === 'boolean') {
    return rawInput;
  }
  const text = String(rawInput).trim();
  if (!text) return fallbackValue ?? '';
  if (text.startsWith('=')) return text;
  const parsedNumber = parseNumericCellValue(text);
  return parsedNumber !== null ? parsedNumber : text;
}

function connectorTemplateFieldKey(itemId) {
  return `connector_stage__${itemId}`;
}

function connectorTemplateJoin(values = [], separator = ' / ') {
  const list = Array.isArray(values) ? values : Array.from(values || []);
  const unique = [...new Set(list.map((value) => toText(value)).filter(Boolean))];
  return unique.join(separator);
}

function connectorTemplateJoinLines(values = []) {
  return connectorTemplateJoin(values, '\n');
}

function connectorTemplatePriceText(values = []) {
  const unique = [...new Set((values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Number(value.toFixed(4))))];
  if (!unique.length) return '';
  unique.sort((left, right) => left - right);
  if (unique.length === 1) return unique[0];
  return unique.map((value) => String(value)).join(' / ');
}

function connectorTemplateStageCandidates(fallbackKey = '') {
  return [...new Set([...connectorSelectableStageKeys, fallbackKey].filter(Boolean))]
    .map((key) => ({
      key,
      label: key === 'progress'
        ? connectorStageMetaMap.progress.label
        : (versionOptionLabel('connector', key) || key),
    }));
}

function connectorTemplateStageDisplay(stageKey, fallbackKey = '') {
  const key = stageKey || fallbackKey;
  if (!key) return '';
  const candidate = connectorTemplateStageCandidates(fallbackKey).find((item) => item.key === key);
  return candidate?.label || key;
}

function connectorTemplateStageHint(activeKey = '') {
  return connectorTemplateStageCandidates(activeKey).map((item) => item.label).join(' / ');
}

function connectorTemplateNormalizeStageInput(value) {
  const text = toText(value);
  if (!text) return '';
  const simpleFormulaMatch = text.match(/^=\s*["']?([^"']+)["']?\s*$/);
  return normalizeTemplateLookup(simpleFormulaMatch ? simpleFormulaMatch[1] : text);
}

function connectorTemplateStageKeyFromInput(value, fallbackKey = '') {
  const normalized = connectorTemplateNormalizeStageInput(value);
  if (!normalized) return fallbackKey;
  if (['跟随默认', '跟随当前', '当前默认', '当前版本', 'default', 'follow'].some((item) => normalized === normalizeTemplateLookup(item))) {
    return fallbackKey;
  }
  const match = connectorTemplateStageCandidates(fallbackKey).find((item) => {
    const keyMatch = normalizeTemplateLookup(item.key) === normalized;
    const labelMatch = normalizeTemplateLookup(item.label) === normalized;
    return keyMatch || labelMatch;
  });
  return match?.key || fallbackKey;
}

function connectorTemplateProtocolCount(summary, itemId, key) {
  if (summary) return protocolCount(summary, key);
  return protocolRowsForItem(itemId).filter((row) => row?.statusKey === key).length;
}

function connectorTemplateRolledUpStatus(summary, itemId) {
  if (summary) return protocolRolledUpLabel(summary);
  const rows = protocolRowsForItem(itemId);
  if (!rows.length) return '未配置';
  if (rows.every((row) => row?.statusKey === 'confirmed')) return '已达成';
  if (rows.every((row) => row?.statusKey === 'quoted_pending')) return '待确认';
  if (rows.every((row) => row?.statusKey === 'dev_pending')) return '开发中';
  if (rows.every((row) => row?.statusKey === 'no_reply')) return '暂无回复';
  return '部分达成';
}

function resolveConnectorTemplateItemId(groupKey = '') {
  return CONNECTOR_TEMPLATE_GROUP_TO_ITEM[groupKey] || '';
}

function collectConnectorTemplateValues(targetSet, values = []) {
  (values || []).forEach((value) => {
    const text = toText(value);
    if (text) targetSet.add(text);
  });
}

function collectConnectorTemplateVersionInfo(rowBucket, versionKey, row) {
  if (!rowBucket || !row) return;
  const versionLabel = BOM_VERSION_TEXT_MAP[versionKey] || versionKey;
  const assemblyTargets = rowBucket[`${versionKey}Assemblies`] || rowBucket.assemblyRefs;
  collectConnectorTemplateValues(assemblyTargets, [
    row.partNumber,
    ...(Array.isArray(row.assemblyRefs) ? row.assemblyRefs : []),
  ]);
  collectConnectorTemplateValues(rowBucket.suppliers, [
    ...(Array.isArray(row.suppliers) ? row.suppliers : []),
    ...(Array.isArray(row.remarks) ? row.remarks : []),
  ]);
  collectConnectorTemplateValues(rowBucket.partNumbers, [row.partNumber]);
  collectConnectorTemplateValues(rowBucket.sapNos, Array.isArray(row.sapNos) ? row.sapNos : []);
  const detailText = [
    versionLabel,
    [toText(row.partNumber), toText(row.partName)].filter(Boolean).join(' / '),
    Array.isArray(row.assemblyRefs) && row.assemblyRefs.length ? `引用:${connectorTemplateJoin(row.assemblyRefs)}` : '',
  ].filter(Boolean).join(' | ');
  if (detailText) {
    rowBucket.partDetails.add(detailText);
  }
}

function collectConnectorTemplatePartInfo(rowBucket, versionKey, part) {
  if (!rowBucket || !part) return;
  const versionLabel = BOM_VERSION_TEXT_MAP[versionKey] || versionKey;
  collectConnectorTemplateValues(rowBucket.suppliers, [
    ...(Array.isArray(part.suppliers) ? part.suppliers : []),
    ...(Array.isArray(part.remarks) ? part.remarks : []),
  ]);
  collectConnectorTemplateValues(rowBucket.partNumbers, [part.partNumber]);
  collectConnectorTemplateValues(rowBucket.sapNos, Array.isArray(part.sapNos) ? part.sapNos : []);
  const qty = Number(part.quantity);
  const qtyText = Number.isFinite(qty) && qty > 0 ? `x${qty}` : '';
  const supplierText = connectorTemplateJoin([
    ...(Array.isArray(part.suppliers) ? part.suppliers : []),
    ...(Array.isArray(part.remarks) ? part.remarks : []),
  ]);
  const sapText = connectorTemplateJoin(Array.isArray(part.sapNos) ? part.sapNos : []);
  const detailText = [
    versionLabel,
    [toText(part.partNumber), toText(part.partName)].filter(Boolean).join(' / '),
    qtyText,
    sapText ? `SAP:${sapText}` : '',
    supplierText ? `供应商:${supplierText}` : '',
  ].filter(Boolean).join(' | ');
  if (detailText) {
    rowBucket.partDetails.add(detailText);
  }
  const partKey = [
    versionKey,
    toText(part.partNumber),
    toText(part.partName),
    connectorTemplateJoin(Array.isArray(part.sapNos) ? part.sapNos : []),
    Number.isFinite(qty) ? qty : '',
    toText(part.unit),
    connectorTemplateJoin(Array.isArray(part.suppliers) ? part.suppliers : []),
    connectorTemplateJoin(Array.isArray(part.assemblyRefs) ? part.assemblyRefs : []),
  ].join('||');
  if (rowBucket.partRowKeys.has(partKey)) return;
  rowBucket.partRowKeys.add(partKey);
  rowBucket.partRows.push({
    versionKey,
    versionLabel,
    partNumber: toText(part.partNumber),
    partName: toText(part.partName),
    quantity: Number.isFinite(qty) ? qty : '',
    unit: toText(part.unit),
    suppliers: [...new Set((Array.isArray(part.suppliers) ? part.suppliers : []).map((value) => toText(value)).filter(Boolean))],
    remarks: [...new Set((Array.isArray(part.remarks) ? part.remarks : []).map((value) => toText(value)).filter(Boolean))],
    otherRemarks: [...new Set((Array.isArray(part.otherRemarks) ? part.otherRemarks : []).map((value) => toText(value)).filter(Boolean))],
    sapNos: [...new Set((Array.isArray(part.sapNos) ? part.sapNos : []).map((value) => toText(value)).filter(Boolean))],
    assemblyRefs: [...new Set((Array.isArray(part.assemblyRefs) ? part.assemblyRefs : []).map((value) => toText(value)).filter(Boolean))],
    functions: [...new Set((Array.isArray(part.functions) ? part.functions : []).map((value) => toText(value)).filter(Boolean))],
  });
}

function connectorTemplateVersionSortWeight(versionKey = '') {
  const order = ['quote', 'fixed', 'tt'];
  const index = order.indexOf(versionKey);
  return index === -1 ? order.length + 1 : index;
}

function connectorTemplateSortPartRows(rows = []) {
  return rows.slice().sort((left, right) => {
    const versionDelta = connectorTemplateVersionSortWeight(left?.versionKey) - connectorTemplateVersionSortWeight(right?.versionKey);
    if (versionDelta !== 0) return versionDelta;
    const leftPart = toText(left?.partNumber);
    const rightPart = toText(right?.partNumber);
    if (leftPart !== rightPart) return leftPart.localeCompare(rightPart, 'zh-CN');
    return toText(left?.partName).localeCompare(toText(right?.partName), 'zh-CN');
  });
}

function createConnectorTemplateSeedRow(item, activeKey, currentOverrides = {}) {
  const summary = protocolSummaryForItem(item.id);
  const rows = protocolRowsForItem(item.id);
  const recommendedStage = summary?.recommendedStage || recommendedConnectorStage(summary) || 'quote';
  const currentStage = currentOverrides[item.id] || activeKey;
  return {
    itemId: item.id,
    itemCode: toText(item.code),
    itemLabel: toText(item.name || item.label || item.id),
    assemblyRefs: new Set(),
    quoteAssemblies: new Set(),
    fixedAssemblies: new Set(),
    ttAssemblies: new Set(),
    protocolAssemblies: new Set(),
    suppliers: new Set(toText(item.supplier) ? [toText(item.supplier)] : []),
    groupLabels: new Set(),
    harnessIds: new Set(),
    partNumbers: new Set(),
    sapNos: new Set(),
    partDetails: new Set(),
    partRows: [],
    partRowKeys: new Set(),
    protocolPrices: rows.map((row) => row?.targetProtocolPrice),
    progressPrices: rows.map((row) => row?.replyPrice),
    initialQuotes: rows.map((row) => protocolRowInitialQuote(row)),
    summary,
    bomHitCount: 0,
    recommendedStage,
    currentStage,
    confirmedCount: connectorTemplateProtocolCount(summary, item.id, 'confirmed'),
    quotedPendingCount: connectorTemplateProtocolCount(summary, item.id, 'quoted_pending'),
    devPendingCount: connectorTemplateProtocolCount(summary, item.id, 'dev_pending'),
    noReplyCount: connectorTemplateProtocolCount(summary, item.id, 'no_reply'),
    statusLabel: connectorTemplateRolledUpStatus(summary, item.id),
  };
}

function finalizeConnectorTemplateRow(row) {
  const assemblyLines = connectorTemplateJoinLines(
    row.quoteAssemblies.size
      ? [...row.quoteAssemblies]
      : (row.assemblyRefs.size ? [...row.assemblyRefs] : [...row.protocolAssemblies])
  );
  const bomLocation = connectorTemplateJoinLines([
    row.groupLabels.size ? `分组：${connectorTemplateJoin(row.groupLabels, ' / ')}` : '',
    row.harnessIds.size ? `线束：${connectorTemplateJoin(row.harnessIds, ' / ')}` : '',
    row.bomHitCount ? `BOM命中：${row.bomHitCount}` : '',
  ].filter(Boolean));
  return {
    itemId: row.itemId,
    itemCode: row.itemCode,
    itemLabel: row.itemLabel,
    assemblyNo: assemblyLines,
    supplier: connectorTemplateJoin(row.suppliers),
    protocolPrice: connectorTemplatePriceText(row.protocolPrices),
    progressPrice: connectorTemplatePriceText(row.progressPrices),
    initialQuote: connectorTemplatePriceText(row.initialQuotes),
    statusLabel: row.statusLabel,
    confirmedCount: row.confirmedCount,
    quotedPendingCount: row.quotedPendingCount,
    devPendingCount: row.devPendingCount,
    noReplyCount: row.noReplyCount,
    recommendedStage: row.recommendedStage,
    recommendedStageLabel: connectorTemplateStageDisplay(row.recommendedStage, row.currentStage),
    currentStage: row.currentStage,
    currentStageLabel: connectorTemplateStageDisplay(row.currentStage, row.currentStage),
    sapNos: [...row.sapNos],
    harnessIds: [...row.harnessIds],
    groupLabels: [...row.groupLabels],
    partRows: connectorTemplateSortPartRows(row.partRows),
    partDetail: connectorTemplateJoinLines(row.partDetails),
    bomLocation,
  };
}

function buildConnectorTemplateRows(activeKey, activeOption = {}, templateSourceKey = activeKey) {
  const stageBaseKey = connectorVersionSet.has(templateSourceKey)
    ? templateSourceKey
    : (connectorVersionSet.has(activeOption?.sourceKey) ? activeOption.sourceKey : state.connector);
  const currentOverrides = sanitizeConnectorPricing(
    activeOption?.userCreated ? (activeOption.overrides || {}) : connectorPricingState,
    stageBaseKey
  );
  const savedRows = Array.isArray(activeOption?.templateRows) ? activeOption.templateRows : [];
  const savedRowMap = new Map(savedRows.filter((row) => row?.itemId).map((row) => [row.itemId, row]));

  const buckets = new Map();
  connectorItems.forEach((item) => {
    buckets.set(item.id, createConnectorTemplateSeedRow(item, stageBaseKey, currentOverrides));
  });

  const validation = RUNTIME.bomValidation;
  const harnessOrder = Array.isArray(validation?.harnessOrder) ? validation.harnessOrder : [];
  harnessOrder.forEach((harnessId) => {
    const groups = validation?.comparisons?.[harnessId]?.groups || [];
    groups.forEach((group) => {
      if (group?.section !== 'connector') return;
      const itemId = resolveConnectorTemplateItemId(group.key);
      if (!itemId || !buckets.has(itemId)) return;
      const bucket = buckets.get(itemId);
      bucket.groupLabels.add(toText(group.label || group.key));
      bucket.harnessIds.add(toText(harnessId));
      (group.aligned || []).forEach((alignedRow) => {
        bucket.bomHitCount += 1;
        Object.entries(alignedRow?.versions || {}).forEach(([versionKey, row]) => {
          collectConnectorTemplateVersionInfo(bucket, versionKey, row);
        });
        Object.entries(alignedRow?.partLists || {}).forEach(([versionKey, parts]) => {
          (parts || []).forEach((part) => collectConnectorTemplatePartInfo(bucket, versionKey, part));
        });
      });
    });
  });

  protocolRows.forEach((row) => {
    const itemId = row?.portfolioId;
    if (!itemId || !buckets.has(itemId)) return;
    const bucket = buckets.get(itemId);
    collectConnectorTemplateValues(bucket.protocolAssemblies, [protocolAssemblyNo(row)]);
    collectConnectorTemplateValues(bucket.suppliers, [row?.supplierRaw || row?.supplier]);
    if (row?.partNumber || row?.partName || row?.assemblyRemark || row?.customerRemark) {
      bucket.partDetails.add([
        '协议表',
        protocolAssemblyNo(row),
        renderProtocolPartDetail(row)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      ].filter(Boolean).join(' | '));
    }
  });

  return connectorItems
    .map((item) => {
      const row = finalizeConnectorTemplateRow(buckets.get(item.id));
      const saved = savedRowMap.get(item.id);
      const currentStage = currentOverrides[row.itemId]
        || (connectorVersionSet.has(saved?.currentStage) ? saved.currentStage : row.currentStage)
        || stageBaseKey;
      return {
        ...row,
        currentStage,
        currentStageLabel: connectorTemplateStageDisplay(currentStage, stageBaseKey),
        recommendedStageLabel: connectorTemplateStageDisplay(row.recommendedStage || stageBaseKey, stageBaseKey),
      };
    })
    .filter((row) => row && (
      row.assemblyNo
      || (Array.isArray(row.partRows) && row.partRows.length)
      || row.partDetail
      || row.protocolPrice !== ''
      || row.progressPrice !== ''
      || row.initialQuote !== ''
      || row.bomLocation
      || row.currentStage
    ));
}

function buildConnectorTemplatePayloadRows(context, rawInputs = {}) {
  const baseRows = Array.isArray(context?.connectorRows) ? context.connectorRows : [];
  return baseRows.map((row) => {
    const fieldKey = connectorTemplateFieldKey(row.itemId);
    const rawStage = rawInputs[fieldKey] ?? row.currentStageLabel ?? '';
    const stageBaseKey = context?.connectorSourceKey || context?.activeStageKey || context?.activeKey || state.connector;
    const stageKey = connectorTemplateStageKeyFromInput(rawStage, row.currentStage || stageBaseKey);
    return {
      ...clonePlain(row, {}),
      fieldKey,
      rawStageInput: rawStage,
      currentStage: stageKey,
      currentStageLabel: connectorTemplateStageDisplay(stageKey, stageBaseKey),
    };
  });
}

function buildConnectorTemplateSheetModel(context) {
  const rows = Array.isArray(context?.connectorRows) ? context.connectorRows : [];
  const sheetRows = [];
  const mergeData = [];
  const fieldAddressMap = {};
  const assemblyRows = [];
  const detailRows = [];
  let sheetRowNumber = 2;

  rows.forEach((row, index) => {
    const fieldKey = connectorTemplateFieldKey(row.itemId);
    const stageValue = templateSheetCellValue(context?.rawInputs?.[fieldKey], row.currentStageLabel || '');
    const partRows = Array.isArray(row.partRows) && row.partRows.length
      ? row.partRows
      : [{
        versionLabel: '',
        partNumber: '',
        partName: '未提取散件',
        quantity: '',
        unit: '',
        suppliers: [],
        remarks: ['当前 BOM 尚未提取到该连接器散件清单'],
        otherRemarks: [],
        sapNos: [],
        assemblyRefs: [],
        functions: [],
      }];
    const startRow = sheetRowNumber;
    fieldAddressMap[fieldKey] = `R${startRow}`;

    sheetRows.push([
      index + 1,
      row.itemLabel || row.itemCode || row.itemId,
      '总成',
      row.assemblyNo || row.itemCode || '-',
      row.itemLabel || row.itemCode || '-',
      connectorTemplateJoin(row.sapNos, ' / ') || '',
      '',
      '',
      row.supplier || '-',
      templateSheetCellValue(row.protocolPrice, ''),
      templateSheetCellValue(row.progressPrice, ''),
      templateSheetCellValue(row.initialQuote, ''),
      row.statusLabel || '-',
      row.confirmedCount ?? 0,
      row.quotedPendingCount ?? 0,
      row.devPendingCount ?? 0,
      row.noReplyCount ?? 0,
      stageValue,
      '整套价格按连接器总成执行',
      row.bomLocation || '',
    ]);
    assemblyRows.push(startRow);
    sheetRowNumber += 1;

    partRows.forEach((part) => {
      const partRemark = [
        connectorTemplateJoin(part.functions, ' / '),
        connectorTemplateJoin(part.remarks, ' / '),
        connectorTemplateJoin(part.otherRemarks, ' / '),
      ].filter(Boolean).join(' | ');
      const partLocation = part.assemblyRefs?.length ? `引用 ${connectorTemplateJoin(part.assemblyRefs)}` : '';
      sheetRows.push([
        '',
        '',
        part.versionLabel ? `散件·${part.versionLabel}` : '散件',
        part.partNumber || '-',
        part.partName || '-',
        connectorTemplateJoin(part.sapNos, ' / ') || '',
        part.quantity === '' ? '' : part.quantity,
        part.unit || '',
        connectorTemplateJoin(part.suppliers, ' / ') || '-',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        partRemark,
        partLocation,
      ]);
      detailRows.push(sheetRowNumber);
      sheetRowNumber += 1;
    });

    const endRow = sheetRowNumber - 1;
    if (endRow > startRow) {
      ['A', 'B', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].forEach((column) => {
        mergeData.push({ range: `${column}${startRow}:${column}${endRow}` });
      });
    }
  });

  return {
    rows: sheetRows,
    mergeData,
    fieldAddressMap,
    assemblyRows,
    detailRows,
  };
}

function capitalValidationAmount(scopeId, kind, fallback) {
  const summaryKey = kind === 'quote' ? 'quoteSummary' : 'fixedSummary';
  const amount = Number(CAPITAL_VALIDATION?.comparisons?.[scopeId]?.[summaryKey]?.totalNewAmount);
  return Number.isFinite(amount) ? amount : coerceNumber(fallback, 0);
}

function equipmentVersionSnapshot(versionKey) {
  const option = BASE.versions?.equipment?.[versionKey] || {};
  const quoteSnapshot = {
    kind: 'quote',
    label: `${versionOptionLabel('equipment', 'base')}设备`,
    equipment: capitalValidationAmount('equipment', 'quote', BASE.capital?.equipment),
    tooling: capitalValidationAmount('tooling', 'quote', BASE.capital?.tooling),
    fixtures: capitalValidationAmount('fixtures', 'quote', BASE.capital?.fixtures),
    rnd: coerceNumber(BASE.capital?.rnd, 0),
    factor: 1,
    sourceNote: '',
  };
  const fixedSnapshot = {
    kind: 'fixed',
    label: `${versionOptionLabel('equipment', 'shared')}设备`,
    equipment: capitalValidationAmount('equipment', 'fixed', BASE.capital?.equipment),
    tooling: capitalValidationAmount('tooling', 'fixed', BASE.capital?.tooling),
    fixtures: capitalValidationAmount('fixtures', 'fixed', BASE.capital?.fixtures),
    rnd: coerceNumber(BASE.capital?.rnd, 0),
    factor: quoteSnapshot.equipment ? capitalValidationAmount('equipment', 'fixed', BASE.capital?.equipment) / quoteSnapshot.equipment : coerceNumber(option.factor, 1),
    sourceNote: '',
  };

  if ((option.userCreated || ['equipment', 'tooling', 'fixtures', 'rnd'].some((key) => option[key] !== undefined && option[key] !== null && option[key] !== ''))) {
    const equipment = coerceNumber(option.equipment, fixedSnapshot.equipment);
    const tooling = coerceNumber(option.tooling, fixedSnapshot.tooling);
    const fixtures = coerceNumber(option.fixtures, fixedSnapshot.fixtures);
    const rnd = coerceNumber(option.rnd, fixedSnapshot.rnd);
    return {
      kind: option.kind || 'custom',
      label: option.label || `${versionOptionLabel('equipment', versionKey)}设备`,
      equipment,
      tooling,
      fixtures,
      rnd,
      factor: quoteSnapshot.equipment ? equipment / quoteSnapshot.equipment : coerceNumber(option.factor, 1),
      sourceNote: option.sourceNote || '',
    };
  }

  if (versionKey === 'base') return quoteSnapshot;
  if (versionKey === 'shared') return fixedSnapshot;

  const scale = coerceNumber(option.factor, 1) || 1;
  return {
    kind: option.kind || 'tt',
    label: option.label || `${versionOptionLabel('equipment', versionKey)}设备`,
    equipment: fixedSnapshot.equipment * scale,
    tooling: fixedSnapshot.tooling * scale,
    fixtures: fixedSnapshot.fixtures * scale,
    rnd: fixedSnapshot.rnd,
    factor: scale,
    sourceNote: option.sourceNote || '',
  };
}

function suggestNewVersionLabel(group) {
  const baseLabel = versionOptionLabel(group, state[group]) || VERSION_GROUP_LABELS[group] || '新版本';
  const existingLabels = new Set(Object.values(BASE.versions?.[group] || {}).map((option) => option?.label).filter(Boolean));
  let index = Object.values(BASE.versions?.[group] || {}).filter((option) => option?.userCreated).length + 1;
  let candidate = `${baseLabel}-${index}`;
  while (existingLabels.has(candidate)) {
    index += 1;
    candidate = `${baseLabel}-${index}`;
  }
  return candidate;
}

function makeUserVersionKey(group) {
  let key = `user_${group}_${Date.now().toString(36)}`;
  let suffix = 2;
  while (BASE.versions?.[group]?.[key]) {
    key = `user_${group}_${Date.now().toString(36)}_${suffix}`;
    suffix += 1;
  }
  return key;
}

function inferImportedBomWorkbookVersionKey(record = {}) {
  const optionText = [
    record.versionKey,
    record.meta?.runtimeVersionKey,
    record.versionLabel,
    record.workbook?.workbookName,
    record.workbook?.sourceFileName,
    record.meta?.sourceFileName,
  ].filter(Boolean).join(' ');
  if (/tt/i.test(optionText)) return 'tt';
  if (/定点|fixed/i.test(optionText)) return 'fixed';
  if (/报价|quote/i.test(optionText)) return 'quote';
  return resolveWorkbookVersionKeyFromBomState();
}

function importedBomStateKeyFromWorkbookVersion(workbookVersionKey = '') {
  if (workbookVersionKey === 'fixed') return 'light';
  if (workbookVersionKey === 'tt') return 'regress';
  return 'freeze';
}

function getBomNativeVersionId(bomKey = state.bom) {
  const option = BASE.versions?.bom?.[bomKey] || {};
  return toText(option.nativeWorkbookVersionId, '');
}

function isUniverWorkbookSnapshot(value) {
  return Boolean(value && Array.isArray(value.sheetOrder) && value.sheets && !Array.isArray(value.sheets));
}

function buildSeedBomWorkbookSnapshotForOption(bomKey = state.bom, option = BASE.versions?.bom?.[bomKey] || null) {
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState(bomKey);
  if (!runtimeHelper || !RUNTIME?.bomWorkbookCopies || !workbookVersionKey) {
    return null;
  }

  try {
    if (runtimeHelper.buildWorkbookSnapshotFromSeed) {
      const seedPayload = RUNTIME?.bomWorkbookCopies?.versions?.[workbookVersionKey];
      const runtimeSnapshot = runtimeHelper.buildWorkbookSnapshotFromSeed(seedPayload, {
        workbookName: toText(option?.workbook, option?.label || workbookVersionKey),
      });
      if (isUniverWorkbookSnapshot(runtimeSnapshot)) {
        return runtimeSnapshot;
      }
    }
    if (runtimeHelper.buildVersionWorkbookSnapshot) {
      const runtimeSnapshot = runtimeHelper.buildVersionWorkbookSnapshot(workbookVersionKey, {
        source: RUNTIME.bomWorkbookCopies,
        workbookName: toText(option?.workbook, option?.label || workbookVersionKey),
      });
      if (isUniverWorkbookSnapshot(runtimeSnapshot)) {
        return runtimeSnapshot;
      }
    }
  } catch (error) {
    console.warn('[G281Dashboard] Failed to build runtime BOM snapshot', error);
  }

  return null;
}

async function resolveBomWorkbookSnapshotForOption(bomKey = state.bom) {
  const option = BASE.versions?.bom?.[bomKey] || null;
  if (!option) {
    return null;
  }

  if (isUniverWorkbookSnapshot(option.templateWorkbookSnapshot)) {
    return clonePlain(option.templateWorkbookSnapshot, null);
  }

  const seededSnapshot = buildSeedBomWorkbookSnapshotForOption(bomKey, option);
  if (!option.userCreated && isUniverWorkbookSnapshot(seededSnapshot)) {
    return seededSnapshot;
  }

  const nativeVersionId = toText(option.nativeWorkbookVersionId, '');
  if (nativeVersionId && factorVersionRepo?.getSnapshotByVersionId) {
    try {
      const persistedSnapshot = await factorVersionRepo.getSnapshotByVersionId(nativeVersionId, 'bom');
      if (isUniverWorkbookSnapshot(persistedSnapshot)) {
        return clonePlain(persistedSnapshot, null);
      }
    } catch (error) {
      console.warn('[G281Dashboard] Failed to load persisted BOM snapshot', error);
    }
  }

  if (isUniverWorkbookSnapshot(seededSnapshot)) {
    return seededSnapshot;
  }

  return null;
}

async function ensureBomSemanticReleaseForVersion(bomKey = state.bom, options = {}) {
  const option = BASE.versions?.bom?.[bomKey] || null;
  if (!option || !bomSemanticRepo?.saveBomReleaseFromSnapshot) {
    return null;
  }
  const parserVersion = toText(window.G281BomParser?.PARSER_VERSION, '');

  const existingReleaseId = toText(option.semanticReleaseId, '');
  if (existingReleaseId && !options.forceRefresh) {
    try {
      const existingGraph = await bomSemanticRepo.getBomReleaseGraph(existingReleaseId);
      const existingMeta = existingGraph?.release?.meta || {};
      const parserVersionMismatch = parserVersion && toText(existingMeta.parserVersion, '') !== parserVersion;
      const isStaleSeedRelease = !option.userCreated
        && resolveWorkbookVersionKeyFromBomState(bomKey)
        && Number(existingMeta.harnessCount || 0) <= 0;
      if (existingGraph?.release && !isStaleSeedRelease && !parserVersionMismatch) {
        return {
          releaseId: existingReleaseId,
          release: existingGraph.release,
          summary: clonePlain(option.semanticSummary, null),
          refreshed: false,
        };
      }
    } catch (error) {
      console.warn('[G281Dashboard] Failed to load existing semantic BOM release', error);
    }
  }

  const workbookSnapshot = await resolveBomWorkbookSnapshotForOption(bomKey);
  if (!isUniverWorkbookSnapshot(workbookSnapshot)) {
    return null;
  }

  let nativeVersionId = toText(option.nativeWorkbookVersionId, '');
  if (!nativeVersionId && factorVersionRepo?.saveFactorVersionFromSnapshot) {
    try {
      const storedSnapshot = await factorVersionRepo.saveFactorVersionFromSnapshot({
        factorType: 'bom',
        projectCode: PROJECT_CODE,
        versionId: `bom-native::${PROJECT_CODE}::${bomKey}`,
        versionLabel: option.label || bomKey,
        workbookSnapshot,
        workbookName: toText(option.workbook, option.label || bomKey),
        sourceType: 'runtime-seed',
        status: 'active',
        meta: {
          runtimeBomKey: bomKey,
          workbookVersionKey: resolveWorkbookVersionKeyFromBomState(bomKey),
        },
      });
      nativeVersionId = toText(storedSnapshot?.versionId, '');
      option.nativeWorkbookVersionId = nativeVersionId;
      option.factorSnapshotId = toText(storedSnapshot?.snapshotId, '');
    } catch (error) {
      console.warn('[G281Dashboard] Failed to persist native BOM snapshot before semantic parse', error);
    }
  }

  try {
    const semanticRecord = await bomSemanticRepo.saveBomReleaseFromSnapshot({
      releaseId: toText(options.releaseId, existingReleaseId || nativeVersionId || `bom-release::${PROJECT_CODE}::${bomKey}`),
      versionId: toText(options.versionId, nativeVersionId || existingReleaseId || `bom-release::${PROJECT_CODE}::${bomKey}`),
      releaseLabel: option.label || bomKey,
      versionLabel: option.label || bomKey,
      projectCode: PROJECT_CODE,
      snapshotId: toText(option.factorSnapshotId, ''),
      baseReleaseId: toText(options.baseReleaseId, ''),
      workbookSnapshot,
    });
    option.semanticReleaseId = semanticRecord?.releaseId || '';
    option.semanticSummary = clonePlain(semanticRecord?.summary, null);
    persistUserVersions();
    return {
      ...semanticRecord,
      refreshed: true,
    };
  } catch (error) {
    console.warn('[G281Dashboard] Failed to ensure semantic BOM release', error);
    return null;
  }
}

async function compareBomSemanticReleases(leftReleaseId, rightReleaseId, options = {}) {
  if (!leftReleaseId || !rightReleaseId || !bomSemanticRepo?.getBomReleaseGraph || !bomAlignmentEngine?.alignBomReleases || !bomDiffEngine?.buildBomDiffResult) {
    return null;
  }

  if (!options.forceRefresh && bomSemanticRepo?.getBomDiffResult) {
    try {
      const cached = await bomSemanticRepo.getBomDiffResult(leftReleaseId, rightReleaseId);
      if (cached && Array.isArray(cached.harnesses) && cached.harnesses.length) {
        return cached;
      }
    } catch (error) {
      console.warn('[G281Dashboard] Failed to read cached BOM diff result', error);
    }
  }

  try {
    const [leftGraph, rightGraph] = await Promise.all([
      bomSemanticRepo.getBomReleaseGraph(leftReleaseId),
      bomSemanticRepo.getBomReleaseGraph(rightReleaseId),
    ]);
    if (!leftGraph?.release || !rightGraph?.release) {
      return null;
    }
    const alignment = bomAlignmentEngine.alignBomReleases(leftGraph, rightGraph, {
      leftLabel: toText(options.leftLabel, leftGraph.release?.releaseLabel || leftReleaseId),
      rightLabel: toText(options.rightLabel, rightGraph.release?.releaseLabel || rightReleaseId),
    });
    const diffPayload = bomDiffEngine.buildBomDiffResult(alignment, {
      leftLabel: toText(options.leftLabel, leftGraph.release?.releaseLabel || leftReleaseId),
      rightLabel: toText(options.rightLabel, rightGraph.release?.releaseLabel || rightReleaseId),
      leftGraph,
      rightGraph,
    });
    if (bomSemanticRepo?.saveBomDiffResult) {
      return bomSemanticRepo.saveBomDiffResult(leftReleaseId, rightReleaseId, diffPayload);
    }
    return diffPayload;
  } catch (error) {
    console.warn('[G281Dashboard] Failed to compare semantic BOM releases', error);
    return null;
  }
}

async function compareBomVersions(leftBomKey, rightBomKey, options = {}) {
  const normalizedLeftKey = BASE.versions?.bom?.[leftBomKey] ? leftBomKey : state.bom;
  const normalizedRightKey = BASE.versions?.bom?.[rightBomKey] ? rightBomKey : state.bom;
  const leftRecord = await ensureBomSemanticReleaseForVersion(normalizedLeftKey, options);
  const rightRecord = await ensureBomSemanticReleaseForVersion(normalizedRightKey, options);
  if (!leftRecord?.releaseId || !rightRecord?.releaseId) {
    return null;
  }
  const shouldForceRefresh = Boolean(options.forceRefresh || leftRecord?.refreshed || rightRecord?.refreshed);
  return compareBomSemanticReleases(leftRecord.releaseId, rightRecord.releaseId, {
    ...options,
    forceRefresh: shouldForceRefresh,
    leftLabel: toText(options.leftLabel, BASE.versions?.bom?.[normalizedLeftKey]?.label || normalizedLeftKey),
    rightLabel: toText(options.rightLabel, BASE.versions?.bom?.[normalizedRightKey]?.label || normalizedRightKey),
  });
}

function importNativeBomVersion(record = {}, options = {}) {
  if (!record || typeof record !== 'object') {
    throw new Error('Native BOM record is required');
  }
  if (!BASE.versions?.bom) {
    throw new Error('BOM version store is not ready');
  }

  const workbookVersionKey = inferImportedBomWorkbookVersionKey(record);
  const seedBomKey = importedBomStateKeyFromWorkbookVersion(workbookVersionKey);
  const seedSnapshot = bomVersionSnapshot(seedBomKey) || {};
  const sourceFileName = toText(record.workbook?.sourceFileName, toText(record.meta?.sourceFileName, ''));
  const workbookName = toText(record.workbook?.workbookName, toText(record.versionLabel, sourceFileName || '导入 BOM'));
  const label = toText(options.label, workbookName || sourceFileName || suggestNewVersionLabel('bom'));
  const key = makeUserVersionKey('bom');
  const sourceText = sourceFileName || workbookName || label;
  const nextOption = buildUserVersionOption('bom', label, {
    kind: 'imported',
    factor: Number.isFinite(Number(seedSnapshot.materialFactor)) ? Number(seedSnapshot.materialFactor) : 1,
    wireFactor: Number.isFinite(Number(seedSnapshot.wireFactor)) ? Number(seedSnapshot.wireFactor) : 1,
    draft: clonePlain(seedSnapshot.draft, currentBomDraftSnapshot()) || currentBomDraftSnapshot(),
    workbook: workbookName || sourceText,
    source: sourceText,
    sourceNote: `来源：导入 Excel BOM ${sourceText}，整本工作簿已写入原生 BOM 库，可在 BOM 管理中继续导出。`,
    totalMeter: Number(seedSnapshot.totalMeter) || 0,
    wireMeter: Number(seedSnapshot.wireMeter) || 0,
    tapeMeter: Number(seedSnapshot.tapeMeter) || 0,
    tubeMeter: Number(seedSnapshot.tubeMeter) || 0,
    actualLengthChangeSummary: clonePlain(seedSnapshot.actualLengthChangeSummary, null),
  });

  nextOption.nativeWorkbookVersionId = toText(record.versionId, '');
  nextOption.nativeProjectId = toText(record.projectId, '');
  nextOption.nativeSourceType = toText(record.sourceType, '');
  nextOption.workbookVersionKeyFallback = workbookVersionKey;
  nextOption.importedAt = record.updatedAt || new Date().toISOString();
  nextOption.note = `导入 Excel BOM 版本，已同步到左侧 BOM 版本管理。`;

  BASE.versions.bom[key] = nextOption;
  state.bom = key;
  applyVersionPreset('bom', key);
  persistUserVersions();
  renderVersions();
  queueRender();

  return {
    versionKey: key,
    versionLabel: label,
    nativeWorkbookVersionId: nextOption.nativeWorkbookVersionId,
    workbookVersionKey,
  };
}

async function saveEditableBomWorkbookVersion(options = {}) {
  if (!BASE.versions?.bom) {
    throw new Error('BOM version store is not ready');
  }

  const requestedBaseKey = toText(options.baseVersionKey, state.bom);
  const activeKey = BASE.versions?.bom?.[requestedBaseKey] ? requestedBaseKey : state.bom;
  const activeOption = BASE.versions?.bom?.[activeKey] || {};
  const activeLabel = versionOptionLabel('bom', activeKey) || activeOption.label || activeKey || '当前 BOM 版本';
  const requestedMode = options.mode === 'update-current' ? 'update-current' : 'save-as-new';
  const actualMode = requestedMode === 'update-current' && activeOption.userCreated ? 'update-current' : 'save-as-new';
  const workbookSnapshot = clonePlain(options.workbookSnapshot, null);
  if (!workbookSnapshot?.sheetOrder?.length || !workbookSnapshot?.sheets) {
    throw new Error('Editable workbook snapshot is required');
  }

  const snapshot = bomVersionSnapshot(activeKey) || {};
  const fallbackWorkbookVersionKey = toText(
    options.workbookVersionKeyFallback,
    toText(activeOption.workbookVersionKeyFallback, resolveWorkbookVersionKeyFromBomState(activeKey)),
  );
  const label = toText(
    options.label,
    actualMode === 'update-current'
      ? (activeOption.label || activeLabel || suggestNewVersionLabel('bom'))
      : suggestNewVersionLabel('bom'),
  );
  const source = toText(
    options.source,
    toText(activeOption.templateSource || activeOption.source || activeOption.workbook, snapshot.workbook || label),
  );
  const templateNote = toText(options.note, toText(activeOption.templateNote || activeOption.note, ''));
  const payload = {
    kind: toText(options.kind, activeOption.kind || snapshot.kind || 'custom'),
    factor: options.factor !== undefined
      ? coerceNumber(options.factor, 1)
      : (Number(snapshot.materialFactor) || Number(activeOption.factor) || 1),
    wireFactor: options.wireFactor !== undefined
      ? coerceNumber(options.wireFactor, 1)
      : (Number(snapshot.wireFactor) || Number(activeOption.wireFactor) || 1),
    draft: clonePlain(options.draft, clonePlain(activeOption.draft, snapshot.draft || currentBomDraftSnapshot())) || currentBomDraftSnapshot(),
    workbook: toText(options.workbook, source || snapshot.workbook || label),
    source,
    sourceNote: actualMode === 'update-current'
      ? `来源：Excel 整表编辑，已覆盖当前 BOM 版本 ${activeLabel}。`
      : `来源：Excel 整表编辑，基于 ${activeLabel} 另存为新 BOM 版本。`,
    templateNote,
    templateWorkbookSnapshot: workbookSnapshot,
    totalMeter: options.totalMeter !== undefined
      ? coerceNumber(options.totalMeter, 0)
      : (Number(snapshot.totalMeter) || Number(activeOption.totalMeter) || 0),
    wireMeter: options.wireMeter !== undefined
      ? coerceNumber(options.wireMeter, 0)
      : (Number(snapshot.wireMeter) || Number(activeOption.wireMeter) || 0),
    tapeMeter: options.tapeMeter !== undefined
      ? coerceNumber(options.tapeMeter, 0)
      : (Number(snapshot.tapeMeter) || Number(activeOption.tapeMeter) || 0),
    tubeMeter: options.tubeMeter !== undefined
      ? coerceNumber(options.tubeMeter, 0)
      : (Number(snapshot.tubeMeter) || Number(activeOption.tubeMeter) || 0),
    actualLengthChangeSummary: clonePlain(
      options.actualLengthChangeSummary,
      clonePlain(activeOption.actualLengthChangeSummary, snapshot.actualLengthChangeSummary || null),
    ),
  };

  const timestamp = new Date().toISOString();
  const targetKey = actualMode === 'update-current' ? activeKey : makeUserVersionKey('bom');
  const nextOption = buildUserVersionOption('bom', label, payload);
  nextOption.updatedAt = timestamp;
  nextOption.createdAt = actualMode === 'update-current'
    ? toText(activeOption.createdAt, timestamp)
    : timestamp;
  nextOption.templateSource = source;
  nextOption.source = source;
  nextOption.note = actualMode === 'update-current'
    ? `Excel 整表编辑已保存到当前 BOM 版本：${label}`
    : `Excel 整表编辑另存为新 BOM 版本：${label}`;
  nextOption.workbookVersionKeyFallback = fallbackWorkbookVersionKey;

  if (activeOption.nativeWorkbookVersionId) {
    nextOption.nativeWorkbookVersionId = activeOption.nativeWorkbookVersionId;
  }
  if (activeOption.nativeProjectId) {
    nextOption.nativeProjectId = activeOption.nativeProjectId;
  }
  if (activeOption.nativeSourceType) {
    nextOption.nativeSourceType = activeOption.nativeSourceType;
  }

  BASE.versions.bom[targetKey] = nextOption;
  const persistedRecord = await persistVersionOptionToStore('bom', targetKey, nextOption, {
    ...payload,
    workbookVersionKeyFallback: fallbackWorkbookVersionKey,
  }, {
    sourceType: 'workbook-viewer',
    status: 'released',
    baseReleaseId: toText(activeOption.semanticReleaseId, toText(activeOption.nativeWorkbookVersionId, '')),
    baseLabel: activeLabel,
  });
  if (persistedRecord?.versionId) {
    nextOption.nativeWorkbookVersionId = persistedRecord.versionId;
  }
  state.bom = targetKey;
  applyVersionPreset('bom', targetKey);
  persistUserVersions();
  renderVersions();
  queueRender();

  return {
    versionKey: targetKey,
    versionLabel: label,
    requestedMode,
    actualMode,
    message: actualMode === 'update-current'
      ? `已保存当前 BOM 版本：${label}`
      : `已另存为新 BOM 版本：${label}`,
    option: clonePlain(nextOption, null),
  };
}

function saveEditableBomWorkbookVersionLegacyLocal(options = {}) {
  if (!BASE.versions?.bom) {
    throw new Error('BOM version store is not ready');
  }

  const requestedBaseKey = toText(options.baseVersionKey, state.bom);
  const activeKey = BASE.versions?.bom?.[requestedBaseKey] ? requestedBaseKey : state.bom;
  const activeOption = BASE.versions?.bom?.[activeKey] || {};
  const activeLabel = versionOptionLabel('bom', activeKey) || activeOption.label || activeKey || '当前 BOM 版本';
  const requestedMode = options.mode === 'update-current' ? 'update-current' : 'save-as-new';
  const actualMode = requestedMode === 'update-current' && activeOption.userCreated ? 'update-current' : 'save-as-new';
  const workbookSnapshot = clonePlain(options.workbookSnapshot, null);
  if (!workbookSnapshot?.sheetOrder?.length || !workbookSnapshot?.sheets) {
    throw new Error('Editable workbook snapshot is required');
  }

  const snapshot = bomVersionSnapshot(activeKey) || {};
  const fallbackWorkbookVersionKey = toText(
    options.workbookVersionKeyFallback,
    toText(activeOption.workbookVersionKeyFallback, resolveWorkbookVersionKeyFromBomState(activeKey)),
  );
  const label = toText(
    options.label,
    actualMode === 'update-current'
      ? (activeOption.label || activeLabel || suggestNewVersionLabel('bom'))
      : suggestNewVersionLabel('bom'),
  );
  const source = toText(
    options.source,
    toText(activeOption.templateSource || activeOption.source || activeOption.workbook, snapshot.workbook || label),
  );
  const templateNote = toText(options.note, toText(activeOption.templateNote || activeOption.note, ''));
  const payload = {
    kind: toText(options.kind, activeOption.kind || snapshot.kind || 'custom'),
    factor: options.factor !== undefined
      ? coerceNumber(options.factor, 1)
      : (Number(snapshot.materialFactor) || Number(activeOption.factor) || 1),
    wireFactor: options.wireFactor !== undefined
      ? coerceNumber(options.wireFactor, 1)
      : (Number(snapshot.wireFactor) || Number(activeOption.wireFactor) || 1),
    draft: clonePlain(options.draft, clonePlain(activeOption.draft, snapshot.draft || currentBomDraftSnapshot())) || currentBomDraftSnapshot(),
    workbook: toText(options.workbook, source || snapshot.workbook || label),
    source,
    sourceNote: actualMode === 'update-current'
      ? `来源：Excel 整表编辑，已覆盖当前 BOM 版本 ${activeLabel}。`
      : `来源：Excel 整表编辑，基于 ${activeLabel} 另存为新 BOM 版本。`,
    templateNote,
    templateWorkbookSnapshot: workbookSnapshot,
    totalMeter: options.totalMeter !== undefined
      ? coerceNumber(options.totalMeter, 0)
      : (Number(snapshot.totalMeter) || Number(activeOption.totalMeter) || 0),
    wireMeter: options.wireMeter !== undefined
      ? coerceNumber(options.wireMeter, 0)
      : (Number(snapshot.wireMeter) || Number(activeOption.wireMeter) || 0),
    tapeMeter: options.tapeMeter !== undefined
      ? coerceNumber(options.tapeMeter, 0)
      : (Number(snapshot.tapeMeter) || Number(activeOption.tapeMeter) || 0),
    tubeMeter: options.tubeMeter !== undefined
      ? coerceNumber(options.tubeMeter, 0)
      : (Number(snapshot.tubeMeter) || Number(activeOption.tubeMeter) || 0),
    actualLengthChangeSummary: clonePlain(
      options.actualLengthChangeSummary,
      clonePlain(activeOption.actualLengthChangeSummary, snapshot.actualLengthChangeSummary || null),
    ),
  };

  const timestamp = new Date().toISOString();
  const targetKey = actualMode === 'update-current' ? activeKey : makeUserVersionKey('bom');
  const nextOption = buildUserVersionOption('bom', label, payload);
  nextOption.updatedAt = timestamp;
  nextOption.createdAt = actualMode === 'update-current'
    ? toText(activeOption.createdAt, timestamp)
    : timestamp;
  nextOption.templateSource = source;
  nextOption.source = source;
  nextOption.note = actualMode === 'update-current'
    ? `Excel 整表编辑已保存到当前 BOM 版本：${label}`
    : `Excel 整表编辑另存为新 BOM 版本：${label}`;
  nextOption.workbookVersionKeyFallback = fallbackWorkbookVersionKey;

  if (activeOption.nativeWorkbookVersionId) {
    nextOption.nativeWorkbookVersionId = activeOption.nativeWorkbookVersionId;
  }
  if (activeOption.nativeProjectId) {
    nextOption.nativeProjectId = activeOption.nativeProjectId;
  }
  if (activeOption.nativeSourceType) {
    nextOption.nativeSourceType = activeOption.nativeSourceType;
  }

  BASE.versions.bom[targetKey] = nextOption;
  state.bom = targetKey;
  applyVersionPreset('bom', targetKey);
  persistUserVersions();
  renderVersions();
  queueRender();

  return {
    versionKey: targetKey,
    versionLabel: label,
    requestedMode,
    actualMode,
    message: actualMode === 'update-current'
      ? `已保存当前 BOM 版本：${label}`
      : `已另存为新 BOM 版本：${label}`,
    option: clonePlain(nextOption, null),
  };
}

function finalizeVersionTemplateContext(context, storedState = {}) {
  if (!context) return null;
  const fields = (context.fields || []).map((field, index) => ({
    ...field,
    address: storedState.fieldAddressMap?.[field.key] || field.address || templateFieldAddress(context.group, index),
  }));
  const rawInputs = fields.reduce((acc, field) => {
    if (storedState.rawInputs && Object.prototype.hasOwnProperty.call(storedState.rawInputs, field.key)) {
      acc[field.key] = storedState.rawInputs[field.key];
      return acc;
    }
    acc[field.key] = context.values?.[field.key] ?? '';
    return acc;
  }, {});
  const univerEnabled = canUseUniverTemplateEditor();
  return {
    ...context,
    editorMode: univerEnabled ? 'univer' : 'fallback',
    editorReason: univerEnabled ? (isLocalFileProtocol() ? 'univer-local-file' : 'univer') : 'fallback',
    fields,
    rawInputs,
    workbookSnapshot: clonePlain(storedState.workbookSnapshot ?? context.workbookSnapshot, null),
    skipFieldOverlay: univerEnabled
      ? Boolean(storedState.skipFieldOverlay ?? context.skipFieldOverlay)
      : false,
  };
}

function buildBomWorkbookTemplateContext(activeKey) {
  const runtimeHelper = window.G281BomTemplateRuntime;
  if (!runtimeHelper) return null;
  const versionKey = resolveWorkbookVersionKeyFromBomState(activeKey);
  if (runtimeHelper.buildGenericBomTemplateContextWithUniver) {
    return runtimeHelper.buildGenericBomTemplateContextWithUniver({
      versionKey,
      source: RUNTIME?.bomWorkbookCopies,
      workbookName: '通用BOM模板',
      sourceFileName: '通用BOM模板.xlsx',
    });
  }
  if (runtimeHelper.buildVersionTemplateContextWithUniver) {
    return runtimeHelper.buildVersionTemplateContextWithUniver({
      versionKey,
      source: RUNTIME?.bomWorkbookCopies,
    });
  }
  if (runtimeHelper.buildBomTemplateContext) {
    return runtimeHelper.buildBomTemplateContext({
      runtime: RUNTIME,
      versionKey,
    });
  }
  if (runtimeHelper.buildVersionTemplateContext) {
    return runtimeHelper.buildVersionTemplateContext(versionKey, {
      source: RUNTIME?.bomWorkbookCopies,
    });
  }
  return null;
}

function excelColumnLabelToNumber(label) {
  const text = String(label || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(text)) return 0;
  return text.split('').reduce((sum, char) => (sum * 26) + (char.charCodeAt(0) - 64), 0);
}

function normalizeConfigSheetRowDimensions(rowDimensions) {
  return Object.entries(rowDimensions || {}).reduce((acc, [rowKey, payload]) => {
    const row = Number(rowKey);
    if (!Number.isFinite(row) || row <= 0) return acc;
    acc.push({
      row,
      ...(payload || {}),
    });
    return acc;
  }, []);
}

function normalizeConfigSheetColumnDimensions(columnDimensions) {
  return Object.entries(columnDimensions || {}).reduce((acc, [columnKey, payload]) => {
    const columnIndex = excelColumnLabelToNumber(columnKey);
    const min = Number(payload?.min) || columnIndex;
    const max = Number(payload?.max) || min;
    if (!Number.isFinite(min) || min <= 0 || !Number.isFinite(max) || max < min) return acc;
    acc.push({
      index: min,
      min,
      max,
      ...(payload || {}),
    });
    return acc;
  }, []);
}

function normalizeConfigSheetCells(cells) {
  return (Array.isArray(cells) ? cells : []).reduce((acc, cell) => {
    const row = Number(cell?.r);
    const column = Number(cell?.c);
    if (!Number.isFinite(row) || row <= 0 || !Number.isFinite(column) || column <= 0) {
      return acc;
    }
    acc.push({
      address: toText(cell?.addr, ''),
      row,
      column,
      value: Object.prototype.hasOwnProperty.call(cell || {}, 'displayValue')
        ? cell.displayValue
        : (Object.prototype.hasOwnProperty.call(cell || {}, 'value') ? cell.value : null),
      formula: cell?.formula ? String(cell.formula) : null,
      dataType: toText(cell?.type, ''),
      styleId: Number.isFinite(Number(cell?.styleId)) ? Number(cell.styleId) : null,
      comment: clonePlain(cell?.comment, null),
      hyperlink: toText(cell?.hyperlink, ''),
    });
    return acc;
  }, []);
}

function buildConfigSheetWorkbookSeed(versionKey = state.configSheet, option = BASE.versions?.configSheet?.[versionKey] || {}) {
  const runtimeVersionKey = toText(option?.workbookVersionKeyFallback, versionKey);
  const runtimeVersion = RUNTIME.configSheetCopies?.versions?.[runtimeVersionKey] || null;
  const rawSnapshot = runtimeVersion?.snapshot || null;
  if (!rawSnapshot) {
    return null;
  }
  const sheetName = toText(rawSnapshot.sheetName, toText(runtimeVersion?.sheetName, '配置清单'));
  const workbookName = toText(option?.workbook, toText(runtimeVersion?.workbook, `${sheetName}.xlsx`));
  return {
    workbookName,
    sourceFileName: toText(runtimeVersion?.workbook, workbookName),
    sourcePath: toText(runtimeVersion?.workbookPath, ''),
    sheetOrder: [sheetName],
    hiddenSheets: rawSnapshot?.metadata?.sheetState === 'hidden' ? [sheetName] : [],
    styleTable: clonePlain(rawSnapshot?.stylePool, {}),
    sheets: [
      {
        workbookSheetIndex: Number(runtimeVersion?.sheetIndex) || 0,
        sheetName,
        sheetState: toText(rawSnapshot?.metadata?.sheetState, 'visible'),
        isHidden: rawSnapshot?.metadata?.sheetState === 'hidden',
        sheetOrderKey: sheetName,
        dimensionRef: toText(rawSnapshot?.dimension, ''),
        maxRow: Number(rawSnapshot?.maxRow) || 0,
        maxColumn: Number(rawSnapshot?.maxColumn) || 0,
        sheetFormat: {
          defaultRowHeight: rawSnapshot?.defaultRowHeight ?? null,
          defaultColWidth: rawSnapshot?.defaultColWidth ?? null,
          pageSetup: clonePlain(rawSnapshot?.pageSetup, {}),
        },
        sheetView: clonePlain(rawSnapshot?.sheetView, {}),
        freezePane: toText(rawSnapshot?.freezePanes, ''),
        mergedRanges: clonePlain(rawSnapshot?.mergedRanges, []),
        rowDimensions: normalizeConfigSheetRowDimensions(rawSnapshot?.rowDimensions),
        columnDimensions: normalizeConfigSheetColumnDimensions(rawSnapshot?.columnDimensions),
        hiddenRows: clonePlain(rawSnapshot?.hiddenRows, []),
        hiddenColumns: clonePlain(rawSnapshot?.hiddenColumns, []),
        cells: normalizeConfigSheetCells(rawSnapshot?.cells),
      },
    ],
  };
}

function buildConfigSheetWorkbookSnapshot(versionKey = state.configSheet, option = BASE.versions?.configSheet?.[versionKey] || {}) {
  if (isUniverWorkbookSnapshot(option?.templateWorkbookSnapshot)) {
    return clonePlain(option.templateWorkbookSnapshot, null);
  }
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  const workbookSeed = buildConfigSheetWorkbookSeed(versionKey, option);
  if (!runtimeHelper?.buildWorkbookSnapshotFromSeed || !workbookSeed) {
    return null;
  }
  try {
    return runtimeHelper.buildWorkbookSnapshotFromSeed(workbookSeed, {
      workbookName: workbookSeed.workbookName || '配置清单模板',
    });
  } catch (error) {
    console.warn('[G281Dashboard] Failed to build config-sheet workbook snapshot', error);
    return null;
  }
}

function configSheetVersionSourceText(versionKey) {
  const option = BASE.versions?.configSheet?.[versionKey] || {};
  const runtimeVersionKey = toText(option?.workbookVersionKeyFallback, versionKey);
  const runtimeVersion = RUNTIME.configSheetCopies?.versions?.[runtimeVersionKey] || null;
  if (option?.sourceNote) {
    return option.sourceNote;
  }
  if (option?.userCreated) {
    return `来源：配置清单 Excel 式版本。基于 ${toText(option?.templateSource, versionOptionLabel('configSheet', runtimeVersionKey) || runtimeVersionKey)} 继续维护。`;
  }
  if (runtimeVersion?.workbook) {
    return `来源：${runtimeVersion.workbook}《配置清单》`;
  }
  return '来源：配置清单内置版本模板';
}

function resolveConfigSheetRuntimeVersionKey(versionKey = state.configSheet) {
  const option = BASE.versions?.configSheet?.[versionKey] || {};
  const candidate = toText(option?.workbookVersionKeyFallback, versionKey);
  if (RUNTIME.configSheetCopies?.versions?.[candidate]) {
    return candidate;
  }
  return listConfigSheetRuntimeVersionKeys()[0] || 'quote';
}

function buildVersionTemplateContext(group) {
  const activeKey = state[group];
  const activeLabel = versionOptionLabel(group, activeKey) || VERSION_GROUP_LABELS[group] || group;
  const activeOption = BASE.versions?.[group]?.[activeKey] || {};
  const runtimeHelper = window.G281BomTemplateRuntime || null;
  const storedWorkbookSeed = clonePlain(activeOption.templateWorkbookSeed, null);
  const storedFieldAddressMap = clonePlain(activeOption.templateFieldAddressMap, null);
  const storedWorkbookSnapshot = clonePlain(activeOption.templateWorkbookSnapshot, null)
    || (
      storedWorkbookSeed
      && runtimeHelper?.buildWorkbookSnapshotFromSeed
      ? runtimeHelper.buildWorkbookSnapshotFromSeed(storedWorkbookSeed, {
        workbookName: storedWorkbookSeed.workbookName || `${activeLabel}模板`,
      })
      : null
    );
  const hasStoredWorkbookSnapshot = Boolean(storedWorkbookSnapshot?.sheetOrder?.length);
  const hasStoredFieldAddressMap = Boolean(storedFieldAddressMap && Object.keys(storedFieldAddressMap).length);
  const storedTemplateState = {
    rawInputs: clonePlain(activeOption.templateRawInputs, null),
    fieldAddressMap: storedFieldAddressMap,
    workbookSnapshot: storedWorkbookSnapshot,
    skipFieldOverlay: hasStoredWorkbookSnapshot
      ? (hasStoredFieldAddressMap ? false : Boolean(storedWorkbookSnapshot?.sheetOrder?.length > 1))
      : null,
  };
  const storedTemplateSource = toText(activeOption.templateSource || activeOption.source || activeOption.workbook || '');
  const storedTemplateNote = toText(activeOption.templateNote || '');

  if (group === 'bom') {
    const snapshot = bomVersionSnapshot(activeKey);
    const draft = { ...(snapshot?.draft || {}), ...currentBomDraftSnapshot() };
    const workbookTemplate = buildBomWorkbookTemplateContext(activeKey);
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: 'BOM 模板',
      title: '新增 BOM 模板版本',
      subtitle: `参考当前 ${activeLabel}，可手工补入材料系数、长度汇总和工程口径参数，适合后续继续导入新 BOM 版本。`,
      pasteHint: '支持从 Excel 粘贴单列或多列数值，也支持“字段名 + 数值”两列粘贴。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource || workbookTemplate?.sourceFileName || snapshot?.workbook || '',
      note: storedTemplateNote,
      workbookSnapshot: clonePlain(workbookTemplate?.workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookTemplate?.workbookSnapshot),
      values: {
        factor: coerceNumber(snapshot?.materialFactor, 1),
        wireFactor: coerceNumber(snapshot?.wireFactor, 1),
        totalMeter: coerceNumber(snapshot?.totalMeter, 0),
        wireMeter: coerceNumber(snapshot?.wireMeter, 0),
        tapeMeter: coerceNumber(snapshot?.tapeMeter, 0),
        tubeMeter: coerceNumber(snapshot?.tubeMeter, 0),
        bomWireDrawing: coerceNumber(draft.bomWireDrawing, 0),
        bomWireEat: coerceNumber(draft.bomWireEat, 0),
        bomWireHidden: coerceNumber(draft.bomWireHidden, 0),
        bomTapeDiameter: coerceNumber(draft.bomTapeDiameter, 0),
        bomTapeWidth: coerceNumber(draft.bomTapeWidth, 0),
        bomTapeOverlap: coerceNumber(draft.bomTapeOverlap, 0),
      },
      fields: [
        { key: 'factor', label: '材料系数', section: '结构系数', unit: 'x', step: '0.001', min: '0', aliases: ['材料系数', 'BOM系数'] },
        { key: 'wireFactor', label: '导线系数', section: '结构系数', unit: 'x', step: '0.001', min: '0', aliases: ['导线系数', '线长系数'] },
        { key: 'totalMeter', label: '总长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['总长度', '总米数'] },
        { key: 'wireMeter', label: '导线长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['导线长度', '导线米数'] },
        { key: 'tapeMeter', label: '胶带长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['胶带长度', '胶带米数'] },
        { key: 'tubeMeter', label: '套管长度', section: '长度汇总', unit: 'm', step: '0.001', min: '0', aliases: ['套管长度', '套管米数'] },
        { key: 'bomWireDrawing', label: '图纸线长', section: '工艺参数', unit: 'mm', step: '1', min: '0', aliases: ['图纸线长', '图纸长度'] },
        { key: 'bomWireEat', label: '吃线尺寸', section: '工艺参数', unit: 'mm', step: '1', min: '0', aliases: ['吃线尺寸', '吃线'] },
        { key: 'bomWireHidden', label: '隐藏余量', section: '工艺参数', unit: 'mm', step: '1', min: '0', aliases: ['隐藏余量', '余量'] },
        { key: 'bomTapeDiameter', label: '线径', section: '工艺参数', unit: 'mm', step: '0.1', min: '0', aliases: ['线径', '胶带线径'] },
        { key: 'bomTapeWidth', label: '胶带宽度', section: '工艺参数', unit: 'mm', step: '0.1', min: '0', aliases: ['胶带宽度', '带宽'] },
        { key: 'bomTapeOverlap', label: '重叠率', section: '工艺参数', unit: '%', step: '1', min: '0', aliases: ['重叠率', '搭接率'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'metal') {
    const snapshot = metalVersionSnapshot(activeKey) || {};
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '铜铝基价模板',
      title: '新增铜铝基价版本',
      subtitle: `参考当前 ${activeLabel}，可直接在右侧按 Excel 方式录入铜价和铝价，保存后进入左侧版本管理。`,
      pasteHint: '支持直接粘贴两行数值，顺序为铜价、铝价；也支持在单元格内写公式。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: {
        copperPrice: coerceNumber(controls.copperPrice?.value, coerceNumber(snapshot.copperPrice, BASE.copperPrice || 0)),
        aluminumPrice: coerceNumber(controls.aluminumPrice?.value, coerceNumber(snapshot.aluminumPrice, BASE.aluminumPrice || 0)),
      },
      fields: [
        { key: 'copperPrice', label: '铜价', section: '铜铝基价', unit: '元/吨', step: '100', min: '0', aliases: ['铜价', '铜基价', 'copper'] },
        { key: 'aluminumPrice', label: '铝价', section: '铜铝基价', unit: '元/吨', step: '100', min: '0', aliases: ['铝价', '铝基价', 'aluminum'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'connector') {
    const connectorSourceKey = connectorVersionSet.has(activeKey)
      ? activeKey
      : (connectorVersionSet.has(activeOption?.sourceKey) ? activeOption.sourceKey : state.connector);
    const rows = buildConnectorTemplateRows(activeKey, activeOption, connectorSourceKey);
    const connectorSheetModel = buildConnectorTemplateSheetModel({
      connectorRows: rows,
      rawInputs: storedTemplateState.rawInputs,
    });
    const values = rows.reduce((acc, row) => {
      acc[connectorTemplateFieldKey(row.itemId)] = row.currentStageLabel;
      return acc;
    }, {});
    const fields = rows.map((row, index) => ({
      key: connectorTemplateFieldKey(row.itemId),
      label: `${row.itemLabel} 执行档位`,
      section: '连接器执行档位',
      unit: '-',
      aliases: [row.itemLabel, row.itemCode, row.itemId, '执行档位'],
      hint: `可填写：${connectorTemplateStageHint(connectorSourceKey)}`,
      address: connectorSheetModel.fieldAddressMap[connectorTemplateFieldKey(row.itemId)] || `R${index + 2}`,
      itemId: row.itemId,
    }));
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeStageKey: connectorSourceKey,
      connectorSourceKey,
      activeLabel,
      eyebrow: '连接器价格模板',
      title: '新增连接器价格版本',
      subtitle: `自动从当前已录入 BOM 提取连接器总成/散件信息，并带入协议价、进度价、初始报价；保存后生成新的连接器价格版本。`,
      pasteHint: '支持整列粘贴执行档位；建议填写 报价版 / 定点版 / 进度价，也支持继续在右侧 Excel 区补充内容。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource || '当前BOM提取 + 连接器协议价状态',
      note: storedTemplateNote,
      values,
      fields,
      connectorRows: rows,
      connectorSheetRows: connectorSheetModel.rows,
      connectorMergeData: connectorSheetModel.mergeData,
      connectorAssemblyRows: connectorSheetModel.assemblyRows,
      connectorDetailRows: connectorSheetModel.detailRows,
    }, storedTemplateState);
  }

  if (group === 'labor') {
    const snapshot = laborVersionSnapshot(activeKey);
    const draft = currentLaborDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '工时模板',
      title: '新增工时模板版本',
      subtitle: `参考当前 ${activeLabel}，可把核算表中的工时与费率直接粘贴进来，保存后立即生成新的工时版本。`,
      pasteHint: '建议按“直接人工工时、直接人工费率、制造工时、制造费率”顺序粘贴。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: {
        directHours: coerceNumber(draft.directHours, coerceNumber(snapshot?.directHours, 0)),
        directRate: coerceNumber(draft.directRate, coerceNumber(snapshot?.directRate, 0)),
        manufacturingHours: coerceNumber(draft.manufacturingHours, coerceNumber(snapshot?.manufacturingHours, 0)),
        manufacturingRate: coerceNumber(draft.manufacturingRate, coerceNumber(snapshot?.manufacturingRate, 0)),
      },
      fields: [
        { key: 'directHours', label: '直接人工工时', section: '前工程', unit: 'h/套', step: '0.01', min: '0', aliases: ['直接人工工时', '前工程工时', '直接工时'] },
        { key: 'directRate', label: '直接人工费率', section: '前工程', unit: '元/h', step: '0.1', min: '0', aliases: ['直接人工费率', '前工程费率', '直接费率'] },
        { key: 'manufacturingHours', label: '制造工时', section: '后工程', unit: 'h/套', step: '0.01', min: '0', aliases: ['制造工时', '后工程工时'] },
        { key: 'manufacturingRate', label: '制造费率', section: '后工程', unit: '元/h', step: '0.1', min: '0', aliases: ['制造费率', '后工程费率'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'equipment') {
    const snapshot = equipmentVersionSnapshot(activeKey);
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '设备资源模板',
      title: '新增设备资源模板版本',
      subtitle: `参考当前 ${activeLabel}，可直接录入设备投资、专用模具、项目工装和研发费用，保存后自动进入版本管理。`,
      pasteHint: '支持粘贴核算表汇总金额，默认按“设备投资、专用模具、项目工装、研发费用”识别。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: {
        equipment: coerceNumber(snapshot?.equipment, 0),
        tooling: coerceNumber(snapshot?.tooling, 0),
        fixtures: coerceNumber(snapshot?.fixtures, 0),
        rnd: coerceNumber(snapshot?.rnd, 0),
      },
      fields: [
        { key: 'equipment', label: '设备投资', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['设备投资', '设备资源'] },
        { key: 'tooling', label: '专用模具', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['专用模具', '项目专用模具'] },
        { key: 'fixtures', label: '项目工装', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['项目工装', '工装投入'] },
        { key: 'rnd', label: '研发费用', section: '资本投入', unit: '元', step: '0.01', min: '0', aliases: ['研发费用', '开发费用'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'packaging') {
    const snapshot = packagingVersionSnapshot(activeKey);
    const draft = currentPackagingDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '包装物流模板',
      title: '新增包装物流模板版本',
      subtitle: `参考当前 ${activeLabel}，可直接粘贴包装物流拆分项，保存后同步到左侧版本管理。`,
      pasteHint: '建议按“内外包装、运输费、仓储费、短驳/其他”顺序粘贴。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: '',
      note: '',
      values: {
        packInner: coerceNumber(draft.packInner, coerceNumber(snapshot?.packInner, 0)),
        packFreight: coerceNumber(draft.packFreight, coerceNumber(snapshot?.packFreight, 0)),
        packWarehouse: coerceNumber(draft.packWarehouse, coerceNumber(snapshot?.packWarehouse, 0)),
        packOther: coerceNumber(draft.packOther, coerceNumber(snapshot?.packOther, 0)),
      },
      fields: [
        { key: 'packInner', label: '内外包装', section: '包装', unit: '元/套', step: '0.01', min: '0', aliases: ['内外包装', '包装费'] },
        { key: 'packFreight', label: '运输费', section: '物流', unit: '元/套', step: '0.01', min: '0', aliases: ['运输费', '运费'] },
        { key: 'packWarehouse', label: '仓储费', section: '物流', unit: '元/套', step: '0.01', min: '0', aliases: ['仓储费', '仓储'] },
        { key: 'packOther', label: '短驳/其他', section: '物流', unit: '元/套', step: '0.01', min: '0', aliases: ['短驳', '其他', '短驳其他'] },
      ],
    }, storedTemplateState);
  }

  if (group === 'configSheet') {
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || buildConfigSheetWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildConfigSheetWorkbookSnapshot(activeKey, activeOption);
    const runtimeVersionKey = resolveConfigSheetRuntimeVersionKey(activeKey);
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      runtimeVersionKey,
      activeLabel,
      eyebrow: '配置清单模板',
      title: '新增配置清单版本',
      subtitle: `参考当前 ${activeLabel}，右侧保留配置清单整表格式，可直接按 Excel 习惯维护配置总成与车型差异。`,
      pasteHint: '支持在右侧工作簿内直接编辑、粘贴、合并单元格、增加行列与新增 Sheet，保存后生成新的配置清单版本。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource || toText(activeOption.workbook, ''),
      note: storedTemplateNote,
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
    });
  }

  if (group === 'sales') {
    const volumes = currentSalesDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '销量预测模板',
      title: '新增销量预测模板版本',
      subtitle: `参考当前 ${activeLabel}，可录入整段生命周期销量预测，后续新增版本也能继续沿用这个模板。`,
      pasteHint: '支持粘贴 6 年销量；如果带年份列，系统会优先按年份匹配。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: BASE.years.reduce((acc, year, index) => {
        acc[`sales_${year}`] = coerceNumber(volumes[index], 0);
        return acc;
      }, {}),
      fields: BASE.years.map((year, index) => ({
        key: `sales_${year}`,
        label: `${year} 销量`,
        section: '年度销量',
        unit: '套',
        step: '1',
        min: '0',
        aliases: [String(year), `${year}销量`, `销量${year}`],
        index,
      })),
    }, storedTemplateState);
  }

  if (group === 'mix') {
    const values = currentMixDraftSnapshot();
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '配置比例模板',
      title: '新增配置比例模板版本',
      subtitle: `参考当前 ${activeLabel}，可录入各车型配置比例；保存时会自动归一化到 100%。`,
      pasteHint: '支持粘贴 4 行配置比例；若带车型名称或 CM 编号，系统会优先按车型匹配。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      values: BASE.configNames.reduce((acc, name, index) => {
        acc[`mix_${index}`] = coerceNumber(values[index], 0);
        return acc;
      }, {}),
      fields: BASE.configNames.map((name, index) => {
        const code = String(name).split(/\s+/)[0];
        return {
          key: `mix_${index}`,
          label: name,
          section: '车型配置',
          unit: '%',
          step: '0.1',
          min: '0',
          aliases: [name, code, `配置${index + 1}`],
          index,
        };
      }),
    }, storedTemplateState);
  }

  if (group === 'annualDrop') {
    const snapshot = annualDropVersionSnapshot(activeKey);
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || annualDropWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '年降模板');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '年降模板',
      title: '新增年降版本',
      subtitle: `参考当前 ${activeLabel}，右侧为年降 Excel 工作簿，可按生命周期逐年维护 ASP 年降率，并继续使用公式、筛选、插行插列。`,
      pasteHint: '右侧 Excel 工作簿保留“年份 / 年降率 / 当年ASP系数 / 说明”，可直接粘贴多行年度数据。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      yearRows: clonePlain(snapshot?.yearRows, []),
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      fieldAddressMap: null,
    });
  }

  if (group === 'oneTimeCustomer') {
    const snapshot = oneTimeCustomerVersionSnapshot(activeKey);
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || oneTimeCustomerWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '一次性费用模板');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '一次性费用模板',
      title: '新增一次性费用(客户支付)版本',
      subtitle: `参考当前 ${activeLabel}，右侧为一次性费用 Excel 工作簿，支持“客户直付 / 按量分摊”两种方式，并保留工装费、试验费、研发费等 Sheet。`,
      pasteHint: '右侧 Excel 工作簿保留“类别 / 金额 / 方式 / 确认年份 / 分摊起始年 / 分摊总量 / 备注”，可直接粘贴多行明细。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      entries: clonePlain(snapshot?.entries, []),
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      fieldAddressMap: null,
    });
  }

  if (group === 'rebate') {
    const snapshot = rebateVersionSnapshot(activeKey);
    const workbookSeed = clonePlain(activeOption.templateWorkbookSeed, null) || rebateWorkbookSeed(activeKey, activeOption);
    const workbookSnapshot = storedTemplateState.workbookSnapshot || buildLifecycleWorkbookSnapshotFromSeed(workbookSeed, '返点模板');
    return finalizeVersionTemplateContext({
      group,
      activeKey,
      activeLabel,
      eyebrow: '返点模板',
      title: '新增返点版本',
      subtitle: `参考当前 ${activeLabel}，右侧为返点 Excel 工作簿，可按年度维护返点总额，利润引擎会按当年销量折算到单套。`,
      pasteHint: '右侧 Excel 工作簿保留“年份 / 年度返点总额 / 备注”，可直接粘贴多年返点计划。',
      suggestedLabel: suggestNewVersionLabel(group),
      source: storedTemplateSource,
      note: storedTemplateNote,
      yearRows: clonePlain(snapshot?.yearRows, []),
      templateWorkbookSeed: clonePlain(workbookSeed, null),
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      values: {},
      fields: [],
    }, {
      ...storedTemplateState,
      workbookSnapshot: clonePlain(workbookSnapshot, null),
      skipFieldOverlay: Boolean(workbookSnapshot),
      fieldAddressMap: null,
    });
  }
  return null;
}

function versionTemplatePanelElement() {
  return el.versionTemplateModal?.querySelector('.version-template-panel') || null;
}

function versionTemplateModalElement() {
  return el.versionTemplateModal || null;
}

function applyVersionTemplateWindowShellState() {
  const modal = versionTemplateModalElement();
  if (!modal) return;
  const active = !modal.hidden;
  const minimized = modal.classList.contains('is-window-minimized');
  document.body.classList.toggle('bom-modal-open', active && !minimized);
}

function syncVersionTemplateWindowControls() {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  const minimized = Boolean(modal?.classList.contains('is-window-minimized'));
  const maximized = Boolean(panel?.classList.contains('is-window-maximized'));
  if (el.minimizeVersionTemplateWindowBtn) {
    el.minimizeVersionTemplateWindowBtn.setAttribute('aria-label', minimized ? '还原窗口' : '最小化');
    el.minimizeVersionTemplateWindowBtn.setAttribute('title', minimized ? '还原窗口' : '最小化');
    el.minimizeVersionTemplateWindowBtn.classList.toggle('is-active', minimized);
    el.minimizeVersionTemplateWindowBtn.setAttribute('aria-pressed', minimized ? 'true' : 'false');
  }
  if (el.toggleVersionTemplateWindowBtn) {
    el.toggleVersionTemplateWindowBtn.classList.toggle('is-restored', maximized);
    el.toggleVersionTemplateWindowBtn.setAttribute('aria-pressed', maximized ? 'true' : 'false');
    el.toggleVersionTemplateWindowBtn.setAttribute('aria-label', maximized ? '还原窗口' : '放大窗口');
    el.toggleVersionTemplateWindowBtn.setAttribute('title', maximized ? '还原窗口' : '放大窗口');
  }
}

function resetVersionTemplateWindowState() {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  if (!modal || !panel) return;
  modal.classList.remove('is-window-minimized');
  panel.classList.remove('is-window-maximized');
  modal.classList.remove('is-window-maximized');
  syncVersionTemplateWindowControls();
  applyVersionTemplateWindowShellState();
}

function setVersionTemplateWindowMaximized(force) {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  if (!panel) return;
  if (modal?.classList.contains('is-window-minimized')) {
    modal.classList.remove('is-window-minimized');
  }
  const next = typeof force === 'boolean'
    ? force
    : !panel.classList.contains('is-window-maximized');
  panel.classList.toggle('is-window-maximized', next);
  modal?.classList.toggle('is-window-maximized', next);
  syncVersionTemplateWindowControls();
  applyVersionTemplateWindowShellState();
  startVersionTemplateReadyWatch(versionTemplateDraft);
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    updateVersionTemplateDebugPanel();
  });
}

function setVersionTemplateWindowMinimized(force) {
  const modal = versionTemplateModalElement();
  const panel = versionTemplatePanelElement();
  if (!modal || !panel || modal.hidden) return;
  const next = typeof force === 'boolean'
    ? force
    : !modal.classList.contains('is-window-minimized');
  modal.classList.toggle('is-window-minimized', next);
  if (next) {
    panel.classList.remove('is-window-maximized');
    modal.classList.remove('is-window-maximized');
  }
  syncVersionTemplateWindowControls();
  applyVersionTemplateWindowShellState();
  if (!next) {
    startVersionTemplateReadyWatch(versionTemplateDraft);
  }
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    updateVersionTemplateDebugPanel();
  });
}

function disconnectVersionTemplateResizeObserver() {
  if (!versionTemplateResizeObserver) return;
  versionTemplateResizeObserver.disconnect();
  versionTemplateResizeObserver = null;
}

function syncVersionTemplatePanelMode(editorEnabled = false) {
  const panel = versionTemplatePanelElement();
  if (!panel) return;
  const isSheetMode = editorEnabled && VERSION_TEMPLATE_GROUPS.has(versionTemplateDraft?.group);
  panel.classList.toggle('is-bom-sheet-mode', isSheetMode);
  panel.dataset.templateGroup = versionTemplateDraft?.group || '';
  if (el.versionTemplateQuickbar) {
    el.versionTemplateQuickbar.hidden = !isSheetMode;
  }
}

function ensureVersionTemplateResizeObserver() {
  const panel = versionTemplatePanelElement();
  if (!panel || typeof ResizeObserver !== 'function') return;
  disconnectVersionTemplateResizeObserver();
  versionTemplateResizeObserver = new ResizeObserver(() => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });
  versionTemplateResizeObserver.observe(panel);
}

function setVersionTemplateEditorMode(enabled) {
  const panel = versionTemplatePanelElement();
  if (panel) panel.classList.toggle('is-univer-mode', enabled);
  syncVersionTemplatePanelMode(enabled);
  if (el.versionTemplateParseBtn) {
    el.versionTemplateParseBtn.hidden = enabled;
    el.versionTemplateParseBtn.disabled = enabled;
  }
  if (el.versionTemplatePaste) {
    el.versionTemplatePaste.hidden = enabled;
    el.versionTemplatePaste.disabled = enabled;
  }
  if (el.versionTemplatePasteHint && enabled) {
    el.versionTemplatePasteHint.textContent = '右侧已切换为 Excel 式编辑区，可直接粘贴区域、输入公式、拖动填充。';
  }
  updateVersionTemplateStatusMeta();
  updateVersionTemplateDebugPanel();
}

function getVersionTemplateSelectionLabel() {
  const selection = versionTemplateEditor?.getSelectionSnapshot?.();
  return selection?.a1 ? `当前选区 ${selection.a1}` : '当前选区';
}

function runVersionTemplateQuickAction(action) {
  if (!versionTemplateEditor || !VERSION_TEMPLATE_GROUPS.has(versionTemplateDraft?.group)) {
    updateVersionTemplateStatus('Excel 编辑区尚未准备完成，请等待工作表加载后再操作。');
    return false;
  }
  let success = false;
  let message = '';
  const selectionLabel = getVersionTemplateSelectionLabel();
  switch (action) {
    case 'insert-row':
      success = Boolean(versionTemplateEditor.insertRowsAfterSelection?.(1));
      message = `已在 ${selectionLabel} 下方插入 1 行。`;
      break;
    case 'insert-column':
      success = Boolean(versionTemplateEditor.insertColumnsAfterSelection?.(1));
      message = `已在 ${selectionLabel} 右侧插入 1 列。`;
      break;
    case 'merge':
      success = Boolean(versionTemplateEditor.mergeSelection?.());
      message = `已对 ${selectionLabel} 执行合并。`;
      break;
    case 'unmerge':
      success = Boolean(versionTemplateEditor.unmergeSelection?.());
      message = `已对 ${selectionLabel} 取消合并。`;
      break;
    case 'filter':
      success = Boolean(versionTemplateEditor.toggleFilter?.());
      message = `已调用筛选命令，请在 ${selectionLabel} 所在表头继续设置筛选。`;
      break;
    case 'conditional':
      success = Boolean(versionTemplateEditor.openConditionalFormattingPanel?.());
      message = '已打开条件格式面板。';
      break;
    case 'image':
      success = Boolean(versionTemplateEditor.openImageMenu?.());
      message = '已展开图片插入菜单。';
      break;
    case 'add-sheet':
      success = Boolean(versionTemplateEditor.appendSheet?.());
      message = '已新增一个工作表。';
      break;
    default:
      success = false;
  }
  if (!success) {
    updateVersionTemplateStatus('当前操作未成功，请先点击工作表中的目标单元格或稍后重试。');
    return false;
  }
  updateVersionTemplateStatus(message);
  updateVersionTemplateStatusMeta();
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
  return true;
}

function ensureVersionTemplateEditor() {
  if (!canUseUniverTemplateEditor() || !el.versionTemplateFields) return null;
  if (!versionTemplateEditor) {
    try {
      el.versionTemplateFields.innerHTML = '';
      versionTemplateEditor = window.G281UniverTemplateEditor.create(el.versionTemplateFields);
    } catch (error) {
      pushVersionTemplateDebugError('ensureVersionTemplateEditor.create', error);
      console.error('Failed to create Univer template editor', error);
      versionTemplateEditor = null;
    }
  }
  updateVersionTemplateStatusMeta();
  updateVersionTemplateDebugPanel();
  return versionTemplateEditor;
}

function disposeVersionTemplateEditor() {
  if (!versionTemplateEditor) return;
  try {
    versionTemplateEditor.destroy?.();
  } catch (error) {
    pushVersionTemplateDebugError('disposeVersionTemplateEditor.destroy', error);
    console.error('Failed to dispose Univer template editor', error);
  }
  versionTemplateEditor = null;
  if (el.versionTemplateFields) {
    el.versionTemplateFields.innerHTML = '';
  }
  updateVersionTemplateStatusMeta();
  updateVersionTemplateDebugPanel();
}

function ensureVersionTemplateLoadingOverlay() {
  if (!el.versionTemplateFields) return null;
  let overlay = el.versionTemplateFields.querySelector('.version-template-loading');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'version-template-loading';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="version-template-loading-card">
        <div class="version-template-loading-spinner" aria-hidden="true"></div>
        <div class="version-template-loading-text">正在加载 Excel 编辑区...</div>
      </div>
    `;
    el.versionTemplateFields.appendChild(overlay);
  }
  return overlay;
}

function setVersionTemplateLoadingState(active, text = '') {
  const overlay = ensureVersionTemplateLoadingOverlay();
  if (!overlay) return;
  overlay.hidden = !active;
  if (text) {
    const textNode = overlay.querySelector('.version-template-loading-text');
    if (textNode) textNode.textContent = text;
  }
  updateVersionTemplateDebugPanel();
}

function stopVersionTemplateReadyWatch() {
  if (versionTemplateReadyWatchTimer) {
    window.clearInterval(versionTemplateReadyWatchTimer);
    versionTemplateReadyWatchTimer = 0;
  }
}

function finalizeVersionTemplateReady(context) {
  if (!context || versionTemplateDraft !== context || context.editorMode !== 'univer') return false;
  if (!versionTemplateEditorAppearsReady()) return false;
  stopVersionTemplateReadyWatch();
  setVersionTemplateLoadingState(false);
  updateVersionTemplateStatus(versionTemplateStatusText(context));
  updateVersionTemplateDebugPanel();
  return true;
}

function startVersionTemplateReadyWatch(context) {
  stopVersionTemplateReadyWatch();
  if (!context || context.editorMode !== 'univer') return;
  if (finalizeVersionTemplateReady(context)) return;
  const startedAt = Date.now();
  const maxDuration = isLocalFileProtocol() ? 30000 : 12000;
  versionTemplateReadyWatchTimer = window.setInterval(() => {
    if (versionTemplateDraft !== context || context.editorMode !== 'univer') {
      stopVersionTemplateReadyWatch();
      return;
    }
    if (finalizeVersionTemplateReady(context)) return;
    if (Date.now() - startedAt >= maxDuration) {
      stopVersionTemplateReadyWatch();
      updateVersionTemplateDebugPanel();
    }
  }, 250);
}

function clearVersionTemplateRenderMonitor() {
  versionTemplateRenderToken += 1;
  if (Array.isArray(versionTemplateRenderMonitor)) {
    versionTemplateRenderMonitor.forEach((timerId) => clearTimeout(timerId));
  }
  versionTemplateRenderMonitor = [];
  stopVersionTemplateReadyWatch();
  setVersionTemplateLoadingState(false);
  updateVersionTemplateDebugPanel();
}

function versionTemplateEditorAppearsReady() {
  if (!el.versionTemplateFields) return false;
  return el.versionTemplateFields.querySelectorAll('canvas').length > 0;
}

function pokeVersionTemplateEditorLayout() {
  if (!el.versionTemplateFields) return;
  el.versionTemplateFields.getBoundingClientRect();
  versionTemplatePanelElement()?.getBoundingClientRect();
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    updateVersionTemplateDebugPanel();
  });
}

function versionTemplateMountReady() {
  if (!el.versionTemplateFields) return false;
  const rect = el.versionTemplateFields.getBoundingClientRect();
  return rect.width > 240 && rect.height > 180;
}

function queueVersionTemplateFieldsRender(context) {
  if (!context) return;
  if (context.editorMode !== 'univer') {
    renderVersionTemplateFields(context);
    return;
  }

  setVersionTemplateEditorMode(true);
  const token = ++versionTemplateRenderToken;
  const loadingText = isLocalFileProtocol()
    ? '正在初始化离线 Excel 编辑区，首次打开可能需要 1-3 秒...'
    : '正在加载 Excel 编辑区...';
  setVersionTemplateLoadingState(true, loadingText);
  startVersionTemplateReadyWatch(context);

  let attempts = 0;
  const run = () => {
    if (token !== versionTemplateRenderToken || versionTemplateDraft !== context || el.versionTemplateModal?.hidden) {
      return;
    }
    attempts += 1;
    if (versionTemplateMountReady() || attempts >= 8) {
      renderVersionTemplateFields(context);
      return;
    }
    window.requestAnimationFrame(() => {
      setTimeout(run, 40);
    });
  };

  window.requestAnimationFrame(() => {
    setTimeout(run, 20);
  });
  updateVersionTemplateDebugPanel();
}

function scheduleVersionTemplateEditorWarmup(context) {
  clearVersionTemplateRenderMonitor();
  if (!context || context.editorMode !== 'univer') return;

  const token = versionTemplateRenderToken;
  const loadingText = isLocalFileProtocol()
    ? '正在初始化离线 Excel 编辑区，首次打开可能需要 1-3 秒...'
    : '正在加载 Excel 编辑区...';
  setVersionTemplateLoadingState(true, loadingText);

  let reinitialized = false;
  const checkpoints = [0, 120, 320, 800, 1600, 3000, 5000];
  versionTemplateRenderMonitor = checkpoints.map((delay, index) => setTimeout(() => {
    if (token !== versionTemplateRenderToken || versionTemplateDraft !== context || context.editorMode !== 'univer') {
      return;
    }
    if (versionTemplateEditorAppearsReady()) {
      setVersionTemplateLoadingState(false);
      updateVersionTemplateStatus(versionTemplateStatusText(context));
      return;
    }
    if (isLocalFileProtocol() && !reinitialized && delay >= 800) {
      reinitialized = true;
      disposeVersionTemplateEditor();
      if (token !== versionTemplateRenderToken || versionTemplateDraft !== context) return;
      queueVersionTemplateFieldsRender(context);
      return;
    }
    pokeVersionTemplateEditorLayout();
    if (index === checkpoints.length - 1) {
      updateVersionTemplateStatus(`当前参考版本：${context.activeLabel}。Excel 编辑区仍在初始化，请稍等片刻；若持续空白，可先关闭再重新打开。`);
    }
    updateVersionTemplateDebugPanel();
  }, delay));
}

function buildCurrentBomHarnessRows() {
  const extract = getActiveBomAutoExtract();
  const lineItems = Array.isArray(extract?.lineItems) ? extract.lineItems : [];
  const buckets = new Map();
  lineItems.forEach((item) => {
    const harnessId = toText(item?.harnessId, '');
    const harnessName = toText(item?.harnessName, harnessId || '未识别线束');
    const key = harnessId || harnessName || `row_${item?.rowIndex || buckets.size + 1}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        harnessId: harnessId || harnessName || '-',
        harnessName: harnessName || harnessId || '-',
        bomItemCount: 0,
        wireLineCount: 0,
        connectorLineCount: 0,
        otherLineCount: 0,
        totalQuantity: 0,
        sourceLabel: extract?.sourceLabel || '',
        sourceSheetName: extract?.sourceSheetName || '',
      });
    }
    const row = buckets.get(key);
    row.bomItemCount += 1;
    row.totalQuantity += Number(item?.quantity) || 0;
    if (isActiveBomWireItem(item)) {
      row.wireLineCount += 1;
    } else if (isActiveBomConnectorItem(item)) {
      row.connectorLineCount += 1;
    } else {
      row.otherLineCount += 1;
    }
  });
  return Array.from(buckets.values()).sort((left, right) => {
    const leftKey = String(left.harnessId || left.harnessName || '');
    const rightKey = String(right.harnessId || right.harnessName || '');
    return leftKey.localeCompare(rightKey, 'zh-CN', { numeric: true });
  });
}

function buildGenericVersionTemplateSheetSpec(context) {
  const lastRow = context.fields.length + 1;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix: [
      ['NO.', 'Function / 分类', 'Part Number / 模板编码', 'Part Name / 项目名称', 'SPEC / 录入说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 维护提示'],
      ...context.fields.map((field, index) => ([
        index + 1,
        field.section || '模板项目',
        field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
        field.label,
        field.spec || `${field.label} 维护项`,
        templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
        field.unit || '-',
        '手工维护',
        field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
      ])),
    ],
    columnWidths: [56, 120, 160, 220, 180, 150, 84, 118, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => (index === 0 ? 40 : 30)),
    frozenRows: 1,
    styles: [
      { range: `A1:I${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#e2e8f0' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${lastRow}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${lastRow}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${lastRow}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${lastRow}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${lastRow}`, background: '#fcfdff', wrap: true },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildBomVersionTemplateSheetSpec(context) {
  const lastRow = context.fields.length + 1;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix: [
      ['NO.', 'Function / 功能', 'Part Number / 参数编码', 'Part Name / 参数名称', 'SPEC / 口径说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 系统映射'],
      ...context.fields.map((field, index) => ([
        index + 1,
        field.section || 'BOM参数',
        field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
        field.label,
        field.spec || `${field.label}维护项`,
        templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
        field.unit || '-',
        '手工维护',
        field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
      ])),
    ],
    columnWidths: [56, 120, 160, 220, 180, 150, 84, 118, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => (index === 0 ? 40 : 30)),
    frozenRows: 1,
    styles: [
      { range: `A1:I${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#e2e8f0' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${lastRow}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${lastRow}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${lastRow}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${lastRow}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${lastRow}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${lastRow}`, background: '#fcfdff', wrap: true },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildLaborVersionTemplateSheetSpec(context) {
  const harnessRows = buildCurrentBomHarnessRows();
  const baseRows = context.fields.map((field, index) => ([
    index + 1,
    field.section || '工时模板',
    field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
    field.label,
    field.spec || `${field.label} 维护项`,
    templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
    field.unit || '-',
    '手工维护',
    field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
  ]));
  const sectionHeaderRow = context.fields.length + 3;
  const detailHeaderRow = sectionHeaderRow + 1;
  const detailRows = harnessRows.length
    ? harnessRows.map((row) => ([
      '',
      row.harnessId || '-',
      row.harnessName || row.harnessId || '-',
      Number(row.bomItemCount) || 0,
      Number(row.wireLineCount) || 0,
      '',
      '',
      '',
      '',
      row.sourceLabel ? `${row.sourceLabel}${row.sourceSheetName ? ` · ${row.sourceSheetName}` : ''}` : '来源于当前 BOM',
    ]))
    : [['', '当前 BOM 暂无线束展开', '', '', '', '', '', '', '', '']];
  const matrix = [
    ['NO.', 'Function / 分类', 'Part Number / 模板编码', 'Part Name / 项目名称', 'SPEC / 录入说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 维护提示'],
    ...baseRows,
    ['', '', '', '', '', '', '', '', ''],
    ['', '线束展开', '', '', '', '', '', '', ''],
    ['', '线束号', '线束名称', 'BOM条目', '导线条数', '前工程工时', '前工程费率', '后工程工时', '后工程费率', '备注'],
    ...detailRows,
  ];
  const lastRow = matrix.length;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix,
    columnWidths: [56, 120, 180, 100, 92, 110, 110, 110, 110, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => {
      const row = index + 1;
      if (row === 1) return 40;
      if (row === sectionHeaderRow || row === detailHeaderRow) return 34;
      if (row === context.fields.length + 2) return 16;
      return 30;
    }),
    frozenRows: 1,
    styles: [
      { range: `A1:J${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#dbe4ee' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: 'J1:J1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${context.fields.length + 1}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${context.fields.length + 1}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${context.fields.length + 1}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${context.fields.length + 1}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `J2:J${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `A${sectionHeaderRow}:J${sectionHeaderRow}`, background: '#d9efe6', fontWeight: 'bold', horizontalAlignment: 'left', verticalAlignment: 'middle' },
      { range: `A${detailHeaderRow}:J${detailHeaderRow}`, background: '#eef5fb', fontWeight: 'bold', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `F${detailHeaderRow + 1}:I${lastRow}`, background: '#fffef6', verticalAlignment: 'middle' },
      { range: `J${detailHeaderRow + 1}:J${lastRow}`, wrap: true, verticalAlignment: 'top' },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildPackagingVersionTemplateSheetSpec(context) {
  const harnessRows = buildCurrentBomHarnessRows();
  const baseRows = context.fields.map((field, index) => ([
    index + 1,
    field.section || '包装物流模板',
    field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
    field.label,
    field.spec || `${field.label} 维护项`,
    templateSheetCellValue(context.rawInputs?.[field.key], context.values?.[field.key]),
    field.unit || '-',
    '手工维护',
    field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接在表格内维护',
  ]));
  const sectionHeaderRow = context.fields.length + 3;
  const detailHeaderRow = sectionHeaderRow + 1;
  const detailRows = harnessRows.length
    ? harnessRows.map((row) => ([
      '',
      row.harnessId || '-',
      row.harnessName || row.harnessId || '-',
      Number(row.bomItemCount) || 0,
      Number(row.wireLineCount) || 0,
      '',
      '',
      '',
      '',
      row.sourceLabel ? `${row.sourceLabel}${row.sourceSheetName ? ` · ${row.sourceSheetName}` : ''}` : '来源于当前 BOM',
    ]))
    : [['', '当前 BOM 暂无线束展开', '', '', '', '', '', '', '', '']];
  const matrix = [
    ['NO.', 'Function / 分类', 'Part Number / 模板编码', 'Part Name / 项目名称', 'SPEC / 录入说明', 'Quantity / 数值', 'Unit / 单位', 'Remark', 'Other-Remark / 维护提示'],
    ...baseRows,
    ['', '', '', '', '', '', '', '', ''],
    ['', '线束展开', '', '', '', '', '', '', ''],
    ['', '线束号', '线束名称', 'BOM条目', '导线条数', '内外包装', '运输费', '仓储费', '短驳/其他', '备注'],
    ...detailRows,
  ];
  const lastRow = matrix.length;
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix,
    columnWidths: [56, 120, 180, 100, 92, 110, 110, 110, 110, 220],
    rowHeights: Array.from({ length: lastRow }, (_, index) => {
      const row = index + 1;
      if (row === 1) return 40;
      if (row === sectionHeaderRow || row === detailHeaderRow) return 34;
      if (row === context.fields.length + 2) return 16;
      return 30;
    }),
    frozenRows: 1,
    styles: [
      { range: `A1:J${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#dbe4ee' } },
      { range: 'A1:I1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: 'J1:J1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${context.fields.length + 1}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${context.fields.length + 1}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `D2:D${context.fields.length + 1}`, background: '#fbfdff', wrap: true },
      { range: `E2:E${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `F2:F${context.fields.length + 1}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `G2:G${context.fields.length + 1}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `H2:I${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `J2:J${context.fields.length + 1}`, background: '#fcfdff', wrap: true },
      { range: `A${sectionHeaderRow}:J${sectionHeaderRow}`, background: '#d9efe6', fontWeight: 'bold', horizontalAlignment: 'left', verticalAlignment: 'middle' },
      { range: `A${detailHeaderRow}:J${detailHeaderRow}`, background: '#eef5fb', fontWeight: 'bold', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `F${detailHeaderRow + 1}:I${lastRow}`, background: '#fffef6', verticalAlignment: 'middle' },
      { range: `J${detailHeaderRow + 1}:J${lastRow}`, wrap: true, verticalAlignment: 'top' },
    ],
    activeRange: context.fields[0]?.address || 'F2',
  };
}

function buildConnectorVersionTemplateSheetSpec(context) {
  const connectorSheetModel = buildConnectorTemplateSheetModel(context);
  const rows = connectorSheetModel.rows;
  const lastRow = rows.length + 1;
  const assemblyRowSet = new Set(connectorSheetModel.assemblyRows);
  return {
    workbookName: context.title,
    sheetName: context.activeLabel || '模板',
    matrix: [
      ['NO.', 'Function', '层级', '编号', '名称', 'SAP', '数量', '单位', '供应商', '协议价', '进度价', '初始报价', '状态', '已达成', '待确认', '开发中', '待回复', '执行档位', '备注', 'BOM定位'],
      ...rows,
    ],
    columnWidths: [56, 160, 96, 180, 200, 118, 72, 64, 120, 92, 92, 92, 90, 68, 68, 68, 78, 108, 240, 180],
    rowHeights: Array.from({ length: lastRow }, (_, index) => {
      if (index === 0) return 40;
      return assemblyRowSet.has(index + 1) ? 36 : 30;
    }),
    frozenRows: 1,
    mergeData: connectorSheetModel.mergeData,
    styles: [
      { range: `A1:T${lastRow}`, border: { type: 'ALL', style: 'THIN', color: '#dbe4ee' } },
      { range: 'A1:T1', background: '#e3eaf2', fontWeight: 'bold', wrap: true, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `A2:A${lastRow}`, background: '#f8fafc', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `B2:B${lastRow}`, background: '#eef5fb', horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `C2:C${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `D2:E${lastRow}`, background: '#fbfdff', wrap: true, verticalAlignment: 'middle' },
      { range: `F2:H${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle', wrap: true },
      { range: `I2:I${lastRow}`, background: '#fbfdff', wrap: true, verticalAlignment: 'middle' },
      { range: `J2:L${lastRow}`, horizontalAlignment: 'right', verticalAlignment: 'middle' },
      { range: `M2:Q${lastRow}`, horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `R2:R${lastRow}`, background: '#fffef6', horizontalAlignment: 'center', verticalAlignment: 'middle' },
      { range: `S2:T${lastRow}`, wrap: true, verticalAlignment: 'top' },
      ...connectorSheetModel.assemblyRows.map((row) => ({
        range: `A${row}:T${row}`,
        background: '#fcfdff',
        fontWeight: 'bold',
        verticalAlignment: 'middle',
      })),
      ...connectorSheetModel.detailRows.map((row) => ({
        range: `C${row}:T${row}`,
        background: '#ffffff',
        verticalAlignment: 'top',
      })),
    ],
    activeRange: context.fields[0]?.address || 'R2',
  };
}

function buildVersionTemplateSheetSpec(context) {
  if (context.workbookSnapshot) {
    return {
      workbookSnapshot: clonePlain(context.workbookSnapshot, null),
      activeRange: context.group === 'packaging'
        ? 'A1'
        : (context.skipFieldOverlay ? 'A1' : (context.fields[0]?.address || 'F2')),
    };
  }
  if (context.group === 'bom') return buildBomVersionTemplateSheetSpec(context);
  if (context.group === 'labor') return buildLaborVersionTemplateSheetSpec(context);
  if (context.group === 'packaging') return buildPackagingVersionTemplateSheetSpec(context);
  if (context.group === 'connector') return buildConnectorVersionTemplateSheetSpec(context);
  return buildGenericVersionTemplateSheetSpec(context);
}

function renderVersionTemplateEditor(context) {
  try {
    setVersionTemplateEditorMode(true);
    const editor = ensureVersionTemplateEditor();
    if (!editor) return false;
    editor.loadTemplate(buildVersionTemplateSheetSpec(context));
    if (!context.skipFieldOverlay) {
      editor.applyFieldInputs?.(context.fields, context.rawInputs, context.values);
    }
    scheduleVersionTemplateEditorWarmup(context);
    updateVersionTemplateDebugPanel();
    return true;
  } catch (error) {
    pushVersionTemplateDebugError('renderVersionTemplateEditor.loadTemplate', error);
    console.error('Failed to initialize Univer template editor', error);
    clearVersionTemplateRenderMonitor();
    setVersionTemplateEditorMode(false);
    updateVersionTemplateDebugPanel();
    return false;
  }
}

function renderVersionTemplateFields(context) {
  if (!el.versionTemplateFields) return;
  if (context.editorMode === 'univer' && renderVersionTemplateEditor(context)) {
    updateVersionTemplateDebugPanel();
    return;
  }
  clearVersionTemplateRenderMonitor();
  context.editorMode = 'fallback';
  if (String(context.editorReason || '').startsWith('univer')) {
    context.editorReason = 'fallback';
  }
  context.skipFieldOverlay = false;
  setVersionTemplateEditorMode(false);
  if (el.versionTemplatePasteHint) {
    el.versionTemplatePasteHint.textContent = versionTemplatePasteHintText(context);
  }
  if (context.group === 'bom') {
    const rows = context.fields.map((field, index) => {
      const value = context.values?.[field.key];
      const section = field.section || 'BOM参数';
      const code = field.templateCode || field.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
      const hint = field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接编辑或整列粘贴';
      const spec = field.spec || `${field.label}维护项`;
      const attrs = [
        `data-template-field="${field.key}"`,
        `data-template-index="${index}"`,
        `class="version-template-sheet-input"`,
        `type="number"`,
        `inputmode="decimal"`,
        `aria-label="${escapeHtml(`${field.label} 数值`)}"`,
        `step="${field.step || '0.01'}"`,
        field.min !== undefined ? `min="${field.min}"` : '',
        field.max !== undefined ? `max="${field.max}"` : '',
        `value="${escapeHtml(value ?? '')}"`,
      ].filter(Boolean).join(' ');
      return `
        <tr>
          <td class="sheet-row-index">${index + 1}</td>
          <td class="sheet-bom-function">${escapeHtml(section)}</td>
          <td class="sheet-bom-code">${escapeHtml(code)}</td>
          <td class="sheet-bom-name">${escapeHtml(field.label)}</td>
          <td class="sheet-bom-spec">${escapeHtml(spec)}</td>
          <td class="sheet-value"><input ${attrs} /></td>
          <td class="sheet-unit">${escapeHtml(field.unit || '-')}</td>
          <td class="sheet-bom-remark">手工维护</td>
          <td class="sheet-hint">${escapeHtml(hint)}</td>
        </tr>
      `;
    }).join('');
    el.versionTemplateFields.innerHTML = `
      <div class="version-template-sheet-wrap">
        <div class="version-template-sheet-caption">线束 BOM 录入模板（参考线束页表头）</div>
        <table class="version-template-sheet is-bom-layout">
          <colgroup>
            <col class="sheet-col-index" />
            <col class="sheet-col-bom-function" />
            <col class="sheet-col-bom-code" />
            <col class="sheet-col-bom-name" />
            <col class="sheet-col-bom-spec" />
            <col class="sheet-col-bom-value" />
            <col class="sheet-col-bom-unit" />
            <col class="sheet-col-bom-remark" />
            <col class="sheet-col-bom-other" />
          </colgroup>
          <thead>
            <tr>
              <th>NO.</th>
              <th>Function<br>功能</th>
              <th>Part Number<br>参数编码</th>
              <th>Part Name<br>参数名称</th>
              <th>SPEC<br>口径说明</th>
              <th>Quantity<br>数值</th>
              <th>Unit<br>单位</th>
              <th>Remark</th>
              <th>Other-Remark<br>系统映射</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    updateVersionTemplateDebugPanel();
    return;
  }
  if (context.group === 'connector') {
    const rows = (context.connectorRows || []).map((row, index) => {
      const field = context.fields[index];
      const value = context.rawInputs?.[field.key] ?? context.values?.[field.key] ?? row.currentStageLabel ?? '';
      const attrs = [
        `data-template-field="${field.key}"`,
        `data-template-index="${index}"`,
        `class="version-template-sheet-input"`,
        `type="text"`,
        `aria-label="${escapeHtml(`${row.itemLabel} 执行档位`)}"`,
        `value="${escapeHtml(value ?? '')}"`,
      ].filter(Boolean).join(' ');
      return `
        <tr>
          <td class="sheet-row-index">${index + 1}</td>
          <td class="sheet-field-name">${escapeHtml(row.itemLabel)}</td>
          <td class="sheet-bom-name">${escapeHtml(row.assemblyNo || '-')}</td>
          <td class="sheet-unit">${escapeHtml(row.supplier || '-')}</td>
          <td class="sheet-unit">${escapeHtml(row.protocolPrice === '' ? '-' : row.protocolPrice)}</td>
          <td class="sheet-unit">${escapeHtml(row.progressPrice === '' ? '-' : row.progressPrice)}</td>
          <td class="sheet-unit">${escapeHtml(row.initialQuote === '' ? '-' : row.initialQuote)}</td>
          <td class="sheet-section">${escapeHtml(row.statusLabel || '-')}</td>
          <td class="sheet-row-index">${row.confirmedCount ?? 0}</td>
          <td class="sheet-row-index">${row.quotedPendingCount ?? 0}</td>
          <td class="sheet-row-index">${row.devPendingCount ?? 0}</td>
          <td class="sheet-row-index">${row.noReplyCount ?? 0}</td>
          <td class="sheet-value"><input ${attrs} /></td>
          <td class="sheet-hint">${escapeHtml(row.partDetail || '')}</td>
          <td class="sheet-hint">${escapeHtml(row.bomLocation || '')}</td>
        </tr>
      `;
    }).join('');
    el.versionTemplateFields.innerHTML = `
      <div class="version-template-sheet-wrap">
        <div class="version-template-sheet-caption">连接器价格模板（自动提取当前 BOM）</div>
        <table class="version-template-sheet is-bom-layout">
          <thead>
            <tr>
              <th>NO.</th>
              <th>连接器</th>
              <th>总成号</th>
              <th>供应商</th>
              <th>协议价</th>
              <th>进度价</th>
              <th>初始报价</th>
              <th>状态</th>
              <th>已达成</th>
              <th>待确认</th>
              <th>开发中</th>
              <th>暂无回复</th>
              <th>执行档位</th>
              <th>散件明细</th>
              <th>BOM定位</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    updateVersionTemplateDebugPanel();
    return;
  }
  const rows = context.fields.map((field, index) => {
    const value = context.values?.[field.key];
    const section = field.section || '模板项目';
    const attrs = [
      `data-template-field="${field.key}"`,
      `data-template-index="${index}"`,
      `class="version-template-sheet-input"`,
      `type="number"`,
      `inputmode="decimal"`,
      `aria-label="${escapeHtml(`${field.label} 数值`)}"`,
      `step="${field.step || '0.01'}"`,
      field.min !== undefined ? `min="${field.min}"` : '',
      field.max !== undefined ? `max="${field.max}"` : '',
      `value="${escapeHtml(value ?? '')}"`,
    ].filter(Boolean).join(' ');
    const hint = field.hint || (field.aliases || []).slice(0, 2).join(' / ') || '可直接编辑或整列粘贴';
    return `
      <tr>
        <td class="sheet-row-index">${index + 1}</td>
        <td class="sheet-section">${escapeHtml(section)}</td>
        <td class="sheet-field-name">${escapeHtml(field.label)}</td>
        <td class="sheet-unit">${escapeHtml(field.unit || '-')}</td>
        <td class="sheet-value"><input ${attrs} /></td>
        <td class="sheet-hint">${escapeHtml(hint)}</td>
      </tr>
    `;
  }).join('');
  const caption = context.group === 'bom' ? '线束 BOM 参数模板' : '版本模板明细';
  el.versionTemplateFields.innerHTML = `
    <div class="version-template-sheet-wrap">
      <div class="version-template-sheet-caption">${caption}</div>
      <table class="version-template-sheet${context.group === 'bom' ? ' is-bom-like' : ''}">
        <colgroup>
          <col class="sheet-col-index" />
          <col class="sheet-col-section" />
          <col class="sheet-col-field" />
          <col class="sheet-col-unit" />
          <col class="sheet-col-value" />
          <col class="sheet-col-hint" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>分类</th>
            <th>项目</th>
            <th>单位</th>
            <th>数值</th>
            <th>维护说明</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  updateVersionTemplateDebugPanel();
}

function updateVersionTemplateStatus(text) {
  if (el.versionTemplateStatus) {
    el.versionTemplateStatus.textContent = text;
  }
  updateVersionTemplateStatusMeta();
}

function getVersionTemplateSheetTabs() {
  if (!el.versionTemplateFields) return [];
  return Array.from(el.versionTemplateFields.querySelectorAll('[data-u-comp="slide-tab-item"]'))
    .map((node) => ({
      label: toText(node.textContent),
      active: node.getAttribute('aria-selected') === 'true',
    }))
    .filter((item) => item.label);
}

function updateVersionTemplateStatusMeta() {
  if (el.versionTemplateSelectionMeta) {
    if (versionTemplateDraft?.editorMode === 'univer') {
      const selection = versionTemplateEditor?.getSelectionSnapshot?.();
      el.versionTemplateSelectionMeta.textContent = selection?.a1 ? `当前选区 ${selection.a1}` : '当前选区 --';
    } else {
      el.versionTemplateSelectionMeta.textContent = '当前选区 表单模式';
    }
  }
  if (el.versionTemplateSheetMeta) {
    if (versionTemplateDraft?.editorMode !== 'univer') {
      const fieldCount = Array.isArray(versionTemplateDraft?.fields) ? versionTemplateDraft.fields.length : 0;
      el.versionTemplateSheetMeta.textContent = fieldCount ? `${fieldCount} 项字段 · 表单模式` : '表单模式';
    } else {
      const tabs = getVersionTemplateSheetTabs();
      const activeTab = tabs.find((item) => item.active);
      if (!tabs.length) {
        el.versionTemplateSheetMeta.textContent = '工作表加载中';
        if (el.versionTemplateEditorMeta) {
          el.versionTemplateEditorMeta.textContent = versionTemplateEditorMetaText(versionTemplateDraft);
        }
        return;
      }
      el.versionTemplateSheetMeta.textContent = activeTab
        ? `${tabs.length} 张表 · 当前 ${activeTab.label}`
        : `${tabs.length} 张表`;
    }
  }
  if (el.versionTemplateEditorMeta) {
    el.versionTemplateEditorMeta.textContent = versionTemplateEditorMetaText(versionTemplateDraft);
  }
}

function stopVersionTemplateStatusMetaTimer() {
  if (versionTemplateStatusMetaTimer) {
    window.clearInterval(versionTemplateStatusMetaTimer);
    versionTemplateStatusMetaTimer = 0;
  }
}

function startVersionTemplateStatusMetaTimer() {
  stopVersionTemplateStatusMetaTimer();
  updateVersionTemplateStatusMeta();
  versionTemplateStatusMetaTimer = window.setInterval(() => {
    if (!el.versionTemplateModal || el.versionTemplateModal.hidden) {
      stopVersionTemplateStatusMetaTimer();
      return;
    }
    updateVersionTemplateStatusMeta();
  }, 500);
}

function openVersionTemplateModal(group) {
  if (!VERSION_TEMPLATE_GROUPS.has(group) || !el.versionTemplateModal) return false;
  const context = buildVersionTemplateContext(group);
  if (!context) return false;
  versionTemplateDraft = context;
  versionTemplateLastFocused = document.activeElement;
  syncVersionTemplateChromeLabels();
  el.versionTemplateModal.classList.remove('is-window-minimized');
  setVersionTemplateWindowMaximized(context.editorMode === 'univer');
  startVersionTemplateDebugPanel();
  startVersionTemplateStatusMetaTimer();
  syncVersionTemplatePanelMode(context.editorMode === 'univer');
  if (el.versionTemplateEyebrow) el.versionTemplateEyebrow.textContent = context.eyebrow;
  if (el.versionTemplateTitle) el.versionTemplateTitle.textContent = context.title;
  if (el.versionTemplateSubtitle) el.versionTemplateSubtitle.textContent = context.subtitle;
  if (el.versionTemplatePasteHint) el.versionTemplatePasteHint.textContent = versionTemplatePasteHintText(context);
  if (el.versionTemplateName) el.versionTemplateName.value = context.suggestedLabel;
  if (el.versionTemplateName) el.versionTemplateName.placeholder = '请输入版本名称';
  const sourceField = el.versionTemplateSource?.closest('.field');
  if (sourceField) sourceField.hidden = context.group === 'packaging';
  if (el.versionTemplateSource) el.versionTemplateSource.value = context.source || '';
  if (el.versionTemplateNote) el.versionTemplateNote.value = context.note || '';
  if (el.versionTemplatePaste) el.versionTemplatePaste.value = '';
  openManagedModal(el.versionTemplateModal, versionTemplateModalController, {
    bodyClass: 'bom-modal-open',
    openClass: 'is-window-open',
  });
  applyVersionTemplateWindowShellState();
  syncVersionTemplateWindowControls();
  queueVersionTemplateFieldsRender(context);
  ensureVersionTemplateResizeObserver();
  updateVersionTemplateStatus(`当前参考版本：${context.activeLabel}。右侧可直接像 Excel 一样录入、粘贴和写公式，保存后生成新版本。`);
  window.requestAnimationFrame(() => el.versionTemplateName?.focus());
  updateVersionTemplateStatus(versionTemplateStatusText(versionTemplateDraft));
  updateVersionTemplateDebugPanel();
  return true;
}

function closeVersionTemplateModal() {
  if (!el.versionTemplateModal) return;
  clearVersionTemplateRenderMonitor();
  stopVersionTemplateStatusMetaTimer();
  disposeVersionTemplateEditor();
  disconnectVersionTemplateResizeObserver();
  syncVersionTemplatePanelMode(false);
  resetVersionTemplateWindowState();
  closeManagedModal(el.versionTemplateModal, versionTemplateModalController, {
    bodyClass: 'bom-modal-open',
    openClass: 'is-window-open',
  });
  applyVersionTemplateWindowShellState();
  versionTemplateDraft = null;
  updateVersionTemplateDebugPanel();
  stopVersionTemplateDebugPanel();
  if (versionTemplateLastFocused && typeof versionTemplateLastFocused.focus === 'function') {
    versionTemplateLastFocused.focus();
  }
  versionTemplateLastFocused = null;
}

function handleVersionTemplateGlobalShortcuts(event) {
  if (!el.versionTemplateModal || el.versionTemplateModal.hidden) return;
  const isSaveShortcut = (event.ctrlKey || event.metaKey)
    && !event.shiftKey
    && !event.altKey
    && String(event.key || '').toLowerCase() === 's';
  if (!isSaveShortcut) return;
  event.preventDefault();
  saveVersionTemplate();
}

function resetVersionTemplateForm() {
  if (!versionTemplateDraft) return;
  openVersionTemplateModal(versionTemplateDraft.group);
}

function normalizeTemplateLookup(value) {
  return String(value ?? '').toLowerCase().replace(/[\s\r\n\t:：,，/\\_|【】\[\]（）()%-]+/g, '');
}

function parseNumericCellValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').replace(/，/g, '').replace(/%/g, '').trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const next = Number(cleaned);
  return Number.isFinite(next) ? next : null;
}

function parseVersionTemplateMatrix(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell));
}

function rowMatchesTemplateAliases(row, field) {
  const rowText = normalizeTemplateLookup(row.join(' '));
  return (field.aliases || []).some((alias) => rowText.includes(normalizeTemplateLookup(alias)));
}

function lastNumericCell(row) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    const value = parseNumericCellValue(row[index]);
    if (value !== null) {
      return { value, cellIndex: index };
    }
  }
  return null;
}

function extractSequentialTemplateValues(text) {
  const rows = parseVersionTemplateMatrix(text);
  if (!rows.length) return [];
  if (rows.length === 1) {
    return rows[0]
      .map((cell) => parseNumericCellValue(cell))
      .filter((value) => value !== null);
  }
  return rows
    .map((row) => lastNumericCell(row)?.value ?? null)
    .filter((value) => value !== null);
}

function handleVersionTemplateSheetInput(event) {
  if (!versionTemplateDraft) return;
  const input = event.target.closest('[data-template-field]');
  if (!input) return;
  const fieldKey = input.dataset.templateField;
  versionTemplateDraft.values = {
    ...versionTemplateDraft.values,
    [fieldKey]: coerceNumber(input.value, coerceNumber(versionTemplateDraft.values?.[fieldKey], 0)),
  };
}

function handleVersionTemplateSheetPaste(event) {
  if (!versionTemplateDraft || !el.versionTemplateFields) return;
  const input = event.target.closest('[data-template-field]');
  if (!input) return;
  const rawText = event.clipboardData?.getData('text/plain') || '';
  if (!/[\t\r\n]/.test(rawText)) return;
  const values = extractSequentialTemplateValues(rawText);
  if (values.length < 2) return;
  const startIndex = Number(input.dataset.templateIndex || -1);
  if (!Number.isInteger(startIndex) || startIndex < 0) return;
  event.preventDefault();
  let filledCount = 0;
  values.forEach((value, offset) => {
    const field = versionTemplateDraft.fields[startIndex + offset];
    if (!field) return;
    const target = el.versionTemplateFields.querySelector(`[data-template-field="${field.key}"]`);
    if (!target) return;
    target.value = value;
    versionTemplateDraft.values[field.key] = value;
    filledCount += 1;
  });
  if (filledCount) {
    updateVersionTemplateStatus(`已从右侧工作表粘贴 ${filledCount} 个数值，并按模板顺序向下回填。`);
  }
}

function parseVersionTemplatePaste() {
  if (!versionTemplateDraft || !el.versionTemplatePaste) return;
  syncVersionTemplateDraftValuesFromDom();
  const text = el.versionTemplatePaste.value;
  const rows = parseVersionTemplateMatrix(text);
  if (!rows.length) {
    updateVersionTemplateStatus('未识别到可解析内容，请先粘贴 Excel 片段。');
    return;
  }

  const parsedValues = {};
  const usedCellKeys = new Set();

  versionTemplateDraft.fields.forEach((field) => {
    const rowIndex = rows.findIndex((row) => rowMatchesTemplateAliases(row, field));
    if (rowIndex === -1) return;
    const match = lastNumericCell(rows[rowIndex]);
    if (!match) return;
    parsedValues[field.key] = match.value;
    usedCellKeys.add(`${rowIndex}:${match.cellIndex}`);
  });

  const numericCells = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      const value = parseNumericCellValue(cell);
      if (value === null) return;
      const key = `${rowIndex}:${cellIndex}`;
      if (usedCellKeys.has(key)) return;
      numericCells.push({ value, key });
    });
  });

  let cursor = 0;
  versionTemplateDraft.fields.forEach((field) => {
    if (parsedValues[field.key] !== undefined) return;
    const next = numericCells[cursor];
    if (!next) return;
    parsedValues[field.key] = next.value;
    cursor += 1;
  });

  const filledKeys = Object.keys(parsedValues);
  if (!filledKeys.length) {
    updateVersionTemplateStatus('已粘贴内容，但没有识别到可用数字。请检查是否为 Excel 数值列。');
    return;
  }

  versionTemplateDraft.values = {
    ...versionTemplateDraft.values,
    ...parsedValues,
  };
  renderVersionTemplateFields(versionTemplateDraft);
  updateVersionTemplateStatus(`已识别 ${filledKeys.length} 个字段，并回填到右侧模板。未识别项会继续保留当前值。`);
}

function readVersionTemplateFieldState() {
  if (!versionTemplateDraft) {
    return { values: {}, rawInputs: {} };
  }
  if (versionTemplateDraft.skipFieldOverlay) {
    return {
      values: clonePlain(versionTemplateDraft.values, {}) || {},
      rawInputs: clonePlain(versionTemplateDraft.rawInputs, {}) || {},
    };
  }
  if (versionTemplateDraft.editorMode === 'univer' && versionTemplateEditor) {
    const fieldStateMap = versionTemplateEditor.getFieldState(versionTemplateDraft.fields);
    return versionTemplateDraft.fields.reduce((acc, field) => {
      const fieldState = fieldStateMap?.[field.key] || {};
      const fallbackValue = versionTemplateDraft.values?.[field.key];
      const fallbackRawInput = versionTemplateDraft.rawInputs?.[field.key];
      const formula = typeof fieldState.formula === 'string' ? fieldState.formula.trim() : '';
      const value = fieldState.value;
      const parsedValue = typeof value === 'number' ? value : parseNumericCellValue(value);
      acc.values[field.key] = parsedValue !== null ? parsedValue : coerceNumber(fallbackValue, 0);
      acc.rawInputs[field.key] = formula || templateSheetCellValue(value, fallbackRawInput ?? fallbackValue ?? '');
      return acc;
    }, { values: {}, rawInputs: {} });
  }
  if (!el.versionTemplateFields) {
    return {
      values: clonePlain(versionTemplateDraft.values, {}) || {},
      rawInputs: clonePlain(versionTemplateDraft.rawInputs, {}) || {},
    };
  }
  return versionTemplateDraft.fields.reduce((acc, field) => {
    const input = el.versionTemplateFields.querySelector(`[data-template-field="${field.key}"]`);
    const rawValue = input?.value;
    const fallbackValue = versionTemplateDraft.values?.[field.key];
    const fallbackRawInput = versionTemplateDraft.rawInputs?.[field.key];
    acc.values[field.key] = coerceNumber(rawValue, coerceNumber(fallbackValue, 0));
    acc.rawInputs[field.key] = templateSheetCellValue(rawValue, fallbackRawInput ?? fallbackValue ?? '');
    return acc;
  }, { values: {}, rawInputs: {} });
}

function readVersionTemplateFieldValues() {
  return readVersionTemplateFieldState().values;
}

function syncVersionTemplateDraftValuesFromDom() {
  if (!versionTemplateDraft) return { values: {}, rawInputs: {} };
  const fieldState = readVersionTemplateFieldState();
  versionTemplateDraft.values = {
    ...versionTemplateDraft.values,
    ...fieldState.values,
  };
  versionTemplateDraft.rawInputs = {
    ...versionTemplateDraft.rawInputs,
    ...fieldState.rawInputs,
  };
  if (versionTemplateDraft.editorMode === 'univer' && versionTemplateEditor) {
    versionTemplateDraft.workbookSnapshot = clonePlain(versionTemplateEditor.saveSnapshot(), null);
  }
  return fieldState;
}

function annualDropSnapshotSummary(snapshot) {
  const yearRows = Array.isArray(snapshot?.yearRows) ? snapshot.yearRows : [];
  if (!yearRows.length) return '未设置生命周期年降';
  const nonZeroRows = yearRows.filter((row, index) => index > 0 && Number(row?.rate) > 0);
  if (!nonZeroRows.length) return `共 ${fmtInt(yearRows.length)} 年，未设置年降`;
  const maxRate = nonZeroRows.reduce((max, row) => Math.max(max, coerceNumber(row?.rate, 0)), 0);
  const firstYear = nonZeroRows[0]?.year;
  return `共 ${fmtInt(yearRows.length)} 年，${firstYear || '后续年度'}起年降，最高 ${fmtPct(maxRate)}`;
}

function oneTimeCustomerSnapshotSummary(snapshot) {
  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  if (!entries.length) return '未设置一次性费用';
  const directTotal = entries.reduce((sum, entry) => sum + (entry?.mode === 'direct' ? Math.max(0, Number(entry?.amount) || 0) : 0), 0);
  const allocateTotal = entries.reduce((sum, entry) => sum + (entry?.mode === 'direct' ? 0 : Math.max(0, Number(entry?.amount) || 0)), 0);
  return `${fmtInt(entries.length)} 条，直付 ${fmtMoney(directTotal)} 元，分摊 ${fmtMoney(allocateTotal)} 元`;
}

function rebateSnapshotSummary(snapshot) {
  const yearRows = Array.isArray(snapshot?.yearRows) ? snapshot.yearRows : [];
  if (!yearRows.length) return '未设置返点';
  const total = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
  const activeRows = yearRows.filter((row) => Number(row?.amountTotal) > 0);
  if (!activeRows.length) return `生命周期 ${fmtMoney(total)} 元`;
  return `生命周期 ${fmtMoney(total)} 元，${activeRows[0]?.year || ''} 起 ${fmtInt(activeRows.length)} 年`;
}

function buildVersionTemplateSourceNote(group, context, source, note, values, workbookSnapshot = null) {
  const sourceText = source ? `来源：${source}` : `来源：手工模板录入，参考 ${context.activeLabel}`;
  const noteText = note ? `；备注：${note}` : '';
  if (group === 'bom') {
    return `${sourceText}；BOM 模板维护。材料系数 ${fmtNumber(values.factor, 3)}，导线 ${fmtNumber(values.wireMeter, 3)} m，胶带 ${fmtNumber(values.tapeMeter, 3)} m${noteText}`.trim();
  }
  if (group === 'metal') {
    return `${sourceText}；铜铝基价模板维护。铜价 ${fmtMoney(values.copperPrice || 0, 0)} 元/吨，铝价 ${fmtMoney(values.aluminumPrice || 0, 0)} 元/吨${noteText}`.trim();
  }
  if (group === 'connector') {
    const rowCount = Array.isArray(context?.connectorRows) ? context.connectorRows.length : 0;
    return `${sourceText}；连接器价格模板维护。已带出 ${fmtInt(rowCount)} 行连接器信息，可按整套执行档位维护${noteText}`.trim();
  }
  if (group === 'labor') {
    return `${sourceText}；工时模板维护。直接人工 ${fmtNumber(values.directHours, 2)} h/套，制造工时 ${fmtNumber(values.manufacturingHours, 2)} h/套${noteText}`.trim();
  }
  if (group === 'equipment') {
    return `${sourceText}；设备资源模板维护。设备 ${fmtMoney(values.equipment)} 元，模具 ${fmtMoney(values.tooling)} 元，工装 ${fmtMoney(values.fixtures)} 元${noteText}`.trim();
  }
  if (group === 'packaging') {
    return '';
  }
  if (group === 'configSheet') {
    return `${sourceText}；配置清单模板维护，保留整表格式、公式与表头结构${noteText}`.trim();
  }
  if (group === 'sales') {
    const total = Object.keys(values).reduce((sum, key) => sum + coerceNumber(values[key], 0), 0);
    return `${sourceText}；销量预测模板维护。生命周期销量 ${fmtInt(total)} 套${noteText}`.trim();
  }
  if (group === 'mix') {
    return `${sourceText}；配置比例模板维护，保存时自动归一化到 100%${noteText}`.trim();
  }
  if (group === 'annualDrop') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : annualDropVersionSnapshot(context?.activeKey).yearRows;
    const yearRows = workbookSnapshot
      ? parseAnnualDropWorkbookRows(workbookSnapshot, fallbackRows, values?.annualRate)
      : normalizeAnnualDropYearRows(fallbackRows, lifecycleTemplateYears(), values?.annualRate);
    return `${sourceText}；年降模板维护。${annualDropSnapshotSummary({ yearRows })}${noteText}`.trim();
  }
  if (group === 'oneTimeCustomer') {
    const fallbackEntries = Array.isArray(context?.entries) ? context.entries : oneTimeCustomerVersionSnapshot(context?.activeKey).entries;
    const entries = workbookSnapshot
      ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries, values?.amountTotal)
      : normalizeOneTimeCustomerEntries(fallbackEntries, lifecycleTemplateYears(), values?.amountTotal);
    return `${sourceText}；一次性费用模板维护。${oneTimeCustomerSnapshotSummary({ entries })}${noteText}`.trim();
  }
  if (group === 'rebate') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : rebateVersionSnapshot(context?.activeKey).yearRows;
    const yearRows = workbookSnapshot
      ? parseRebateWorkbookRows(workbookSnapshot, fallbackRows, values?.amountPerSet)
      : normalizeRebateYearRows(fallbackRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), values?.amountPerSet);
    return `${sourceText}；返点模板维护。${rebateSnapshotSummary({ yearRows })}${noteText}`.trim();
  }
  return `${sourceText}${noteText}`.trim();
}

function buildVersionTemplatePayload(group, context, values, source, note, rawInputs = {}, workbookSnapshot = null) {
  const sourceNote = buildVersionTemplateSourceNote(group, context, source, note, values, workbookSnapshot);
  const templateState = {
    source,
    sourceNote,
    templateNote: note || '',
    templateRawInputs: clonePlain(rawInputs, null),
    templateFieldAddressMap: Array.isArray(context?.fields)
      ? context.fields.reduce((acc, field) => {
        if (field?.key && field?.address) {
          acc[field.key] = field.address;
        }
        return acc;
      }, {})
      : null,
    templateWorkbookSeed: clonePlain(context?.templateWorkbookSeed, null),
    templateWorkbookSnapshot: clonePlain(workbookSnapshot, null),
  };
  if (group === 'bom') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的 BOM 口径。',
      source,
      sourceNote,
      factor: values.factor,
      wireFactor: values.wireFactor,
      totalMeter: values.totalMeter,
      wireMeter: values.wireMeter,
      tapeMeter: values.tapeMeter,
      tubeMeter: values.tubeMeter,
      draft: {
        bomWireDrawing: values.bomWireDrawing,
        bomWireEat: values.bomWireEat,
        bomWireHidden: values.bomWireHidden,
        bomTapeDiameter: values.bomTapeDiameter,
        bomTapeWidth: values.bomTapeWidth,
        bomTapeOverlap: values.bomTapeOverlap,
      },
    };
  }
  if (group === 'metal') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的铜铝基价。',
      source,
      sourceNote,
      copperPrice: Math.max(0, coerceNumber(values.copperPrice, 0)),
      aluminumPrice: Math.max(0, coerceNumber(values.aluminumPrice, 0)),
      manualManaged: true,
    };
  }
  if (group === 'connector') {
    const rows = buildConnectorTemplatePayloadRows(context, rawInputs);
    const sourceKey = context.connectorSourceKey || context.activeStageKey || context.activeKey;
    const overrides = rows.reduce((acc, row) => {
      if (row.currentStage && row.currentStage !== sourceKey) {
        acc[row.itemId] = row.currentStage;
      }
      return acc;
    }, {});
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续维护连接器执行档位。',
      source,
      sourceKey,
      sourceNote: `${sourceNote}；已解析 ${fmtInt(rows.length)} 行连接器，显式指定 ${fmtInt(Object.keys(overrides).length)} 行执行档位。`,
      overrides,
      templateRows: rows,
    };
  }
  if (group === 'labor') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的工时口径。',
      source,
      sourceNote,
      directHours: values.directHours,
      directRate: values.directRate,
      manufacturingHours: values.manufacturingHours,
      manufacturingRate: values.manufacturingRate,
    };
  }
  if (group === 'equipment') {
    const quoteEquipment = equipmentVersionSnapshot('base').equipment || 0;
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的设备资源金额。',
      source,
      sourceNote,
      equipment: values.equipment,
      tooling: values.tooling,
      fixtures: values.fixtures,
      rnd: values.rnd,
      factor: quoteEquipment ? values.equipment / quoteEquipment : 1,
    };
  }
  if (group === 'packaging') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的包装物流拆分。',
      source,
      sourceNote,
      packInner: values.packInner,
      packFreight: values.packFreight,
      packWarehouse: values.packWarehouse,
      packOther: values.packOther,
    };
  }
  if (group === 'configSheet') {
    return {
      ...templateState,
      kind: 'custom',
      note: 'Excel 式配置清单版本，可继续维护配置清单整表内容。',
      source,
      sourceNote,
      workbook: toText(source, toText(context?.activeLabel, '配置清单')),
      workbookVersionKeyFallback: toText(context?.runtimeVersionKey, toText(context?.activeKey, state.configSheet)),
    };
  }
  if (group === 'sales') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的销量预测。',
      source,
      sourceNote,
      volumes: BASE.years.map((year) => Math.max(0, coerceNumber(values[`sales_${year}`], 0))),
    };
  }
  if (group === 'mix') {
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入或粘贴新的配置比例。',
      source,
      sourceNote,
      values: normalizeMix(BASE.configNames.map((_, index) => coerceNumber(values[`mix_${index}`], 0))),
    };
  }
  if (group === 'annualDrop') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : [];
    const yearRows = workbookSnapshot
      ? parseAnnualDropWorkbookRows(workbookSnapshot, fallbackRows, values?.annualRate)
      : normalizeAnnualDropYearRows(fallbackRows, lifecycleTemplateYears(), values?.annualRate);
    const annualRate = yearRows.find((row, index) => index > 0 && Number(row?.rate) > 0)?.rate
      ?? yearRows.find((row) => Number(row?.rate) > 0)?.rate
      ?? 0;
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的 ASP 年降口径。',
      source,
      sourceNote,
      yearRows,
      annualRate: Math.max(0, coerceNumber(annualRate, 0)),
    };
  }
  if (group === 'oneTimeCustomer') {
    const fallbackEntries = Array.isArray(context?.entries) ? context.entries : [];
    const entries = workbookSnapshot
      ? parseOneTimeCustomerWorkbookEntries(workbookSnapshot, fallbackEntries, values?.amountTotal)
      : normalizeOneTimeCustomerEntries(fallbackEntries, lifecycleTemplateYears(), values?.amountTotal);
    const amountTotal = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的客户一次性费用口径。',
      source,
      sourceNote,
      entries,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
    };
  }
  if (group === 'rebate') {
    const fallbackRows = Array.isArray(context?.yearRows) ? context.yearRows : [];
    const yearRows = workbookSnapshot
      ? parseRebateWorkbookRows(workbookSnapshot, fallbackRows, values?.amountPerSet)
      : normalizeRebateYearRows(fallbackRows, lifecycleTemplateYears(), lifecycleTemplateVolumes(), values?.amountPerSet);
    const amountTotal = yearRows.reduce((sum, row) => sum + Math.max(0, Number(row?.amountTotal) || 0), 0);
    const amountPerSet = lifecycleVolumeTotal() ? amountTotal / lifecycleVolumeTotal() : 0;
    return {
      ...templateState,
      kind: 'custom',
      note: '手工模板版本，可继续录入新的返点口径。',
      source,
      sourceNote,
      yearRows,
      amountTotal: Math.max(0, coerceNumber(amountTotal, 0)),
      amountPerSet: Math.max(0, coerceNumber(amountPerSet, 0)),
    };
  }
  return {
    ...templateState,
  };
}

function saveVersionTemplate() {
  if (!versionTemplateDraft) return;
  const group = versionTemplateDraft.group;
  const label = toText(el.versionTemplateName?.value);
  if (!label) {
    window.alert('版本名称不能为空。');
    el.versionTemplateName?.focus();
    return;
  }
  const key = makeUserVersionKey(versionTemplateDraft.group);
  const source = toText(el.versionTemplateSource?.value);
  const note = toText(el.versionTemplateNote?.value);
  const fieldState = syncVersionTemplateDraftValuesFromDom();
  const payload = buildVersionTemplatePayload(
    group,
    versionTemplateDraft,
    fieldState.values,
    source,
    note,
    fieldState.rawInputs,
    versionTemplateDraft.workbookSnapshot
  );
  BASE.versions[group][key] = buildUserVersionOption(group, label, payload);
  state[group] = key;
  void persistVersionOptionToStore(group, key, BASE.versions[group][key], payload, {
    sourceType: 'template-modal',
    status: 'active',
    baseReleaseId: group === 'bom'
      ? toText(
        BASE.versions?.bom?.[versionTemplateDraft?.activeKey]?.semanticReleaseId,
        toText(BASE.versions?.bom?.[versionTemplateDraft?.activeKey]?.nativeWorkbookVersionId, ''),
      )
      : '',
  });
  closeVersionTemplateModal();
  applyVersionPreset(group, key);
  persistUserVersions();
  renderVersions();
  queueRender();
}
