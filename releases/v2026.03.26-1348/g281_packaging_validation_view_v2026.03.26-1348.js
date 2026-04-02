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
      const digits = item.unit && item.unit.includes('元') ? 4 : 4;
      return fmtNumber(item.numericValue, digits);
    }
    return item.value || '-';
  };

  const snapshotLine = (snapshot) => {
    if (!snapshot) return '-';
    return `内外包装 ${fmtNumber(snapshot.packInner)} / 运输费 ${fmtNumber(snapshot.packFreight)} / 仓储费 ${fmtNumber(snapshot.packWarehouse)} / 短驳其他 ${fmtNumber(snapshot.packOther)}`;
  };

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
          <span>来源页</span>
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
      `<span class="stat-pill">报价 <strong>${summaryData.quoteCount || 0}</strong></span>`,
      `<span class="stat-pill">定点 <strong>${summaryData.fixedCount || 0}</strong></span>`,
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
            ${renderCard(row.quote, delta, quoteStatus)}
          </div>
          <div class="bom-align-cell">
            ${renderCard(row.fixed, delta, fixedStatus)}
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
          ${renderLaneColumns('报价核算')}
          ${renderLaneColumns('定点核算')}
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
      `<span class="stat-pill">报价项 <strong>${summaryData.quoteCount || 0}</strong></span>`,
      `<span class="stat-pill">定点项 <strong>${summaryData.fixedCount || 0}</strong></span>`,
      `<span class="stat-pill">匹配项 <strong>${summaryData.matchedCount || 0}</strong></span>`,
      `<span class="stat-pill">差异项 <strong>${summaryData.differenceCount || 0}</strong></span>`,
      `<span class="stat-pill">报价版 <strong>${escapeHtml(snapshotLine(quoteSnapshot))}</strong></span>`,
      `<span class="stat-pill">定点版 <strong>${escapeHtml(snapshotLine(fixedSnapshot))}</strong></span>`,
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

    applyMessage = `已应用${snapshot.label}：内外包装 ${fmtNumber(snapshot.packInner)}，运输费 ${fmtNumber(snapshot.packFreight)}，仓储费 ${fmtNumber(snapshot.packWarehouse)}，短驳/其他 ${fmtNumber(snapshot.packOther)}。`;
    renderScope(select.value);
  }

  packagingValidation.scopeOrder.forEach((scopeId) => {
    const comparison = getComparison(scopeId);
    if (!comparison) return;
    const option = document.createElement('option');
    option.value = scopeId;
    option.textContent = comparison.scopeLabel || scopeId;
    select.appendChild(option);
  });

  openBtn.addEventListener('click', () => {
    setModalOpen(true);
    renderScope(select.value || packagingValidation.scopeOrder[0]);
  });
  closeBtn.addEventListener('click', () => setModalOpen(false));
  backdrop.addEventListener('click', () => setModalOpen(false));
  select.addEventListener('change', () => renderScope(select.value));
  applyQuoteBtn.addEventListener('click', () => applySnapshot('quote'));
  applyFixedBtn.addEventListener('click', () => applySnapshot('fixed'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      setModalOpen(false);
    }
  });

  renderScope(packagingValidation.scopeOrder[0]);
})();
