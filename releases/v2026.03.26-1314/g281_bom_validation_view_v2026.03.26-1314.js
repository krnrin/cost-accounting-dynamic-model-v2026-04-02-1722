(function () {
  const runtime = window.G281_RUNTIME || {};
  const bomValidation = runtime.bomValidation;
  const versionOrder = Array.isArray(bomValidation?.meta?.versionOrder) ? bomValidation.meta.versionOrder.slice() : [];
  if (!bomValidation || !Array.isArray(bomValidation?.harnessOrder) || !bomValidation.harnessOrder.length || !versionOrder.length) {
    return;
  }

  const STORAGE_KEY = 'g281.bomManualAlign.v5';
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

  const versionLabels = { ...(bomValidation.meta.versionLabels || {}) };
  const workbookLabels = { ...(bomValidation.meta.workbooks || {}) };
  const baseVersion = versionOrder[0];

  const hasLocalStorage = (() => {
    try {
      return typeof window.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  })();

  const statusMap = {
    full_match: { label: '三版匹配', className: 'matched' },
    partial_match: { label: '双版对齐', className: 'matched-partial' },
    assembly_bundle: { label: '总成映射', className: 'assembly-map' },
    assembly_part: { label: '散件展开', className: 'assembly-part' },
  };
  versionOrder.forEach((version) => {
    statusMap[`${version}_only`] = {
      label: `${shortLabel(version)}独有`,
      className: `source-only source-${version}`,
    };
  });

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

  function shortLabel(version) {
    const text = String(versionLabels[version] || version || '').trim();
    return text.replace(/\s*BOM$/i, '').trim() || version;
  }

  function sourceOnlyLabel(version) {
    return `${shortLabel(version)}独有`;
  }

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

  function laneStatusForRow(row, version) {
    const item = row.versions?.[version];
    if (!item) return '';
    if (row.rowType === 'assembly_bundle' && version === baseVersion) {
      return 'assembly_bundle';
    }
    if (row.matchState === 'full_match') {
      return 'full_match';
    }
    if (row.matchState === 'partial_match') {
      return 'partial_match';
    }
    return `${version}_only`;
  }

  function buildGroupModel(harnessId, group) {
    const harnessState = getHarnessState(harnessId);
    const groupState = harnessState[group.key] || {};
    const itemMaps = Object.fromEntries(versionOrder.map((version) => [version, new Map()]));
    const baseRows = Object.fromEntries(versionOrder.map((version) => [version, []]));
    const lockedRows = Object.fromEntries(versionOrder.map((version) => [version, new Set()]));
    const statuses = Object.fromEntries(versionOrder.map((version) => [version, {}]));

    const rowBlueprints = (group.aligned || []).map((row) => {
      const directKeys = {};
      const partLists = {};
      versionOrder.forEach((version) => {
        const item = row.versions?.[version] || null;
        if (item) {
          itemMaps[version].set(item.itemKey, item);
          directKeys[version] = item.itemKey;
        } else {
          directKeys[version] = null;
        }
        partLists[version] = Array.isArray(row.partLists?.[version]) ? row.partLists[version] : [];
      });
      return {
        rowType: row.rowType || 'standard',
        matchState: row.matchState || '',
        sourceCount: Number(row.sourceCount) || 0,
        directKeys,
        partLists,
      };
    });

    rowBlueprints.forEach((row, index) => {
      versionOrder.forEach((version) => {
        baseRows[version][index] = row.directKeys[version];
        if (row.directKeys[version]) {
          statuses[version][row.directKeys[version]] = laneStatusForRow(row, version);
        }
        if (row.partLists[version]?.length || (row.directKeys[version] && row.sourceCount >= 2)) {
          lockedRows[version].add(index);
        }
      });
    });

    const laneRows = Object.fromEntries(versionOrder.map((version) => [
      version,
      normalizeRowState(groupState[`${version}Rows`], baseRows[version], itemMaps[version], lockedRows[version]),
    ]));

    const rowCount = Math.max(
      group.aligned.length,
      ...versionOrder.map((version) => laneRows[version].length),
      1,
    ) + 1;

    const rows = Array.from({ length: rowCount }, (_, index) => {
      const blueprint = rowBlueprints[index] || {
        rowType: 'standard',
        matchState: '',
        sourceCount: 0,
        directKeys: Object.fromEntries(versionOrder.map((version) => [version, null])),
        partLists: Object.fromEntries(versionOrder.map((version) => [version, []])),
      };
      const versions = {};
      const rowStatuses = {};
      const rowLocked = {};
      const parts = {};
      versionOrder.forEach((version) => {
        const itemKey = laneRows[version][index] || null;
        versions[version] = itemKey ? itemMaps[version].get(itemKey) || null : null;
        rowStatuses[version] = itemKey ? statuses[version][itemKey] : '';
        rowLocked[version] = lockedRows[version].has(index);
        parts[version] = blueprint.partLists[version] || [];
      });
      return {
        rowType: blueprint.rowType,
        matchState: blueprint.matchState,
        sourceCount: blueprint.sourceCount,
        versions,
        partLists: parts,
        statuses: rowStatuses,
        locked: rowLocked,
      };
    });

    return {
      ...group,
      rows,
      laneRows,
      lockedRows,
      rowCount,
    };
  }

  function persistGroupRows(harnessId, groupKey, version, rows, lockedRows) {
    const harnessState = getHarnessState(harnessId);
    if (!harnessState[groupKey]) {
      harnessState[groupKey] = {};
    }
    harnessState[groupKey][`${version}Rows`] = trimTrailingRows(rows, lockedRows);
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

  function buildUsageDelta(baseItem, compareItem, baseLabel, compareLabel) {
    const baseUnit = String(baseItem?.unit || '').trim();
    const compareUnit = String(compareItem?.unit || '').trim();
    const baseQty = Number(baseItem?.quantity);
    const compareQty = Number(compareItem?.quantity);

    if (baseItem && !compareItem && Number.isFinite(baseQty)) {
      return createDelta(
        signedQuantity(-baseQty, baseUnit),
        'delta-down',
        `${compareLabel} 相比 ${baseLabel} 删除该项，差异 ${signedQuantity(-baseQty, baseUnit)}`,
      );
    }

    if (!baseItem && compareItem && Number.isFinite(compareQty)) {
      return createDelta(
        signedQuantity(compareQty, compareUnit),
        'delta-up',
        `${compareLabel} 相比 ${baseLabel} 新增该项，差异 ${signedQuantity(compareQty, compareUnit)}`,
      );
    }

    if (!baseItem || !compareItem || !Number.isFinite(baseQty) || !Number.isFinite(compareQty)) {
      return createDelta('-', 'delta-neutral', '缺少可比的用量数据');
    }

    if (baseUnit && compareUnit && baseUnit !== compareUnit) {
      return createDelta(
        `${fmtQty(baseQty)} ${baseUnit} -> ${fmtQty(compareQty)} ${compareUnit}`,
        'delta-neutral',
        `${baseLabel} ${fmtQty(baseQty)} ${baseUnit}，${compareLabel} ${fmtQty(compareQty)} ${compareUnit}`,
      );
    }

    const diff = compareQty - baseQty;
    const unit = compareUnit || baseUnit;
    if (Math.abs(diff) < 1e-9) {
      return createDelta(
        '一致',
        'delta-same',
        `${baseLabel} ${fmtQty(baseQty)} ${unit}，${compareLabel} ${fmtQty(compareQty)} ${unit}`,
      );
    }

    return createDelta(
      signedQuantity(diff, unit),
      diff > 0 ? 'delta-up' : 'delta-down',
      `${baseLabel} ${fmtQty(baseQty)} ${unit}，${compareLabel} ${fmtQty(compareQty)} ${unit}，差异 ${signedQuantity(diff, unit)}`,
    );
  }

  function buildLaneDelta(version, row) {
    const item = row.versions?.[version] || null;
    if (!item) {
      return createDelta('-', 'delta-neutral', '当前栏位没有直接零件数据');
    }

    if (version === baseVersion) {
      return createDelta('基准', 'delta-neutral', `${versionLabels[version] || version} 作为当前锚点版本`);
    }

    const previousVersion = versionOrder
      .slice(0, versionOrder.indexOf(version))
      .reverse()
      .find((candidate) => row.versions?.[candidate]);

    if (!previousVersion) {
      return createDelta('基准', 'delta-neutral', `${versionLabels[version] || version} 当前作为本行对照基准`);
    }

    return buildUsageDelta(
      row.versions[previousVersion],
      item,
      versionLabels[previousVersion] || previousVersion,
      versionLabels[version] || version,
    );
  }

  function buildGroupMeta(model) {
    if (model.section === 'connector' && model.assemblyToPartsCount) {
      return `${shortLabel(baseVersion)} 端若为连接器总成，后续版本若为散件清单会自动按端展开；已对齐行锁定，独有行仍可通过空白行人工对位。`;
    }
    if (model.section === 'connector') {
      return '连接器按端别分组，对齐成功的零件锁定显示，独有零件可在各自版本栏内上下拖动。';
    }
    if (model.section === 'wire') {
      return '导线按零件直接对齐，未匹配项可在本版本栏内拖到空白行，方便人工精调。';
    }
    if (model.section === 'sync') {
      return '支架类与橡胶件类独立归入同步开发件分组，便于专项核对与后续版本扩展。';
    }
    return '其他物料按零件直接对齐；当前视图由版本列表驱动，后续新增 BOM 版本可继续接入同一套对齐机制。';
  }

  function buildCardTitle(version, item, consumption, assemblyText, noteText, delta, titleNote) {
    const titleParts = [
      `版本: ${versionLabels[version] || version}`,
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

  function renderCard(item, row, version, statusKey, groupKey, rowIndex, locked, options = {}) {
    if (!item) {
      return '<div class="bom-align-empty" aria-hidden="true"></div>';
    }

    const status = statusMap[statusKey] || statusMap[`${version}_only`];
    const canDrag = Boolean(item) && !locked && statusKey === `${version}_only` && !options.disableDrag;
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
    const delta = options.deltaOverride || buildLaneDelta(version, row);
    const titleText = buildCardTitle(version, item, consumption, assemblyText, noteText, delta, options.titleNote);
    const cardClassName = options.cardClassName ? ` ${options.cardClassName}` : '';

    return `
      <article class="bom-card${canDrag ? '' : ' is-locked'}${cardClassName}" ${canDrag ? 'draggable="true"' : ''} title="${escapeHtml(titleText)}" data-item-key="${escapeHtml(item.itemKey)}" data-side="${escapeHtml(version)}" data-group-key="${escapeHtml(groupKey)}" data-index="${escapeHtml(String(rowIndex))}">
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

  function laneDeltaHint(version) {
    if (version === baseVersion) return '基准';
    return 'vs 前序版';
  }

  function renderLaneColumns(version) {
    return `
      <div class="bom-lane-panel">
        <div class="bom-lane-title">
          <span>${escapeHtml(versionLabels[version] || version)}</span>
          <em>${escapeHtml(laneDeltaHint(version))}</em>
        </div>
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

  function renderLaneCell(groupKey, version, item, row, statusKey, index, locked, cardOptions = {}, cellClassName = '') {
    const isDropZone = !locked;
    return `
      <div class="bom-align-cell${locked ? ' is-locked' : ''}${cellClassName ? ` ${cellClassName}` : ''}" ${isDropZone ? 'data-drop-zone="true"' : ''} data-group-key="${escapeHtml(groupKey)}" data-side="${escapeHtml(version)}" data-drop-index="${escapeHtml(String(index))}">
        ${renderCard(item, row, version, statusKey, groupKey, index, locked, cardOptions)}
      </div>
    `;
  }

  function renderPartsCell(version, groupKey, partItems, index) {
    if (!Array.isArray(partItems) || !partItems.length) {
      return `
        <div class="bom-align-cell is-locked bom-align-cell-stack">
          <div class="bom-align-empty" aria-hidden="true"></div>
        </div>
      `;
    }

    const stackCards = partItems.map((item, partIndex) => renderCard(
      item,
      { versions: { [version]: item } },
      version,
      'assembly_part',
      groupKey,
      `${index}-${partIndex}`,
      true,
      {
        disableDrag: true,
        deltaOverride: createDelta('散件', 'delta-neutral', `${versionLabels[version] || version} 在该端按散件清单展开显示`),
        titleNote: `${versionLabels[version] || version} 在该端按散件清单展开显示`,
        cardClassName: 'is-stack-item',
      },
    )).join('');

    return `
      <div class="bom-align-cell is-locked bom-align-cell-stack">
        <div class="bom-stack-note">${escapeHtml(shortLabel(version))}散件清单 <strong>${partItems.length}</strong></div>
        <div class="bom-stack-list">
          ${stackCards}
        </div>
      </div>
    `;
  }

  function renderAssemblyRootCell(model, row, index) {
    const mappedSummary = versionOrder
      .filter((version) => version !== baseVersion && row.partLists?.[version]?.length)
      .map((version) => `${shortLabel(version)} ${row.partLists[version].length}`)
      .join(' / ');
    return renderLaneCell(
      model.key,
      baseVersion,
      row.versions?.[baseVersion] || null,
      row,
      'assembly_bundle',
      index,
      true,
      {
        disableDrag: true,
        deltaOverride: createDelta(
          mappedSummary ? `展开 ${mappedSummary}` : '总成映射',
          'delta-neutral',
          `${shortLabel(baseVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`,
        ),
        titleNote: `${shortLabel(baseVersion)} 该端为连接器总成，后续版本按对应端散件清单展开`,
        detailPrefix: `${shortLabel(baseVersion)}总成`,
        cardClassName: 'is-assembly-root',
      },
    );
  }

  function renderRow(model, row, index) {
    const cells = versionOrder.map((version) => {
      const parts = row.partLists?.[version] || [];
      if (parts.length) {
        return renderPartsCell(version, model.key, parts, index);
      }
      if (row.rowType === 'assembly_bundle' && version === baseVersion) {
        return renderAssemblyRootCell(model, row, index);
      }
      return renderLaneCell(
        model.key,
        version,
        row.versions?.[version] || null,
        row,
        row.statuses?.[version] || '',
        index,
        Boolean(row.locked?.[version]),
      );
    });
    return `<div class="bom-align-row${row.rowType === 'assembly_bundle' ? ' bom-align-row-assembly' : ''}">${cells.join('')}</div>`;
  }

  function renderGroup(harnessId, group) {
    const model = buildGroupModel(harnessId, group);
    const statPills = [
      ...versionOrder.map((version) => `${shortLabel(version)} <strong>${model.itemCounts?.[version] || 0}</strong>`),
      `三版匹配 <strong>${model.fullMatchCount || 0}</strong>`,
      `双版对齐 <strong>${model.partialMatchCount || 0}</strong>`,
      ...versionOrder.map((version) => `${sourceOnlyLabel(version)} <strong>${model.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (model.assemblyToPartsCount) {
      statPills.push(`总成映射 <strong>${model.assemblyToPartsCount}</strong>`);
      statPills.push(`展开散件 <strong>${model.assemblyPartCount}</strong>`);
    }

    return `
      <article class="bom-compare-group ${versionOrder.length > 2 ? 'is-bom-multi-way' : ''}" data-group-key="${escapeHtml(model.key)}">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">${escapeHtml(model.label)}</div>
            <div class="bom-compare-group-meta">${escapeHtml(buildGroupMeta(model))}</div>
          </div>
          <div class="bom-compare-group-stats">
            ${statPills.map((text) => `<span class="stat-pill">${text}</span>`).join('')}
          </div>
        </div>
        <div class="bom-compare-body">
          <div class="bom-lane-header">
            ${versionOrder.map((version) => renderLaneColumns(version)).join('')}
          </div>
          <div class="bom-align-board">
            ${model.rows.map((row, index) => renderRow(model, row, index)).join('')}
          </div>
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
      ...versionOrder.map((version) => `${escapeHtml(shortLabel(version))} Sheet <strong>${escapeHtml(comparison.sources?.[version]?.sheet || '-')}</strong>`),
      `连接器组 <strong>${comparison.summary.connectorGroupCount}</strong>`,
      `三版匹配 <strong>${comparison.summary.fullMatchCount || 0}</strong>`,
      `双版对齐 <strong>${comparison.summary.partialMatchCount || 0}</strong>`,
      ...versionOrder.map((version) => `${sourceOnlyLabel(version)} <strong>${comparison.summary.onlyCounts?.[version] || 0}</strong>`),
    ];
    if (comparison.summary.assemblyToPartsCount) {
      summaryItems.push(`总成映射 <strong>${comparison.summary.assemblyToPartsCount}</strong>`);
      summaryItems.push(`展开散件 <strong>${comparison.summary.assemblyPartCount}</strong>`);
    }

    summary.innerHTML = summaryItems.map((text) => `<span class="stat-pill">${text}</span>`).join('');

    const sourceText = versionOrder
      .map((version) => `${shortLabel(version)}：${workbookLabels[version] || bomValidation.meta?.[`${version}Workbook`] || '-'}`)
      .join('；');
    hint.textContent = [
      `来源：${sourceText}。`,
      '已对齐零件锁定在同一行，独有零件可在本版本栏内上下拖动，并借助空白行人工对位。',
      `${shortLabel(baseVersion)} 作为当前锚点版本；若后续版本同端为散件清单，会自动按该端展开映射。`,
      '当前视图按 versionOrder 驱动，后续新增 BOM 版本时可沿用同一套对齐与拖拽机制。',
      '点击“重置对齐”可恢复系统初始排序。',
    ].join(' ');

    groups.classList.toggle('is-bom-multi-way', versionOrder.length > 2);
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
    const sourceRows = model.laneRows[dragState.side];
    const lockedRows = model.lockedRows[dragState.side];
    const nextRows = moveUnlockedRowItem(sourceRows, dragState.fromIndex, Number(dropZone.dataset.dropIndex), lockedRows);
    persistGroupRows(dragState.harnessId, dragState.groupKey, dragState.side, nextRows, lockedRows);
    renderHarness(dragState.harnessId);
    dragState = null;
    clearDropTargets();
  });

  renderHarness(bomValidation.harnessOrder[0]);
})();
