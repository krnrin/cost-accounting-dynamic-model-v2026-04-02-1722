(function () {
  const runtime = window.G281_RUNTIME || {};
  const packagingValidation = runtime.packagingValidation;
  if (!packagingValidation || !packagingValidation.scopeOrder || !packagingValidation.scopeOrder.length) {
    return;
  }

  const openBtn = document.getElementById('openPackagingValidationBtn');
  const closeBtn = document.getElementById('closePackagingValidationBtn');
  const applyQuoteBtn = document.getElementById('applyQuotePackagingBtn');
  const applyFixedBtn = document.getElementById('applyFixedPackagingBtn');
  const modal = document.getElementById('packagingValidationModal');
  const select = document.getElementById('packagingValidationScope');
  const summary = document.getElementById('packagingValidationSummary');
  const groups = document.getElementById('packagingValidationGroups');
  const hint = document.getElementById('packagingValidationHint');
  const backdrop = modal ? modal.querySelector('[data-packaging-close]') : null;

  if (!openBtn || !closeBtn || !applyQuoteBtn || !applyFixedBtn || !modal || !select || !summary || !groups || !hint || !backdrop) {
    return;
  }

  const statusMap = {
    matched: { label: '对齐', className: 'matched' },
    quote_only: { label: '报价独有', className: 'quote-only' },
    fixed_only: { label: '定点独有', className: 'fixed-only' },
    data_issue: { label: '源表异常', className: 'data-issue' },
  };

  let lastFocused = null;
  let applyMessage = '';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const fmtNumber = (value, digits = 4) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return number.toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  };

  const fmtValue = (item) => {
    if (!item) return '-';
    if (item.numericValue !== null && item.numericValue !== undefined) {
      return fmtNumber(item.numericValue, 4);
    }
    return item.value || '-';
  };

  const snapshotLine = (snapshot) => {
    if (!snapshot) return '-';
    return `内外包装 ${fmtNumber(snapshot.packInner)} / 运输费 ${fmtNumber(snapshot.packFreight)} / 仓储费 ${fmtNumber(snapshot.packWarehouse)} / 短驳其他 ${fmtNumber(snapshot.packOther)}`;
  };

  const fmtPercent = (value, digits = 2) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return `${fmtNumber(number * 100, digits)}%`;
  };

  const packagingVersionLabels = {
    base: '报价版',
    optimize: '定点版',
    longhaul: 'TT版',
  };

  function currentHarnessPackagingSection() {
    const bridge = window.G281DashboardBridge;
    const engine = window.G281Engine;
    const harnessProfit = window.G281HarnessProfit;
    if (!bridge || !engine?.computeModel || !harnessProfit?.buildHarnessProfitBreakdown) {
      return null;
    }

    const runtimeSnapshot = bridge.getRuntimeSnapshot?.() || runtime;
    const stateSnapshot = bridge.getStateSnapshot?.();
    const draftSnapshot = bridge.getDraftSnapshot?.();
    if (!runtimeSnapshot || !stateSnapshot || !draftSnapshot) {
      return null;
    }

    let model;
    let breakdown;
    try {
      model = engine.computeModel(runtimeSnapshot, draftSnapshot, stateSnapshot);
      breakdown = harnessProfit.buildHarnessProfitBreakdown(runtimeSnapshot, model, {
        versionKey: bridge.getWorkbookVersionKey?.(),
      });
    } catch (error) {
      return null;
    }

    const activeBomOption = bridge.getBomVersionOption?.(bridge.getActiveBomVersionKey?.()) || null;
    const activeBomExtract = bridge.getActiveBomAutoExtract?.() || null;
    const bomLabel = activeBomOption?.label || breakdown?.meta?.selectedBomVersionLabel || '当前BOM';
    const packagingLabel = packagingVersionLabels[stateSnapshot.packaging] || stateSnapshot.packaging || '当前版本';
    const breakdownRows = Array.isArray(breakdown?.harnesses) ? breakdown.harnesses : [];
    const breakdownMap = new Map(breakdownRows.map((row) => [String(row?.harnessId || ''), row]));

    const extractHarnessRows = [];
    const extractHarnessMap = new Map();
    const lineItems = Array.isArray(activeBomExtract?.lineItems) ? activeBomExtract.lineItems : [];
    lineItems.forEach((item) => {
      const harnessId = String(item?.harnessId || '').trim();
      if (!harnessId) return;
      if (!extractHarnessMap.has(harnessId)) {
        const row = {
          harnessId,
          harnessName: String(item?.harnessName || harnessId).trim() || harnessId,
          itemCount: 0,
          wireLineCount: 0,
          sourceSheetName: String(item?.sourceSheetName || activeBomExtract?.sourceSheetName || '').trim(),
        };
        extractHarnessMap.set(harnessId, row);
        extractHarnessRows.push(row);
      }
      const target = extractHarnessMap.get(harnessId);
      target.itemCount += 1;
      if (!target.harnessName || target.harnessName === target.harnessId) {
        target.harnessName = String(item?.harnessName || target.harnessName || target.harnessId).trim() || target.harnessId;
      }
    });

    const wireItems = Array.isArray(activeBomExtract?.wire?.items) ? activeBomExtract.wire.items : [];
    wireItems.forEach((item) => {
      const harnessId = String(item?.harnessId || '').trim();
      if (!harnessId || !extractHarnessMap.has(harnessId)) return;
      extractHarnessMap.get(harnessId).wireLineCount += 1;
    });

    const baseRows = extractHarnessRows.length ? extractHarnessRows : breakdownRows.map((row) => ({
      harnessId: String(row?.harnessId || ''),
      harnessName: String(row?.harnessName || row?.harnessId || '').trim(),
      itemCount: Number(row?.counts?.selectedItemCount) || 0,
      wireLineCount: Number(row?.counts?.wireLineCount) || 0,
      sourceSheetName: '',
    }));

    const rows = baseRows
      .map((baseRow) => {
        const pricingRow = breakdownMap.get(String(baseRow.harnessId || '').trim()) || null;
        const unitPackagingCost = Number(pricingRow?.unitPackagingCost);
        const noteParts = [];
        if (baseRow.sourceSheetName) noteParts.push(`来源表：${baseRow.sourceSheetName}`);
        noteParts.push(`BOM件数 ${fmtNumber(baseRow.itemCount, 0)}`);
        noteParts.push(`导线 ${fmtNumber(baseRow.wireLineCount, 0)} 条`);
        if (!pricingRow) noteParts.push('当前线束暂无包装分摊结果');
        return {
          harnessId: baseRow.harnessId,
          harnessName: baseRow.harnessName || baseRow.harnessId,
          itemCount: baseRow.itemCount,
          wireLineCount: baseRow.wireLineCount,
          unitPackagingCost: Number.isFinite(unitPackagingCost) ? unitPackagingCost : null,
          packagingShare: Number.isFinite(unitPackagingCost) && Number(model?.packaging) > 0 ? unitPackagingCost / Number(model.packaging) : null,
          sourceSheetName: baseRow.sourceSheetName,
          allocationBasis: pricingRow?.allocationBasis?.nonMaterial || '包装成本按线束材料成本占比分摊',
          note: noteParts.join(' / '),
        };
      })
      .filter((row) => row.harnessId);

    return {
      bomLabel,
      packagingLabel,
      packagingTotal: rows.reduce((sum, row) => sum + (Number(row.unitPackagingCost) || 0), 0),
      rows,
      warning: breakdown?.meta?.warnings?.[0] || '',
    };
  }

  function renderHarnessPackagingSection(section) {
    if (!section || !Array.isArray(section.rows) || !section.rows.length) {
      return '';
    }

    const rows = section.rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.harnessId)}</td>
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.harnessName || '-')}</strong>
            <span>${escapeHtml(row.sourceSheetName || section.bomLabel || '当前BOM')}</span>
          </div>
        </td>
        <td>${row.unitPackagingCost === null ? '-' : fmtNumber(row.unitPackagingCost)}</td>
        <td>${row.packagingShare === null ? '-' : fmtPercent(row.packagingShare)}</td>
        <td>${fmtNumber(row.itemCount, 0)}</td>
        <td>${fmtNumber(row.wireLineCount, 0)}</td>
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.allocationBasis || '包装成本按线束材料成本占比分摊')}</strong>
            <span>${escapeHtml(row.note || '-')}</span>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <section class="bom-compare-group packaging-harness-section">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">按线束号展开</div>
            <div class="bom-compare-group-meta">线束号来源于当前 ${escapeHtml(section.bomLabel)} BOM，包装物流按当前 ${escapeHtml(section.packagingLabel)} 版本与利润引擎口径分摊到各线束。</div>
          </div>
          <div class="bom-compare-group-stats">
            <span class="stat-pill">线束条目 <strong>${section.rows.length}</strong></span>
            <span class="stat-pill">包装版本 <strong>${escapeHtml(section.packagingLabel)}</strong></span>
            <span class="stat-pill">包装合计 <strong>${fmtNumber(section.packagingTotal)} 元/套</strong></span>
          </div>
        </div>
        ${section.warning ? `<p class="bom-validate-hint">${escapeHtml(section.warning)}</p>` : ''}
        <div class="wire-model-table-wrap">
          <table class="wire-model-table packaging-harness-table">
            <thead>
              <tr>
                <th>线束号</th>
                <th>线束名称</th>
                <th>包装物流(元/套)</th>
                <th>占当前包装比例</th>
                <th>BOM件数</th>
                <th>导线条数</th>
                <th>分摊依据 / 说明</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderScopeWithHarness(scopeId) {
    renderScope(scopeId);
    summary.querySelectorAll('.packaging-harness-pill').forEach((node) => node.remove());
    groups.querySelectorAll('.packaging-harness-section').forEach((node) => node.remove());
    const section = currentHarnessPackagingSection();
    if (!section || !section.rows.length) return;
    summary.insertAdjacentHTML('beforeend', `<span class="stat-pill packaging-harness-pill">线束展开 <strong>${section.rows.length}</strong></span>`);
    groups.insertAdjacentHTML('beforeend', renderHarnessPackagingSection(section));
  }

  function currentValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
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
    return packagingValidation.comparisons[scopeId] || null;
  }

  function getDelta(row) {
    const quote = row.quote;
    const fixed = row.fixed;
    const statusKey = (quote && quote.valueType === 'error') || (fixed && fixed.valueType === 'error') ? 'data_issue' : row.status;
    const status = statusMap[statusKey] || statusMap.matched;

    if (!quote || !fixed) {
      return {
        status,
        text: quote ? '报价独有' : '定点独有',
        className: 'delta-neutral',
      };
    }

    const quoteNumber = Number(quote.numericValue);
    const fixedNumber = Number(fixed.numericValue);
    if (Number.isFinite(quoteNumber) && Number.isFinite(fixedNumber)) {
      const delta = fixedNumber - quoteNumber;
      if (Math.abs(delta) < 1e-9) {
        return { status, text: '一致', className: 'delta-same' };
      }
      return {
        status,
        text: `${delta > 0 ? '+' : ''}${fmtNumber(delta)}${fixed.unit ? ` ${fixed.unit}` : ''}`,
        className: delta > 0 ? 'delta-up' : 'delta-down',
      };
    }

    if ((quote.value || '') === (fixed.value || '')) {
      return { status, text: '一致', className: 'delta-same' };
    }

    return {
      status,
      text: '内容不同',
      className: 'delta-neutral',
    };
  }

  function buildTitle(item, deltaText) {
    if (!item) return '';
    return [
      `${item.label}: ${fmtValue(item)} ${item.unit || ''}`.trim(),
      `来源: ${item.source || '-'}`,
      item.note ? `备注: ${item.note}` : '',
      item.formula ? `公式: ${item.formula}` : '',
      deltaText ? `差异: ${deltaText}` : '',
    ].filter(Boolean).join('\n');
  }

  function renderLaneColumns(title) {
    return `
      <div class="bom-lane-panel">
        <div class="bom-lane-title">${escapeHtml(title)}</div>
        <div class="bom-lane-columns packaging-lane-columns">
          <span>状态</span>
          <span>编号 / 单元格</span>
          <span>指标 / 零件</span>
          <span>单位</span>
          <span>值</span>
          <span>来源页签</span>
          <span>拆分 / 备注</span>
          <span>差异</span>
        </div>
      </div>
    `;
  }

  function renderCard(item, delta, sideStatus) {
    if (!item) {
      return '<div class="bom-align-empty">该侧留空</div>';
    }
    const status = statusMap[sideStatus] || statusMap.matched;
    const noteText = item.note || item.formula || '与对侧一致';
    const title = buildTitle(item, delta.text);
    const idText = item.displayLabel || item.sourceCell || '-';
    return `
      <article class="bom-card packaging-card" title="${escapeHtml(title)}">
        <span class="status-pill bom-status ${status.className}">${escapeHtml(status.label)}</span>
        <span class="bom-inline-field bom-code">${escapeHtml(idText)}</span>
        <span class="bom-inline-field bom-name">${escapeHtml(item.label || '-')}</span>
        <span class="bom-inline-field bom-detail">${escapeHtml(item.unit || '-')}</span>
        <span class="bom-inline-field packaging-value${item.valueType === 'error' ? ' is-error' : ''}">${escapeHtml(fmtValue(item))}</span>
        <span class="bom-inline-field bom-detail">${escapeHtml(item.sourceSheet || '-')}</span>
        <span class="bom-inline-field bom-note">${escapeHtml(noteText)}</span>
        <span class="bom-inline-field bom-delta ${delta.className}">${escapeHtml(delta.text)}</span>
      </article>
    `;
  }

  function renderGroup(group) {
    const summaryData = group.summary || {};
    const stats = [
      `<span class="stat-pill">定点 <strong>${summaryData.fixedCount || 0}</strong></span>`,
      `<span class="stat-pill">报价 <strong>${summaryData.quoteCount || 0}</strong></span>`,
      `<span class="stat-pill">匹配 <strong>${summaryData.matchedCount || 0}</strong></span>`,
      `<span class="stat-pill">差异 <strong>${summaryData.differenceCount || 0}</strong></span>`,
    ].join('');

    const rows = (group.aligned || []).map((row) => {
      const delta = getDelta(row);
      const quoteStatus = row.quote && row.quote.valueType === 'error' ? 'data_issue' : row.status;
      const fixedStatus = row.fixed && row.fixed.valueType === 'error' ? 'data_issue' : row.status;
      return `
        <div class="bom-align-row">
          <div class="bom-align-cell">
            ${renderCard(row.fixed, delta, fixedStatus)}
          </div>
          <div class="bom-align-cell">
            ${renderCard(row.quote, delta, quoteStatus)}
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="bom-compare-group">
        <div class="bom-compare-group-head">
          <div>
            <div class="bom-compare-group-label">${escapeHtml(group.label || '-')}</div>
            <div class="bom-compare-group-meta">${escapeHtml(group.meta || '')}</div>
          </div>
          <div class="bom-compare-group-stats">${stats}</div>
        </div>
        <div class="bom-lane-header">
          ${renderLaneColumns('定点核算')}
          ${renderLaneColumns('报价核算')}
        </div>
        <div class="bom-align-board">${rows || '<div class="bom-compare-empty-state">当前分组没有包装物流明细。</div>'}</div>
      </section>
    `;
  }

  function renderScope(scopeId) {
    const comparison = getComparison(scopeId);
    if (!comparison) {
      summary.innerHTML = '<div class="bom-compare-empty-state">未找到包装物流对比数据。</div>';
      groups.innerHTML = '';
      hint.textContent = '当前没有可用的包装物流管理数据。';
      return;
    }

    const quoteSnapshot = packagingValidation.versionSnapshots.quote;
    const fixedSnapshot = packagingValidation.versionSnapshots.fixed;
    const summaryData = comparison.summary || {};
    summary.innerHTML = [
      `<span class="stat-pill">定点项 <strong>${summaryData.fixedCount || 0}</strong></span>`,
      `<span class="stat-pill">报价项 <strong>${summaryData.quoteCount || 0}</strong></span>`,
      `<span class="stat-pill">匹配项 <strong>${summaryData.matchedCount || 0}</strong></span>`,
      `<span class="stat-pill">差异项 <strong>${summaryData.differenceCount || 0}</strong></span>`,
      `<span class="stat-pill">定点版 <strong>${escapeHtml(snapshotLine(fixedSnapshot))}</strong></span>`,
      `<span class="stat-pill">报价版 <strong>${escapeHtml(snapshotLine(quoteSnapshot))}</strong></span>`,
      '<span class="stat-pill">当前激活对比列 <strong>定点 / 报价</strong></span>',
      '<span class="stat-pill">可编辑项：内外包装/运输费/仓储费/短驳其他 <button type="button" data-pack-action="apply-manual">应用当前输入</button></span>',
    ].join('');
    hint.textContent = [comparison.hint, applyMessage].filter(Boolean).join(' ');
    groups.innerHTML = (comparison.groups || []).map(renderGroup).join('');
  }

  function emitInput(element) {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applySnapshot(kind) {
    const snapshot = packagingValidation.versionSnapshots[kind];
    if (!snapshot) return;
    const packInner = document.getElementById('packInner');
    const packFreight = document.getElementById('packFreight');
    const packWarehouse = document.getElementById('packWarehouse');
    const packOther = document.getElementById('packOther');

    if (packInner && snapshot.packInner !== null && snapshot.packInner !== undefined) {
      packInner.value = String(snapshot.packInner);
      emitInput(packInner);
    }
    if (packFreight && snapshot.packFreight !== null && snapshot.packFreight !== undefined) {
      packFreight.value = String(snapshot.packFreight);
      emitInput(packFreight);
    }
    if (packWarehouse && snapshot.packWarehouse !== null && snapshot.packWarehouse !== undefined) {
      packWarehouse.value = String(snapshot.packWarehouse);
      emitInput(packWarehouse);
    }
    if (packOther && snapshot.packOther !== null && snapshot.packOther !== undefined) {
      packOther.value = String(snapshot.packOther);
      emitInput(packOther);
    }

    applyMessage = `已应用 ${snapshot.label}：内外包装 ${fmtNumber(snapshot.packInner)}，运输费 ${fmtNumber(snapshot.packFreight)}，仓储费 ${fmtNumber(snapshot.packWarehouse)}，短驳其他 ${fmtNumber(snapshot.packOther)}。`;
    renderScopeWithHarness(select.value);
  }

  function applyManual() {
    const packInner = document.getElementById('packInner');
    const packFreight = document.getElementById('packFreight');
    const packWarehouse = document.getElementById('packWarehouse');
    const packOther = document.getElementById('packOther');
    [packInner, packFreight, packWarehouse, packOther].forEach(emitInput);
    applyMessage = `已应用手工输入：内外包装 ${currentValue('packInner')} / 运输费 ${currentValue('packFreight')} / 仓储费 ${currentValue('packWarehouse')} / 短驳其他 ${currentValue('packOther')}`;
    renderScopeWithHarness(select.value);
  }

  packagingValidation.scopeOrder.forEach((scopeId) => {
    const comparison = getComparison(scopeId);
    if (!comparison) return;
    const option = document.createElement('option');
    option.value = scopeId;
    option.textContent = comparison.scopeLabel || scopeId;
    select.appendChild(option);
  });

  openBtn.addEventListener('click', (event) => {
    const bridge = window.G281DashboardBridge;
    if (bridge?.openVersionTemplateModal) {
      event.preventDefault();
      event.stopPropagation();
      bridge.openVersionTemplateModal('packaging');
      return;
    }
    setModalOpen(true);
    renderScopeWithHarness(select.value || packagingValidation.scopeOrder[0]);
  });
  closeBtn.addEventListener('click', () => setModalOpen(false));
  backdrop.addEventListener('click', () => setModalOpen(false));
  select.addEventListener('change', () => renderScopeWithHarness(select.value));
  applyQuoteBtn.addEventListener('click', () => applySnapshot('quote'));
  applyFixedBtn.addEventListener('click', () => applySnapshot('fixed'));
  summary.addEventListener('click', (event) => {
    if (event.target?.dataset?.packAction === 'apply-manual') {
      applyManual();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setModalOpen(false);
    }
  });

  const dashboardEventNames = window.G281DashboardBridge?.getDashboardEventNames?.();
  if (dashboardEventNames?.versionChange) {
    window.addEventListener(dashboardEventNames.versionChange, () => {
      if (!modal.hidden) {
        renderScopeWithHarness(select.value || packagingValidation.scopeOrder[0]);
      }
    });
  }

  renderScopeWithHarness(packagingValidation.scopeOrder[0]);
})();
