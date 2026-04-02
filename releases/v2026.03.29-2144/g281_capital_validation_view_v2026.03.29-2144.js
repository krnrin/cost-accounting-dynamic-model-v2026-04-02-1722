(function () {
  const runtime = window.G281_RUNTIME || {};
  const capitalValidation = runtime.capitalValidation;
  if (!capitalValidation || !capitalValidation.scopeOrder || !capitalValidation.scopeOrder.length) {
    return;
  }

  const STORAGE_KEY = 'g281.capitalManualAlign.v1';
  const openBtn = document.getElementById('openCapitalValidationBtn');
  const closeBtn = document.getElementById('closeCapitalValidationBtn');
  const resetBtn = document.getElementById('resetCapitalValidationBtn');
  const modal = document.getElementById('capitalValidationModal');
  const select = document.getElementById('capitalValidationScope');
  const summary = document.getElementById('capitalValidationSummary');
  const groups = document.getElementById('capitalValidationGroups');
  const hint = document.getElementById('capitalValidationHint');

  if (!openBtn || !closeBtn || !resetBtn || !modal || !select || !summary || !groups || !hint) {
    return;
  }

  const statusMap = {
    matched: { label: '匹配', className: 'matched' },
    quote_only: { label: '报价独有', className: 'quote-only' },
    fixed_only: { label: '定点独有', className: 'fixed-only' },
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

  const fmtMoney = (value, digits = 2) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return number.toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const signedMoney = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) < 1e-9) {
      return '一致';
    }
    return `${number > 0 ? '+' : ''}${fmtMoney(number)} 元`;
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

  function getComparison(scopeId) {
    return capitalValidation.comparisons[scopeId] || null;
  }

  function getScopeState(scopeId) {
    if (!manualAlignState[scopeId]) {
      manualAlignState[scopeId] = {};
    }
    return manualAlignState[scopeId];
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

  function buildGroupModel(scopeId, group) {
    const scopeState = getScopeState(scopeId);
    const groupState = scopeState[group.key] || {};
    const quoteItemMap = new Map();
    const fixedItemMap = new Map();
    const baseQuoteRows = [];
    const baseFixedRows = [];
    const quoteLockedRows = new Set();
    const fixedLockedRows = new Set();
    const quoteStatus = {};
    const fixedStatus = {};

    group.aligned.forEach((row, index) => {
      if (row.quote) {
        quoteItemMap.set(row.quote.itemKey, row.quote);
        baseQuoteRows[index] = row.quote.itemKey;
        quoteStatus[row.quote.itemKey] = row.status;
      } else {
        baseQuoteRows[index] = null;
      }

      if (row.fixed) {
        fixedItemMap.set(row.fixed.itemKey, row.fixed);
        baseFixedRows[index] = row.fixed.itemKey;
        fixedStatus[row.fixed.itemKey] = row.status;
      } else {
        baseFixedRows[index] = null;
      }

      if (row.status === 'matched') {
        quoteLockedRows.add(index);
        fixedLockedRows.add(index);
      }
    });

    const quoteRows = normalizeRowState(groupState.quoteRows, baseQuoteRows, quoteItemMap, quoteLockedRows);
    const fixedRows = normalizeRowState(groupState.fixedRows, baseFixedRows, fixedItemMap, fixedLockedRows);
    const rowCount = Math.max(group.aligned.length, quoteRows.length, fixedRows.length, 1) + 1;

    const rows = Array.from({ length: rowCount }, (_, index) => {
      const quoteKey = quoteRows[index] || null;
      const fixedKey = fixedRows[index] || null;
      return {
        quote: quoteKey ? quoteItemMap.get(quoteKey) : null,
        fixed: fixedKey ? fixedItemMap.get(fixedKey) : null,
        quoteStatus: quoteKey ? quoteStatus[quoteKey] : '',
        fixedStatus: fixedKey ? fixedStatus[fixedKey] : '',
        quoteLocked: quoteLockedRows.has(index),
        fixedLocked: fixedLockedRows.has(index),
      };
    });

    return {
      ...group,
      rows,
      rowCount,
      quoteRows,
      fixedRows,
      quoteLockedRows,
      fixedLockedRows,
    };
  }

  function persistGroupRows(scopeId, groupKey, side, rows, lockedRows) {
    const scopeState = getScopeState(scopeId);
    if (!scopeState[groupKey]) {
      scopeState[groupKey] = {};
    }
    scopeState[groupKey][`${side}Rows`] = trimTrailingRows(rows, lockedRows);
    saveAlignState();
  }

  function moveUnlockedRowItem(rows, fromIndex, toIndex, lockedRows) {
    const next = Array.isArray(rows) ? rows.slice() : [];
    const rowCount = Math.max(next.length, fromIndex + 1, toIndex + 1);

    while (next.length < rowCount) {
      next.push(null);
    }

    if (lockedRows.has(fromIndex) || lockedRows.has(toIndex)) {
      return next;
    }

    const value = next[fromIndex];
    next[fromIndex] = null;

    if (fromIndex < toIndex) {
      for (let index = fromIndex + 1; index <= toIndex; index += 1) {
        if (lockedRows.has(index)) continue;
        next[index - 1] = next[index];
        next[index] = null;
      }
    } else if (fromIndex > toIndex) {
      for (let index = fromIndex - 1; index >= toIndex; index -= 1) {
        if (lockedRows.has(index)) continue;
        next[index + 1] = next[index];
        next[index] = null;
      }
    }

    next[toIndex] = value;
    return next;
  }

  function createDelta(text, className, title) {
    return { text, className, title };
  }

  function buildAmountDelta(quoteItem, fixedItem, amountLabel) {
    const quoteAmount = Number(quoteItem?.newAmount);
    const fixedAmount = Number(fixedItem?.newAmount);
    const quoteQty = Number(quoteItem?.newQty);
    const fixedQty = Number(fixedItem?.newQty);
    const unit = String(quoteItem?.unit || fixedItem?.unit || '').trim();

    if (quoteItem && !fixedItem) {
      return createDelta(
        `-${fmtMoney(quoteAmount)} 元`,
        'delta-down',
        `定点侧删除该项，${amountLabel || '金额'}差异 -${fmtMoney(quoteAmount)} 元`,
      );
    }

    if (!quoteItem && fixedItem) {
      return createDelta(
        `+${fmtMoney(fixedAmount)} 元`,
        'delta-up',
        `定点侧新增该项，${amountLabel || '金额'}差异 +${fmtMoney(fixedAmount)} 元`,
      );
    }

    if (!Number.isFinite(quoteAmount) || !Number.isFinite(fixedAmount)) {
      return createDelta('-', 'delta-neutral', '缺少可比的金额数据');
    }

    const diff = fixedAmount - quoteAmount;
    if (Math.abs(diff) < 1e-9 && Number.isFinite(quoteQty) && Number.isFinite(fixedQty) && Math.abs(fixedQty - quoteQty) < 1e-9) {
      return createDelta(
        '一致',
        'delta-same',
        `定点 ${fmtMoney(fixedAmount)} 元，报价 ${fmtMoney(quoteAmount)} 元；数量 ${fmtQty(fixedQty)} / ${fmtQty(quoteQty)} ${unit}`.trim(),
      );
    }

    if (Math.abs(diff) < 1e-9) {
      return createDelta(
        `${fmtQty(quoteQty)} → ${fmtQty(fixedQty)} ${unit}`.trim(),
        'delta-neutral',
        `金额一致；数量 ${fmtQty(quoteQty)} → ${fmtQty(fixedQty)} ${unit}`.trim(),
      );
    }

    const titleParts = [
      `定点 ${fmtMoney(fixedAmount)} 元`,
      `报价 ${fmtMoney(quoteAmount)} 元`,
      `${amountLabel || '金额'}差异 ${signedMoney(diff)}`,
    ];
    if (Number.isFinite(quoteQty) || Number.isFinite(fixedQty)) {
      titleParts.push(`数量 ${fmtQty(quoteQty)} → ${fmtQty(fixedQty)} ${unit}`.trim());
    }

    return createDelta(
      signedMoney(diff),
      diff > 0 ? 'delta-up' : 'delta-down',
      titleParts.join('，'),
    );
  }

  function buildCardTitle(item, qtyText, detailText, delta, amountLabel) {
    const lines = [
      `编号: ${item.code || '-'}`,
      `归属: ${item.category || '-'}`,
      `项目: ${item.investmentName || '-'}`,
      `名称: ${item.itemName || '-'}`,
      `规格: ${item.spec || '-'}`,
      `${item.qtyLabel || '数量'}: ${qtyText || '-'}`,
      `${amountLabel || item.amountLabel || '金额'}: ${fmtMoney(item.newAmount)} 元`,
      `需求数量: ${fmtQty(item.demandQty)} ${item.unit || ''}`.trim(),
      `沿用数量: ${fmtQty(item.reuseQty)} ${item.unit || ''}`.trim(),
      `单价: ${item.unitPrice == null ? '-' : `${fmtMoney(item.unitPrice)} 元`}`,
      `备注: ${detailText || '-'}`,
      `差异: ${delta.text}`,
    ];
    return lines.join('\n');
  }

  function renderCard(item, peerItem, side, statusKey, comparison, groupKey, rowIndex, locked) {
    if (!item) {
      return '<div class="bom-align-empty" aria-hidden="true"></div>';
    }

    const status = statusMap[statusKey] || statusMap[side === 'quote' ? 'quote_only' : 'fixed_only'];
    const qtyText = item.newQty == null ? '-' : `${fmtQty(item.newQty)} ${item.unit || ''}`.trim();
    const unitPriceText = item.unitPrice == null ? '-' : `${fmtMoney(item.unitPrice)} 元`;
    const detailText = [item.category, item.note || item.sectionLabel].filter(Boolean).join(' | ') || '-';
    const projectText = item.investmentName || '-';
    const nameText = [item.itemName, item.spec].filter(Boolean).join(' / ') || '-';
    const delta = buildAmountDelta(side === 'quote' ? item : peerItem, side === 'fixed' ? item : peerItem, comparison.fields.amountFieldLabel);
    const titleText = buildCardTitle(item, qtyText, detailText, delta, comparison.fields.amountFieldLabel);
    const canDrag = !locked;

    return `
      <article class="bom-card capital-card${canDrag ? '' : ' is-locked'}" ${canDrag ? 'draggable="true"' : ''} title="${escapeHtml(titleText)}" data-item-key="${escapeHtml(item.itemKey)}" data-side="${escapeHtml(side)}" data-group-key="${escapeHtml(groupKey)}" data-index="${escapeHtml(String(rowIndex))}">
        <span class="status-pill bom-status ${status.className}">${escapeHtml(status.label)}</span>
        <span class="bom-inline-field bom-code" title="${escapeHtml(item.code || '-')}">${escapeHtml(item.code || '-')}</span>
        <span class="bom-inline-field" title="${escapeHtml(projectText)}">${escapeHtml(projectText)}</span>
        <span class="bom-inline-field bom-name" title="${escapeHtml(nameText)}">${escapeHtml(nameText)}</span>
        <span class="bom-inline-field bom-consumption" title="${escapeHtml(qtyText)}">${escapeHtml(qtyText)}</span>
        <span class="bom-inline-field" title="${escapeHtml(unitPriceText)}">${escapeHtml(unitPriceText)}</span>
        <span class="bom-inline-field bom-detail" title="${escapeHtml(detailText)}">${escapeHtml(detailText)}</span>
        <span class="bom-inline-field bom-delta ${delta.className}" title="${escapeHtml(delta.title)}">${escapeHtml(delta.text)}</span>
      </article>
    `;
  }

  function renderLaneColumns(title, comparison) {
    return `
      <div class="bom-lane-panel">
        <div class="bom-lane-title">${escapeHtml(title)}</div>
        <div class="bom-lane-columns capital-lane-columns">
          <span>状态</span>
          <span>编号</span>
          <span>项目</span>
          <span>${escapeHtml(comparison.fields.itemNameHeader)} / ${escapeHtml(comparison.fields.specHeader)}</span>
          <span>${escapeHtml(comparison.fields.qtyFieldLabel)}</span>
          <span>单价</span>
          <span>归属 / 备注</span>
          <span>差异</span>
        </div>
      </div>
    `;
  }

  function renderLaneCell(groupKey, side, item, peerItem, statusKey, index, locked, comparison) {
    const isDropZone = !locked;
    return `
      <div class="bom-align-cell${locked ? ' is-locked' : ''}" ${isDropZone ? 'data-drop-zone="true"' : ''} data-group-key="${escapeHtml(groupKey)}" data-side="${escapeHtml(side)}" data-drop-index="${escapeHtml(String(index))}">
        ${renderCard(item, peerItem, side, statusKey, comparison, groupKey, index, locked)}
      </div>
    `;
  }

  function buildGroupMeta(group, comparison) {
    const amountLabel = comparison.fields.amountFieldLabel || '金额';
    const deltaAmount = group.fixedAmount - group.quoteAmount;
    return `${amountLabel}: 定点 ${fmtMoney(group.fixedAmount)} 元 / 报价 ${fmtMoney(group.quoteAmount)} 元 / 差异 ${signedMoney(deltaAmount)}`;
  }

  function renderGroup(scopeId, comparison, group) {
    const model = buildGroupModel(scopeId, group);
    const rows = [];
    for (let index = 0; index < model.rowCount; index += 1) {
      const row = model.rows[index];
      rows.push(`
        <div class="bom-align-row">
          ${renderLaneCell(model.key, 'fixed', row.fixed, row.quote, row.fixedStatus, index, row.fixedLocked, comparison)}
          ${renderLaneCell(model.key, 'quote', row.quote, row.fixed, row.quoteStatus, index, row.quoteLocked, comparison)}
        </div>
      `);
    }

    const statPills = [
      `定点 <strong>${model.fixedCount}</strong>`,
      `报价 <strong>${model.quoteCount}</strong>`,
      `匹配 <strong>${model.matchedCount}</strong>`,
      `差异 <strong>${model.quoteOnlyCount + model.fixedOnlyCount}</strong>`,
    ];

    return `
      <article class="bom-compare-group" data-group-key="${escapeHtml(model.key)}">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">${escapeHtml(model.label)}</div>
            <div class="bom-compare-group-meta">${escapeHtml(buildGroupMeta(model, comparison))}</div>
          </div>
          <div class="bom-compare-group-stats">
            ${statPills.map((text) => `<span class="stat-pill">${text}</span>`).join('')}
          </div>
        </div>
        <div class="bom-lane-header">
          ${renderLaneColumns('定点核算', comparison)}
          ${renderLaneColumns('报价核算', comparison)}
        </div>
        <div class="bom-align-board">
          ${rows.join('')}
        </div>
      </article>
    `;
  }

  function renderScope(scopeId) {
    const comparison = getComparison(scopeId);
    if (!comparison) {
      summary.innerHTML = '';
      groups.innerHTML = '<div class="bom-compare-empty-state">未找到该模块的资本投入管理数据。</div>';
      return;
    }

    const amountDelta = comparison.summary.deltaAmount;
    const summaryItems = [
      `模块 <strong>${escapeHtml(comparison.scopeLabel)}</strong>`,
      `定点 Sheet <strong>${escapeHtml(comparison.fixedSheet)}</strong>`,
      `报价 Sheet <strong>${escapeHtml(comparison.quoteSheet)}</strong>`,
      `定点项 <strong>${comparison.summary.fixedCount}</strong>`,
      `报价项 <strong>${comparison.summary.quoteCount}</strong>`,
      `匹配 <strong>${comparison.summary.matchedCount}</strong>`,
      `差异 <strong>${comparison.summary.quoteOnlyCount + comparison.summary.fixedOnlyCount}</strong>`,
      `${escapeHtml(comparison.fields.amountFieldLabel)}差异 <strong>${escapeHtml(signedMoney(amountDelta))}</strong>`,
    ];
    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');

    hint.textContent = [
      `来源：${capitalValidation.meta.quoteWorkbook} vs ${capitalValidation.meta.fixedWorkbook}。`,
      '已匹配条目会锁定在同一行显示；未匹配条目可在本侧上下拖动，并通过空白行进行人工对位。',
      `当前差异优先按 ${comparison.fields.amountFieldLabel} 判断，同时保留 ${comparison.fields.qtyFieldLabel}、单价和备注用于复核。`,
      '点击“重置对齐”可恢复系统初始排序。',
    ].join('');

    groups.innerHTML = comparison.groups.map((group) => renderGroup(scopeId, comparison, group)).join('');
  }

  function clearDropTargets() {
    groups.querySelectorAll('.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
  }

  openBtn.textContent = `资本投入管理 (${capitalValidation.scopeOrder.length})`;
  select.innerHTML = capitalValidation.scopeOrder.map((scopeId) => {
    const comparison = getComparison(scopeId);
    const label = comparison ? `${comparison.scopeLabel} | ${comparison.quoteSheet}` : scopeId;
    return `<option value="${escapeHtml(scopeId)}">${escapeHtml(label)}</option>`;
  }).join('');

  openBtn.addEventListener('click', () => setModalOpen(true));
  closeBtn.addEventListener('click', () => setModalOpen(false));
  resetBtn.addEventListener('click', () => {
    delete manualAlignState[select.value];
    saveAlignState();
    renderScope(select.value);
  });
  select.addEventListener('change', () => renderScope(select.value));

  modal.addEventListener('click', (event) => {
    if (event.target && event.target.closest('[data-capital-close]')) {
      setModalOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setModalOpen(false);
    }
  });

  groups.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.capital-card');
    if (!card) return;
    dragState = {
      scopeId: select.value,
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
    const comparison = getComparison(dragState.scopeId);
    if (!comparison) return;
    const group = comparison.groups.find((item) => item.key === dragState.groupKey);
    if (!group) return;

    const model = buildGroupModel(dragState.scopeId, group);
    const sourceRows = dragState.side === 'quote' ? model.quoteRows : model.fixedRows;
    const lockedRows = dragState.side === 'quote' ? model.quoteLockedRows : model.fixedLockedRows;
    const nextRows = moveUnlockedRowItem(sourceRows, dragState.fromIndex, Number(dropZone.dataset.dropIndex), lockedRows);
    persistGroupRows(dragState.scopeId, dragState.groupKey, dragState.side, nextRows, lockedRows);
    renderScope(dragState.scopeId);
    dragState = null;
    clearDropTargets();
  });

  renderScope(capitalValidation.scopeOrder[0]);
})();
