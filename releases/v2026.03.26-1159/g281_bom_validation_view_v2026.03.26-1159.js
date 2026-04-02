(function () {
  const runtime = window.G281_RUNTIME || {};
  const bomValidation = runtime.bomValidation;
  if (!bomValidation || !bomValidation.harnessOrder || !bomValidation.harnessOrder.length) {
    return;
  }

  const STORAGE_KEY = 'g281.bomManualAlign.v3';
  const openBtn = document.getElementById('openBomValidationBtn');
  const closeBtn = document.getElementById('closeBomValidationBtn');
  const resetBtn = document.getElementById('resetBomValidationBtn');
  const modal = document.getElementById('bomValidationModal');
  const select = document.getElementById('bomValidationHarness');
  const summary = document.getElementById('bomValidationSummary');
  const groups = document.getElementById('bomValidationGroups');
  const hint = document.getElementById('bomValidationHint');

  if (!openBtn || !closeBtn || !resetBtn || !modal || !select || !summary || !groups || !hint) {
    return;
  }

  const statusMap = {
    matched: { label: '匹配', className: 'matched' },
    quote_only: { label: '报价独有', className: 'quote-only' },
    fixed_only: { label: '定点独有', className: 'fixed-only' },
    assembly_to_parts: { label: '总成映射', className: 'assembly-map' },
    assembly_part: { label: '散件展开', className: 'assembly-part' },
  };

  const hasLocalStorage = (() => {
    try {
      return typeof window.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  })();

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const fmtQty = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    if (Math.abs(number - Math.round(number)) < 1e-9) {
      return String(Math.round(number));
    }
    return number.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  const uniqueStrings = (values) => {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => String(value ?? '').trim())
      .filter((value) => value && !seen.has(value) && seen.add(value));
  };

  const displayList = (values) => {
    const list = uniqueStrings(values).filter((value) => value !== '/');
    return list.length ? list.join(' / ') : '-';
  };

  let manualAlignState = hasLocalStorage ? safeParse(window.localStorage.getItem(STORAGE_KEY), {}) : {};
  let dragState = null;
  let lastFocused = null;

  function saveAlignState() {
    if (!hasLocalStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manualAlignState));
  }

  function setModalOpen(open) {
    if (open) {
      lastFocused = document.activeElement;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('bom-modal-open');
      window.requestAnimationFrame(() => select.focus());
      return;
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('bom-modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function getComparison(harnessId) {
    return bomValidation.comparisons[harnessId] || null;
  }

  function getHarnessState(harnessId) {
    if (!manualAlignState[harnessId]) {
      manualAlignState[harnessId] = {};
    }
    return manualAlignState[harnessId];
  }

  function trimTrailingRows(rows, lockedRows) {
    const next = Array.isArray(rows) ? rows.slice() : [];
    while (next.length) {
      const lastIndex = next.length - 1;
      if (next[lastIndex] || lockedRows.has(lastIndex)) {
        break;
      }
      next.pop();
    }
    return next;
  }

  function normalizeRowState(storedRows, baseRows, itemMap, lockedRows) {
    const normalized = [];
    const sourceRows = Array.isArray(storedRows) && storedRows.length ? storedRows : baseRows;
    const rowCount = Math.max(sourceRows.length, baseRows.length);
    const used = new Set();

    for (let index = 0; index < rowCount; index += 1) {
      if (lockedRows.has(index)) {
        normalized[index] = baseRows[index] || null;
        continue;
      }

      const itemKey = sourceRows[index];
      if (itemKey && itemMap.has(itemKey) && !used.has(itemKey)) {
        normalized[index] = itemKey;
        used.add(itemKey);
      } else {
        normalized[index] = null;
      }
    }

    baseRows.forEach((itemKey, index) => {
      if (!itemKey || lockedRows.has(index) || !itemMap.has(itemKey) || used.has(itemKey)) {
        return;
      }

      while (normalized.length <= index) {
        normalized.push(null);
      }

      if (!normalized[index]) {
        normalized[index] = itemKey;
        used.add(itemKey);
        return;
      }

      let targetIndex = normalized.findIndex((value, rowIndex) => rowIndex > index && !lockedRows.has(rowIndex) && !value);
      if (targetIndex === -1) {
        targetIndex = normalized.findIndex((value, rowIndex) => !lockedRows.has(rowIndex) && !value);
      }
      if (targetIndex === -1) {
        normalized.push(itemKey);
      } else {
        normalized[targetIndex] = itemKey;
      }
      used.add(itemKey);
    });

    return trimTrailingRows(normalized, lockedRows);
  }

  function buildGroupModel(harnessId, group) {
    const harnessState = getHarnessState(harnessId);
    const groupState = harnessState[group.key] || {};
    const quoteItemMap = new Map();
    const fixedItemMap = new Map();
    const rowBlueprints = group.aligned.map((row) => {
      if (row.quote) {
        quoteItemMap.set(row.quote.itemKey, row.quote);
      }
      if (row.fixed) {
        fixedItemMap.set(row.fixed.itemKey, row.fixed);
      }
      return {
        status: row.status || '',
        quoteKey: row.quote ? row.quote.itemKey : null,
        fixedKey: row.fixed ? row.fixed.itemKey : null,
        fixedParts: Array.isArray(row.fixedParts) ? row.fixedParts : [],
      };
    });

    const quoteLockedRows = new Set();
    const fixedLockedRows = new Set();
    const baseQuoteRows = [];
    const baseFixedRows = [];
    const quoteStatus = {};
    const fixedStatus = {};

    rowBlueprints.forEach((row, index) => {
      baseQuoteRows[index] = row.quoteKey;
      baseFixedRows[index] = row.fixedKey;

      if (row.quoteKey) {
        quoteStatus[row.quoteKey] = row.status === 'fixed_only' ? 'quote_only' : row.status;
      }
      if (row.fixedKey) {
        fixedStatus[row.fixedKey] = row.status === 'quote_only' ? 'fixed_only' : row.status;
      }
      if (row.status === 'matched' || row.status === 'assembly_to_parts') {
        quoteLockedRows.add(index);
        fixedLockedRows.add(index);
      }
    });

    const quoteRows = normalizeRowState(groupState.quoteRows, baseQuoteRows, quoteItemMap, quoteLockedRows);
    const fixedRows = normalizeRowState(groupState.fixedRows, baseFixedRows, fixedItemMap, fixedLockedRows);
    const rowCount = Math.max(group.aligned.length, quoteRows.length, fixedRows.length, 1) + 1;
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const blueprint = rowBlueprints[index] || { status: '', fixedParts: [] };
      const quoteKey = quoteRows[index] || null;
      const fixedKey = fixedRows[index] || null;
      return {
        rowType: blueprint.status === 'assembly_to_parts' ? 'assembly_to_parts' : 'standard',
        quote: quoteKey ? quoteItemMap.get(quoteKey) : null,
        fixed: fixedKey ? fixedItemMap.get(fixedKey) : null,
        fixedParts: blueprint.status === 'assembly_to_parts' ? blueprint.fixedParts : [],
        quoteStatus: quoteKey ? quoteStatus[quoteKey] : '',
        fixedStatus: fixedKey ? fixedStatus[fixedKey] : '',
        quoteLocked: quoteLockedRows.has(index),
        fixedLocked: fixedLockedRows.has(index),
      };
    });

    return {
      ...group,
      rows,
      quoteRows,
      fixedRows,
      quoteLockedRows,
      fixedLockedRows,
      rowCount,
    };
  }

  function persistGroupRows(harnessId, groupKey, side, rows, lockedRows) {
    const harnessState = getHarnessState(harnessId);
    if (!harnessState[groupKey]) {
      harnessState[groupKey] = {};
    }
    harnessState[groupKey][`${side}Rows`] = trimTrailingRows(rows, lockedRows);
    saveAlignState();
  }

  function moveUnlockedRowItem(rows, fromIndex, toIndex, lockedRows) {
    const next = Array.isArray(rows) ? rows.slice() : [];
    const rowCount = Math.max(next.length, fromIndex + 1, toIndex + 1);
    while (next.length < rowCount) {
      next.push(null);
    }
    if (lockedRows.has(fromIndex) || lockedRows.has(toIndex)) {
      return trimTrailingRows(next, lockedRows);
    }

    const movableIndexes = [];
    for (let index = 0; index < next.length; index += 1) {
      if (!lockedRows.has(index)) {
        movableIndexes.push(index);
      }
    }

    const fromSlot = movableIndexes.indexOf(fromIndex);
    const toSlot = movableIndexes.indexOf(toIndex);
    if (fromSlot === -1 || toSlot === -1) {
      return trimTrailingRows(next, lockedRows);
    }

    const movableRows = movableIndexes.map((index) => next[index] || null);
    const [itemKey] = movableRows.splice(fromSlot, 1);
    if (!itemKey) {
      return trimTrailingRows(next, lockedRows);
    }

    movableRows.splice(toSlot, 0, itemKey);
    movableRows.length = movableIndexes.length;
    movableIndexes.forEach((rowIndex, slotIndex) => {
      next[rowIndex] = movableRows[slotIndex] || null;
    });
    return trimTrailingRows(next, lockedRows);
  }

  function signedQuantity(value, unit) {
    return `${value > 0 ? '+' : ''}${fmtQty(value)}${unit ? ` ${unit}` : ''}`.trim();
  }

  function createDelta(text, className, title) {
    return { text, className, title };
  }

  function buildUsageDelta(quoteItem, fixedItem) {
    const quoteUnit = String(quoteItem?.unit || '').trim();
    const fixedUnit = String(fixedItem?.unit || '').trim();
    const quoteQty = Number(quoteItem?.quantity);
    const fixedQty = Number(fixedItem?.quantity);

    if (quoteItem && !fixedItem && Number.isFinite(quoteQty)) {
      return createDelta(
        signedQuantity(-quoteQty, quoteUnit),
        'delta-down',
        `定点 BOM 相比报价 BOM 删除该项，差异 ${signedQuantity(-quoteQty, quoteUnit)}`,
      );
    }

    if (!quoteItem && fixedItem && Number.isFinite(fixedQty)) {
      return createDelta(
        signedQuantity(fixedQty, fixedUnit),
        'delta-up',
        `定点 BOM 相比报价 BOM 新增该项，差异 ${signedQuantity(fixedQty, fixedUnit)}`,
      );
    }

    if (!quoteItem || !fixedItem || !Number.isFinite(quoteQty) || !Number.isFinite(fixedQty)) {
      return createDelta('-', 'delta-neutral', '缺少可比的用量数据');
    }

    if (quoteUnit && fixedUnit && quoteUnit !== fixedUnit) {
      return createDelta(
        `${fmtQty(quoteQty)} ${quoteUnit} → ${fmtQty(fixedQty)} ${fixedUnit}`,
        'delta-neutral',
        `报价 ${fmtQty(quoteQty)} ${quoteUnit}，定点 ${fmtQty(fixedQty)} ${fixedUnit}`,
      );
    }

    const diff = fixedQty - quoteQty;
    const unit = fixedUnit || quoteUnit;
    if (Math.abs(diff) < 1e-9) {
      return createDelta(
        '一致',
        'delta-same',
        `报价 ${fmtQty(quoteQty)} ${unit}，定点 ${fmtQty(fixedQty)} ${unit}`,
      );
    }

    return createDelta(
      signedQuantity(diff, unit),
      diff > 0 ? 'delta-up' : 'delta-down',
      `报价 ${fmtQty(quoteQty)} ${unit}，定点 ${fmtQty(fixedQty)} ${unit}，差异 ${signedQuantity(diff, unit)}`,
    );
  }

  function buildGroupMeta(model) {
    if (model.section === 'connector' && model.assemblyToPartsCount) {
      return '连接器分组支持“报价总成对定点散件清单”展示；总成映射行会锁定显示，其余未匹配项仍可借助空白行做人工对齐。';
    }
    if (model.section === 'connector') {
      return '连接器匹配项直接对齐，未匹配项可拖动并通过空白行进行人工对位。';
    }
    if (model.section === 'wire') {
      return '导线按零件直接对齐，未匹配项可上下拖动到空白行完成人工对位。';
    }
    if (model.section === 'sync') {
      return '支架类和橡胶件类会独立归入同步开发件分组，便于专项核对与人工对位。';
    }
    return '其他物料按零件直接对齐，未匹配项可借助空白行做人工对齐。';
  }

  function buildCardTitle(item, consumption, assemblyText, noteText, delta, titleNote) {
    const titleParts = [
      `料号: ${item.partNumber || '-'}`,
      `名称: ${item.partName || '-'}`,
      `单耗: ${consumption || '-'}`,
      `SAP: ${displayList(item.sapNos)}`,
      `供应商: ${displayList(item.suppliers)}`,
      `总成号: ${assemblyText}`,
      `备注: ${noteText}`,
      `用量差异: ${delta.text}`,
    ];
    if (titleNote) {
      titleParts.push(`说明: ${titleNote}`);
    }
    return titleParts.join('\n');
  }

  function renderCard(item, peerItem, side, statusKey, groupKey, rowIndex, locked, options = {}) {
    if (!item) {
      return '<div class="bom-align-empty" aria-hidden="true"></div>';
    }

    const status = statusMap[statusKey] || statusMap.fixed_only;
    const canDrag = !locked && statusKey !== 'matched' && !options.disableDrag;
    const functions = uniqueStrings(item.functions);
    const notes = uniqueStrings([...(item.remarks || []), ...(item.otherRemarks || [])]);
    const consumption = `${fmtQty(item.quantity)} ${item.unit || ''}`.trim();
    const assemblyText = displayList(item.assemblyRefs);
    const noteText = [...functions, ...notes].filter(Boolean).join(' | ') || '-';
    const detailParts = [];
    if (options.detailPrefix) {
      detailParts.push(options.detailPrefix);
    }
    if (assemblyText !== '-') {
      detailParts.push(assemblyText);
    }
    if (noteText !== '-') {
      detailParts.push(noteText);
    }
    const detailText = detailParts.length ? detailParts.join(' | ') : '-';
    const delta = options.deltaOverride || buildUsageDelta(side === 'quote' ? item : peerItem, side === 'fixed' ? item : peerItem);
    const titleText = buildCardTitle(item, consumption, assemblyText, noteText, delta, options.titleNote);
    const cardClassName = options.cardClassName ? ` ${options.cardClassName}` : '';

    return `
      <article class="bom-card${canDrag ? '' : ' is-locked'}${cardClassName}" ${canDrag ? 'draggable="true"' : ''} title="${escapeHtml(titleText)}" data-item-key="${escapeHtml(item.itemKey)}" data-side="${escapeHtml(side)}" data-group-key="${escapeHtml(groupKey)}" data-index="${escapeHtml(String(rowIndex))}">
        <span class="status-pill bom-status ${status.className}">${escapeHtml(status.label)}</span>
        <span class="bom-inline-field bom-code" title="${escapeHtml(item.partNumber || '-')}">${escapeHtml(item.partNumber || '-')}</span>
        <span class="bom-inline-field bom-name" title="${escapeHtml(item.partName || '-')}">${escapeHtml(item.partName || '-')}</span>
        <span class="bom-inline-field bom-consumption" title="${escapeHtml(consumption || '-')}">${escapeHtml(consumption || '-')}</span>
        <span class="bom-inline-field" title="${escapeHtml(displayList(item.sapNos))}">${escapeHtml(displayList(item.sapNos))}</span>
        <span class="bom-inline-field" title="${escapeHtml(displayList(item.suppliers))}">${escapeHtml(displayList(item.suppliers))}</span>
        <span class="bom-inline-field bom-detail" title="${escapeHtml(detailText)}">${escapeHtml(detailText)}</span>
        <span class="bom-inline-field bom-delta ${delta.className}" title="${escapeHtml(delta.title)}">${escapeHtml(delta.text)}</span>
      </article>
    `;
  }

  function renderLaneColumns(title) {
    return `
      <div class="bom-lane-panel">
        <div class="bom-lane-title">${escapeHtml(title)}</div>
        <div class="bom-lane-columns">
          <span>状态</span>
          <span>料号</span>
          <span>名称</span>
          <span>单耗</span>
          <span>SAP</span>
          <span>供应商</span>
          <span>总成/备注</span>
          <span>差异</span>
        </div>
      </div>
    `;
  }

  function renderLaneCell(groupKey, side, item, peerItem, statusKey, index, locked, cardOptions = {}, cellClassName = '') {
    const isDropZone = !locked;
    return `
      <div class="bom-align-cell${locked ? ' is-locked' : ''}${cellClassName ? ` ${cellClassName}` : ''}" ${isDropZone ? 'data-drop-zone="true"' : ''} data-group-key="${escapeHtml(groupKey)}" data-side="${escapeHtml(side)}" data-drop-index="${escapeHtml(String(index))}">
        ${renderCard(item, peerItem, side, statusKey, groupKey, index, locked, cardOptions)}
      </div>
    `;
  }

  function renderAssemblyFixedCell(groupKey, fixedParts, index) {
    if (!Array.isArray(fixedParts) || !fixedParts.length) {
      return `
        <div class="bom-align-cell is-locked bom-align-cell-stack">
          <div class="bom-align-empty" aria-hidden="true"></div>
        </div>
      `;
    }

    const stackCards = fixedParts.map((item, partIndex) => renderCard(
      item,
      null,
      'fixed',
      'assembly_part',
      groupKey,
      `${index}-${partIndex}`,
      true,
      {
        disableDrag: true,
        deltaOverride: createDelta('散件', 'delta-neutral', '定点侧该端散件展开项'),
        titleNote: '定点 BOM 在该端按散件清单展开显示',
        cardClassName: 'is-stack-item',
      },
    )).join('');

    return `
      <div class="bom-align-cell is-locked bom-align-cell-stack">
        <div class="bom-stack-note">该端散件清单 <strong>${fixedParts.length}</strong></div>
        <div class="bom-stack-list">
          ${stackCards}
        </div>
      </div>
    `;
  }

  function renderGroup(harnessId, group) {
    const model = buildGroupModel(harnessId, group);
    const rows = [];

    for (let index = 0; index < model.rowCount; index += 1) {
      const row = model.rows[index];
      if (row.rowType === 'assembly_to_parts') {
        rows.push(`
          <div class="bom-align-row bom-align-row-assembly">
            ${renderLaneCell(
              model.key,
              'quote',
              row.quote,
              null,
              'assembly_to_parts',
              index,
              true,
              {
                disableDrag: true,
                deltaOverride: createDelta(
                  `展开 ${row.fixedParts.length} 项`,
                  'delta-neutral',
                  '报价侧为连接器总成，定点侧显示该端散件清单',
                ),
                titleNote: '报价 BOM 该端为连接器总成，定点 BOM 该端为散件清单',
                detailPrefix: '报价总成',
                cardClassName: 'is-assembly-root',
              },
            )}
            ${renderAssemblyFixedCell(model.key, row.fixedParts, index)}
          </div>
        `);
        continue;
      }

      rows.push(`
        <div class="bom-align-row">
          ${renderLaneCell(model.key, 'quote', row.quote, row.fixed, row.quoteStatus, index, row.quoteLocked)}
          ${renderLaneCell(model.key, 'fixed', row.fixed, row.quote, row.fixedStatus, index, row.fixedLocked)}
        </div>
      `);
    }

    const statPills = [
      `报价 <strong>${model.quoteCount}</strong>`,
      `定点 <strong>${model.fixedCount}</strong>`,
      `匹配 <strong>${model.matchedCount}</strong>`,
      `差异 <strong>${model.quoteOnlyCount + model.fixedOnlyCount}</strong>`,
    ];
    if (model.assemblyToPartsCount) {
      statPills.push(`总成映射 <strong>${model.assemblyToPartsCount}</strong>`);
      statPills.push(`展开散件 <strong>${model.assemblyPartCount}</strong>`);
    }

    return `
      <article class="bom-compare-group" data-group-key="${escapeHtml(model.key)}">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">${escapeHtml(model.label)}</div>
            <div class="bom-compare-group-meta">${escapeHtml(buildGroupMeta(model))}</div>
          </div>
          <div class="bom-compare-group-stats">
            ${statPills.map((text) => `<span class="stat-pill">${text}</span>`).join('')}
          </div>
        </div>
        <div class="bom-lane-header">
          ${renderLaneColumns('报价 BOM')}
          ${renderLaneColumns('定点 BOM')}
        </div>
        <div class="bom-align-board">
          ${rows.join('')}
        </div>
      </article>
    `;
  }

  function renderHarness(harnessId) {
    const comparison = getComparison(harnessId);
    if (!comparison) {
      summary.innerHTML = '';
      groups.innerHTML = '<div class="bom-compare-empty-state">未找到该线束的 BOM 管理数据。</div>';
      return;
    }

    const summaryItems = [
      `线束 <strong>${escapeHtml(comparison.harnessId)}</strong>`,
      `报价 Sheet <strong>${escapeHtml(comparison.quoteSheet)}</strong>`,
      `定点 Sheet <strong>${escapeHtml(comparison.fixedSheet)}</strong>`,
      `连接器组 <strong>${comparison.summary.connectorGroupCount}</strong>`,
      `匹配 <strong>${comparison.summary.matchedCount}</strong>`,
      `报价独有 <strong>${comparison.summary.quoteOnlyCount}</strong>`,
      `定点独有 <strong>${comparison.summary.fixedOnlyCount}</strong>`,
    ];
    if (comparison.summary.assemblyToPartsCount) {
      summaryItems.push(`总成映射 <strong>${comparison.summary.assemblyToPartsCount}</strong>`);
      summaryItems.push(`展开散件 <strong>${comparison.summary.assemblyPartCount}</strong>`);
    }

    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');

    hint.textContent = [
      `来源：${bomValidation.meta.quoteWorkbook} vs ${bomValidation.meta.fixedWorkbook}。`,
      '已匹配零件会锁定在同一行显示，未匹配零件可在本侧上下拖动，并通过空白行进行人工对位。',
      '当报价侧为连接器总成、定点侧为同端散件时，会自动切换为“总成对散件清单”展示。',
      '支架类和橡胶件类会单独归入同步开发件分组，条目中保留 SAP、供应商、单耗和用量差异。',
      '点击“重置对齐”可恢复系统初始排序。',
    ].join('');

    groups.innerHTML = comparison.groups.map((group) => renderGroup(harnessId, group)).join('');
  }

  function clearDropTargets() {
    groups.querySelectorAll('.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
  }

  openBtn.textContent = `BOM 管理 (${bomValidation.harnessOrder.length})`;
  select.innerHTML = bomValidation.harnessOrder.map((harnessId) => {
    const comparison = getComparison(harnessId);
    const label = comparison ? `${comparison.harnessId} | ${comparison.harnessName}` : harnessId;
    return `<option value="${escapeHtml(harnessId)}">${escapeHtml(label)}</option>`;
  }).join('');

  openBtn.addEventListener('click', () => setModalOpen(true));
  closeBtn.addEventListener('click', () => setModalOpen(false));
  resetBtn.addEventListener('click', () => {
    delete manualAlignState[select.value];
    saveAlignState();
    renderHarness(select.value);
  });
  select.addEventListener('change', () => renderHarness(select.value));
  modal.addEventListener('click', (event) => {
    if (event.target && event.target.closest('[data-bom-close]')) {
      setModalOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setModalOpen(false);
    }
  });

  groups.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.bom-card');
    if (!card) return;
    dragState = {
      harnessId: select.value,
      groupKey: card.dataset.groupKey,
      side: card.dataset.side,
      fromIndex: Number(card.dataset.index),
      itemKey: card.dataset.itemKey,
    };
    card.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.itemKey || '');
    }
  });

  groups.addEventListener('dragend', () => {
    groups.querySelectorAll('.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
    dragState = null;
    clearDropTargets();
  });

  groups.addEventListener('dragover', (event) => {
    const dropZone = event.target.closest('.bom-align-cell[data-drop-zone="true"]');
    if (!dropZone || !dragState) return;
    if (dropZone.dataset.groupKey !== dragState.groupKey || dropZone.dataset.side !== dragState.side) {
      return;
    }
    event.preventDefault();
    clearDropTargets();
    dropZone.classList.add('is-drop-target');
  });

  groups.addEventListener('drop', (event) => {
    const dropZone = event.target.closest('.bom-align-cell[data-drop-zone="true"]');
    if (!dropZone || !dragState) return;
    if (dropZone.dataset.groupKey !== dragState.groupKey || dropZone.dataset.side !== dragState.side) {
      return;
    }

    event.preventDefault();
    const comparison = getComparison(dragState.harnessId);
    if (!comparison) return;
    const group = comparison.groups.find((item) => item.key === dragState.groupKey);
    if (!group) return;

    const model = buildGroupModel(dragState.harnessId, group);
    const sourceRows = dragState.side === 'quote' ? model.quoteRows : model.fixedRows;
    const lockedRows = dragState.side === 'quote' ? model.quoteLockedRows : model.fixedLockedRows;
    const nextRows = moveUnlockedRowItem(sourceRows, dragState.fromIndex, Number(dropZone.dataset.dropIndex), lockedRows);
    persistGroupRows(dragState.harnessId, dragState.groupKey, dragState.side, nextRows, lockedRows);
    renderHarness(dragState.harnessId);
    dragState = null;
    clearDropTargets();
  });

  renderHarness(bomValidation.harnessOrder[0]);
})();
