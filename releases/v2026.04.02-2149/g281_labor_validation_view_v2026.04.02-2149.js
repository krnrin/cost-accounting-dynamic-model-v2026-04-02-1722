(function () {
  const runtime = window.G281_RUNTIME || {};
  const laborValidation = runtime.laborValidation;
  if (!laborValidation || !laborValidation.scopeOrder || !laborValidation.scopeOrder.length) {
    return;
  }

  const openBtn = document.getElementById('openLaborValidationBtn');
  const closeBtn = document.getElementById('closeLaborValidationBtn');
  const applyQuoteBtn = document.getElementById('applyQuoteLaborBtn');
  const applyFixedBtn = document.getElementById('applyFixedLaborBtn');
  const modal = document.getElementById('laborValidationModal');
  const select = document.getElementById('laborValidationScope');
  const summary = document.getElementById('laborValidationSummary');
  const groups = document.getElementById('laborValidationGroups');
  const hint = document.getElementById('laborValidationHint');
  const backdrop = modal ? modal.querySelector('[data-labor-close]') : null;

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
      const digits = item.unit && item.unit.includes('系数') ? 3 : 4;
      return fmtNumber(item.numericValue, digits);
    }
    return item.value || '-';
  };

  const snapshotLine = (snapshot) => {
    if (!snapshot) return '-';
    return `前 ${fmtNumber(snapshot.directHours)}h x ${fmtNumber(snapshot.directRate, 2)} / 后 ${fmtNumber(snapshot.manufacturingHours)}h x ${fmtNumber(snapshot.manufacturingRate, 2)}`;
  };

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
    return laborValidation.comparisons[scopeId] || null;
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
        <div class="bom-lane-columns labor-lane-columns">
          <span>状态</span>
          <span>单元格</span>
          <span>指标</span>
          <span>单位</span>
          <span>值</span>
          <span>来源页签</span>
          <span>备注 / 逻辑</span>
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
    return `
      <article class="bom-card labor-card" title="${escapeHtml(title)}">
        <span class="status-pill bom-status ${status.className}">${escapeHtml(status.label)}</span>
        <span class="bom-inline-field bom-code">${escapeHtml(item.sourceCell || '-')}</span>
        <span class="bom-inline-field bom-name">${escapeHtml(item.label || '-')}</span>
        <span class="bom-inline-field bom-detail">${escapeHtml(item.unit || '-')}</span>
        <span class="bom-inline-field labor-value${item.valueType === 'error' ? ' is-error' : ''}">${escapeHtml(fmtValue(item))}</span>
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
        <div class="bom-align-board">${rows || '<div class="bom-compare-empty-state">当前分组没有工时明细。</div>'}</div>
      </section>
    `;
  }

  function renderScope(scopeId) {
    const comparison = getComparison(scopeId);
    if (!comparison) {
      summary.innerHTML = '<div class="bom-compare-empty-state">未找到工时对比数据。</div>';
      groups.innerHTML = '';
      hint.textContent = '当前没有可用的工时管理数据。';
      return;
    }

    const quoteSnapshot = laborValidation.versionSnapshots.quote;
    const fixedSnapshot = laborValidation.versionSnapshots.fixed;
    const summaryData = comparison.summary || {};
    summary.innerHTML = [
      `<span class="stat-pill">定点项 <strong>${summaryData.fixedCount || 0}</strong></span>`,
      `<span class="stat-pill">报价项 <strong>${summaryData.quoteCount || 0}</strong></span>`,
      `<span class="stat-pill">匹配项 <strong>${summaryData.matchedCount || 0}</strong></span>`,
      `<span class="stat-pill">差异项 <strong>${summaryData.differenceCount || 0}</strong></span>`,
      `<span class="stat-pill">定点版 <strong>${escapeHtml(snapshotLine(fixedSnapshot))}</strong></span>`,
      `<span class="stat-pill">报价版 <strong>${escapeHtml(snapshotLine(quoteSnapshot))}</strong></span>`,
      '<span class="stat-pill">当前激活对比列 <strong>定点 / 报价</strong></span>',
      '<span class="stat-pill">可编辑项：前工时/前费率/后工时/后费率 <button type="button" data-labor-action="apply-manual">应用当前输入</button></span>',
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
    const snapshot = laborValidation.versionSnapshots[kind];
    if (!snapshot) return;
    const directHours = document.getElementById('directHours');
    const directRate = document.getElementById('directRate');
    const manufacturingHours = document.getElementById('manufacturingHours');
    const manufacturingRate = document.getElementById('manufacturingRate');

    if (directHours && snapshot.directHours !== null && snapshot.directHours !== undefined) {
      directHours.value = String(snapshot.directHours);
      emitInput(directHours);
    }
    if (directRate && snapshot.directRate !== null && snapshot.directRate !== undefined) {
      directRate.value = String(snapshot.directRate);
      emitInput(directRate);
    }
    if (manufacturingHours && snapshot.manufacturingHours !== null && snapshot.manufacturingHours !== undefined) {
      manufacturingHours.value = String(snapshot.manufacturingHours);
      emitInput(manufacturingHours);
    }
    if (manufacturingRate && snapshot.manufacturingRate !== null && snapshot.manufacturingRate !== undefined) {
      manufacturingRate.value = String(snapshot.manufacturingRate);
      emitInput(manufacturingRate);
    }

    applyMessage = `已应用 ${snapshot.label}：前工程 ${fmtNumber(snapshot.directHours)}h / ${fmtNumber(snapshot.directRate, 2)}元/h，后工程 ${fmtNumber(snapshot.manufacturingHours)}h / ${fmtNumber(snapshot.manufacturingRate, 2)}元/h。`;
    renderScope(select.value);
  }

  function applyManual() {
    const directHours = document.getElementById('directHours');
    const directRate = document.getElementById('directRate');
    const manufacturingHours = document.getElementById('manufacturingHours');
    const manufacturingRate = document.getElementById('manufacturingRate');
    [directHours, directRate, manufacturingHours, manufacturingRate].forEach(emitInput);
    applyMessage = `已应用手工输入：前工时 ${currentValue('directHours')} / 前费率 ${currentValue('directRate')} / 后工时 ${currentValue('manufacturingHours')} / 后费率 ${currentValue('manufacturingRate')}`;
    renderScope(select.value);
  }

  laborValidation.scopeOrder.forEach((scopeId) => {
    const comparison = getComparison(scopeId);
    if (!comparison) return;
    const option = document.createElement('option');
    option.value = scopeId;
    option.textContent = comparison.scopeLabel || scopeId;
    select.appendChild(option);
  });

  openBtn.addEventListener('click', () => {
    setModalOpen(true);
    renderScope(select.value || laborValidation.scopeOrder[0]);
  });
  closeBtn.addEventListener('click', () => setModalOpen(false));
  backdrop.addEventListener('click', () => setModalOpen(false));
  select.addEventListener('change', () => renderScope(select.value));
  applyQuoteBtn.addEventListener('click', () => applySnapshot('quote'));
  applyFixedBtn.addEventListener('click', () => applySnapshot('fixed'));
  summary.addEventListener('click', (event) => {
    if (event.target?.dataset?.laborAction === 'apply-manual') {
      applyManual();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setModalOpen(false);
    }
  });

  renderScope(laborValidation.scopeOrder[0]);
})();
