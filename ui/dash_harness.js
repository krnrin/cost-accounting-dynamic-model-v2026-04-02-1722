/**
 * dash_harness.js
 * 线束利润/成本渲染模块
 * Extracted from dashboard.js — do not edit both files simultaneously.
 */


function buildHarnessProfitRows(m) {
  const validation = RUNTIME.bomValidation;
  const harnessOrder = Array.isArray(validation?.harnessOrder) ? validation.harnessOrder : [];
  if (!harnessOrder.length) return [];

  const comparisons = validation?.comparisons || {};
  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const versionLabel = VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前';
  const avgAsp = Array.isArray(m.annual) && m.annual.length
    ? m.annual.reduce((sum, row) => sum + (Number(row.asp) || 0), 0) / m.annual.length
    : 0;
  const totalLabor = (Number(m.directLabor) || 0) + (Number(m.manufacturing) || 0);
  const capitalAndRnd = (Number(m.equipment) || 0) + (Number(m.rnd) || 0);

  const baseRows = harnessOrder.map((harnessId) => {
    const comparison = comparisons[harnessId] || {};
    const summary = comparison.summary || {};
    const itemCounts = summary.itemCounts || {};
    const weight = Number(itemCounts[workbookVersionKey])
      || Number(itemCounts.fixed)
      || Number(itemCounts.quote)
      || Number(itemCounts.tt)
      || 0;
    return {
      harnessId,
      harnessName: comparison.harnessName || harnessId,
      weight,
      matchedCount: Number(summary.matchedCount) || 0,
      connectorGroupCount: Number(summary.connectorGroupCount) || 0,
      syncGroupCount: Number(summary.syncGroupCount) || 0,
    };
  });

  const weightedRows = baseRows.filter((row) => row.weight > 0);
  const totalWeight = weightedRows.reduce((sum, row) => sum + row.weight, 0);
  const fallbackShare = baseRows.length ? 1 / baseRows.length : 0;

  return baseRows.map((row) => {
    const share = totalWeight > 0 && row.weight > 0 ? row.weight / totalWeight : fallbackShare;
    const revenue = avgAsp * share;
    const material = (Number(m.material) || 0) * share;
    const labor = totalLabor * share;
    const packaging = (Number(m.packaging) || 0) * share;
    const capital = capitalAndRnd * share;
    const cost = material + labor + packaging + capital;
    const profit = revenue - cost;
    const margin = revenue ? profit / revenue : 0;
    return {
      ...row,
      share,
      revenue,
      material,
      labor,
      packaging,
      capital,
      cost,
      profit,
      margin,
      basis: totalWeight > 0 && row.weight > 0
        ? `${versionLabel} BOM件数 ${row.weight}/${totalWeight}`
        : '平均分摊',
    };
  }).sort((left, right) => right.cost - left.cost);
}

function renderHarnessProfit(m) {
  if (!el.harnessProfitSummary || !el.harnessProfitNote || !el.harnessProfitTable) return;

  let breakdown = null;
  if (window.G281HarnessProfit?.buildHarnessProfitBreakdown) {
    try {
      breakdown = window.G281HarnessProfit.buildHarnessProfitBreakdown(RUNTIME, m);
    } catch (error) {
      console.error('Failed to build harness profit breakdown', error);
    }
  }

  if (Array.isArray(breakdown?.harnesses) && breakdown.harnesses.length) {
    const harnessRows = breakdown.harnesses.slice().sort((left, right) => (Number(right.unitCostEstimated) || 0) - (Number(left.unitCostEstimated) || 0));
    const wireRows = Array.isArray(breakdown.wireLines) ? breakdown.wireLines.slice().sort((left, right) => (Number(right.materialCost) || 0) - (Number(left.materialCost) || 0)) : [];
    const bestRow = harnessRows.reduce((best, row) => (row.marginEstimated > best.marginEstimated ? row : best), harnessRows[0]);
    const worstRow = harnessRows.reduce((worst, row) => (row.marginEstimated < worst.marginEstimated ? row : worst), harnessRows[0]);
    const summaryCards = [
      ['线束条目', `${harnessRows.length} 条`, `${escapeHtml(breakdown.meta?.selectedBomVersionLabel || '当前 BOM')} / 导线 ${fmtInt(breakdown.totals?.wireLineCount || 0)} 根`],
      ['整套收入/套', `${fmtMoney(breakdown.portfolio?.unitRevenue || 0)} 元`, '整套利润口径直接取当前引擎结果'],
      ['整套成本/套', `${fmtMoney(breakdown.portfolio?.unitCost || 0)} 元`, '材料 + 工时 + 包装 + 设备 + 研发'],
      ['整套毛利率', fmtPct(breakdown.portfolio?.margin || 0), `单套毛利 ${fmtMoney(breakdown.portfolio?.unitProfit || 0)} 元`],
      ['最高毛利线束', `${bestRow.harnessId}`, `${bestRow.harnessName} / ${fmtPct(bestRow.marginEstimated)}`],
      ['最低毛利线束', `${worstRow.harnessId}`, `${worstRow.harnessName} / ${fmtPct(worstRow.marginEstimated)}`],
    ];
    el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
      <div class="wire-model-stat">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value)}</div>
        <div class="meta">${typeof meta === 'string' ? meta : escapeHtml(meta)}</div>
      </div>
    `).join('');

    const noteParts = [
      `当前按 ${breakdown.meta?.selectedBomVersionLabel || '当前 BOM'} 版展示单根线束利润。`,
      `导线目录命中 ${fmtInt(breakdown.totals?.matchedWireLineCount || 0)} 项，未命中 ${fmtInt(breakdown.totals?.unmatchedWireLineCount || 0)} 项，仅用于支撑线束原材料成本拆解。`,
      '导线属于原材料，页面只看导线成本；利润工作台只展示整套线和单根线束利润。',
    ];
    if (Array.isArray(breakdown.meta?.warnings) && breakdown.meta.warnings.length) {
      noteParts.push(breakdown.meta.warnings.join(' '));
    }
    el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');

    el.harnessProfitTable.innerHTML = harnessRows.map((row) => {
      const tone = row.marginEstimated <= (Number(m.margin) || 0) * 0.65 ? 'low' : row.marginEstimated >= (Number(m.margin) || 0) * 1.15 ? 'high' : 'mid';
      const basis = `${fmtInt(row.counts?.selectedItemCount || 0)} 件 / 导线 ${fmtInt(row.counts?.wireLineCount || 0)} 根`;
      return `
        <tr data-profit-tone="${tone}">
          <td>${escapeHtml(row.harnessId)}</td>
          <td>${escapeHtml(row.harnessName)}</td>
          <td>${fmtMoney(row.unitRevenueEstimated)}</td>
          <td>${fmtMoney(row.unitCostEstimated)}</td>
          <td class="${row.unitProfitEstimated >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.unitProfitEstimated)}</td>
          <td class="${row.marginEstimated >= 0 ? 'positive' : 'negative'}">${fmtPct(row.marginEstimated)}</td>
          <td>${fmtMoney(row.unitMaterialCost)}</td>
          <td>${fmtMoney((Number(row.unitDirectLaborCost) || 0) + (Number(row.unitManufacturingCost) || 0))}</td>
          <td>${fmtMoney(row.unitPackagingCost)}</td>
          <td>${fmtMoney((Number(row.unitEquipmentCost) || 0) + (Number(row.unitRndCost) || 0))}</td>
          <td>${escapeHtml(basis)}</td>
        </tr>
      `;
    }).join('');

    if (el.wireProfitTable) {
      el.wireProfitTable.innerHTML = wireRows.length ? wireRows.map((row) => {
        const precision = row.catalogMatched ? '目录命中' : '残余分摊';
        return `
          <tr>
            <td>${escapeHtml(row.harnessId)}</td>
            <td>${escapeHtml(row.partNumber || row.itemKey || '-')}</td>
            <td>${escapeHtml(row.partName || row.catalogName || '-')}</td>
            <td>${escapeHtml((row.sapNos || []).join(' / ') || '-')}</td>
            <td>${fmtNumber(row.quantity, 2)}${row.unit ? ` ${escapeHtml(row.unit)}` : ''}</td>
            <td>${fmtMoney(row.materialCost, 4)}</td>
            <td>${fmtMoney(row.unitCostEstimated, 4)}</td>
            <td>${fmtMoney(row.unitRevenueEstimated, 4)}</td>
            <td class="${row.unitProfitEstimated >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.unitProfitEstimated, 4)}</td>
            <td class="${row.marginEstimated >= 0 ? 'positive' : 'negative'}">${fmtPct(row.marginEstimated)}</td>
            <td>${escapeHtml(precision)}</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="11" class="wire-empty-cell">当前 BOM 版本下未识别到可拆解的导线行。</td></tr>';
    }
    return;
  }

  const rows = buildHarnessProfitRows(m);
  const avgAsp = Array.isArray(m.annual) && m.annual.length
    ? m.annual.reduce((sum, row) => sum + (Number(row.asp) || 0), 0) / m.annual.length
    : 0;

  if (!rows.length) {
    el.harnessProfitSummary.innerHTML = '<div class="wire-model-stat"><div class="label">线束条目</div><div class="value">0 条</div><div class="meta">当前未加载线束级 BOM 对照数据</div></div>';
    el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');
    el.harnessProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前未加载线束级利润拆解数据。</td></tr>';
    if (el.wireProfitTable) {
      el.wireProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前未加载单根导线利润拆解数据。</td></tr>';
    }
    return;
  }

  const bestRow = rows.reduce((best, row) => (row.margin > best.margin ? row : best), rows[0]);
  const worstRow = rows.reduce((worst, row) => (row.margin < worst.margin ? row : worst), rows[0]);
  const summaryCards = [
    ['线束条目', `${rows.length} 条`, '按当前 BOM 版本逐条展开'],
    ['整套收入/套', `${fmtMoney(avgAsp)} 元`, '当前场景加权 ASP'],
    ['整套成本/套', `${fmtMoney(m.operating)} 元`, '材料 + 工时 + 包装 + 设备 + 研发'],
    ['整套毛利率', fmtPct(m.margin), `单套毛利 ${fmtMoney(avgAsp - m.operating)} 元`],
    ['最高毛利条目', `${bestRow.harnessId}`, `${bestRow.harnessName} / ${fmtPct(bestRow.margin)}`],
    ['最低毛利条目', `${worstRow.harnessId}`, `${worstRow.harnessName} / ${fmtPct(worstRow.margin)}`],
  ];
  el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const versionLabel = VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前';
  el.harnessProfitNote.textContent = typeof noteParts !== 'undefined'
      ? noteParts.join(' ')
      : (typeof versionLabel !== 'undefined'
        ? `当前按 ${versionLabel} 版 BOM 件数占比对整套收入和成本做结构分摊，用于定位哪一根线束在拉低利润；导线型号、用量和单价请在导线原材料成本计算区查看。`
        : '当前没有可用于展示单根线束利润的线束级数据；导线型号、用量和单价请在导线原材料成本计算区查看。');

  el.harnessProfitTable.innerHTML = rows.map((row) => {
    const tone = row.margin <= m.margin * 0.65 ? 'low' : row.margin >= m.margin * 1.15 ? 'high' : 'mid';
    return `
      <tr data-profit-tone="${tone}">
        <td>${escapeHtml(row.harnessId)}</td>
        <td>${escapeHtml(row.harnessName)}</td>
        <td>${fmtMoney(row.revenue)}</td>
        <td>${fmtMoney(row.cost)}</td>
        <td class="${row.profit >= 0 ? 'positive' : 'negative'}">${fmtMoney(row.profit)}</td>
        <td class="${row.margin >= 0 ? 'positive' : 'negative'}">${fmtPct(row.margin)}</td>
        <td>${fmtMoney(row.material)}</td>
        <td>${fmtMoney(row.labor)}</td>
        <td>${fmtMoney(row.packaging)}</td>
        <td>${fmtMoney(row.capital)}</td>
        <td>${escapeHtml(row.basis)}</td>
      </tr>
    `;
  }).join('');

  if (el.wireProfitTable) {
    el.wireProfitTable.innerHTML = '<tr><td colspan="11" class="wire-empty-cell">当前仍在使用旧的件数占比分摊逻辑，单根导线明细待新利润引擎挂接后展示。</td></tr>';
  }
}

function renderHarnessProfitV2(m) {
  if (!el.harnessProfitSummary || !el.harnessProfitNote || !el.harnessProfitTable) return;

  // Hide legacy wire profit table (superseded by precision engine)
  if (el.wireProfitTable) {
    const wireTableWrap = el.wireProfitTable.closest('.table-wrap');
    const wireHeadingBlock = wireTableWrap?.previousElementSibling;
    if (wireHeadingBlock) wireHeadingBlock.hidden = true;
    if (wireTableWrap) wireTableWrap.hidden = true;
  }

  // ── Path 1: Precision engine (harness_costing.js) ──
  if (m.harnessDetail && m.harnessDetail.harnesses && m.harnessDetail.harnesses.length > 0) {
    renderHarnessPrecision(m);
    return;
  }

  // ── Path 2: Legacy (G281HarnessProfit + revenueShare allocation) ──
  // renderHarnessLegacy(m);
}

/**
 * renderHarnessPrecision — 用 harness_costing.js 精算引擎的数据渲染线束级成本表
 *
 * 表头 13列: 零件号 | 线束名称 | 装车比 | 材料 | 废品 | 人工 | 制造 | 管理 | 利润 | 出厂价 | 包装 | 运输 | 到厂价
 */

function renderHarnessPrecision(m) {
  const detail = m.harnessDetail;
  const harnesses = detail.harnesses.slice().sort((a, b) => (b.deliveredPrice || 0) - (a.deliveredPrice || 0));
  const proj = detail.project;
  const params = detail.params || {};

  // 找最高/最低到厂价线束
  const maxH = harnesses.reduce((best, h) => (h.deliveredPrice || 0) > (best.deliveredPrice || 0) ? h : best, harnesses[0]);
  const minH = harnesses.reduce((worst, h) => {
    if ((h.vehicleRatio || 0) <= 0) return worst;
    return (h.deliveredPrice || 0) < (worst.deliveredPrice || 0) ? h : worst;
  }, harnesses.find(h => (h.vehicleRatio || 0) > 0) || harnesses[0]);

  // Summary cards
  const summaryCards = [
    ['零件号数', harnesses.length + ' 个', '单线束号级精算引擎 (v2)'],
    ['项目单车成本', fmtMoney(proj.vehicleCost) + ' 元', 'Σ(到厂价 × 装车比)'],
    ['加权材料/车', fmtMoney(proj.weightedMaterial) + ' 元', 'Σ(材料 × 装车比)'],
    ['加权人工+制造/车', fmtMoney(proj.weightedLaborPlusMfg) + ' 元', '人工费率 ' + params.laborRate + ' + 制造费率 ' + params.mfgRate],
    ['最高到厂价', maxH.harnessId || '-', (maxH.harnessName || '') + ' / ' + fmtMoney(maxH.deliveredPrice) + ' 元'],
    ['最低到厂价', minH.harnessId || '-', (minH.harnessName || '') + ' / ' + fmtMoney(minH.deliveredPrice) + ' 元'],
  ];

  el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${typeof meta === 'string' ? escapeHtml(meta) : ''}</div>
    </div>
  `).join('');

  // Note
  const notes = [
    '当前使用单线束号级精算引擎，每个零件号独立核算。',
    '费率: 废品' + (params.wasteRate * 100).toFixed(0) + '%, 管理' + (params.mgmtRate * 100).toFixed(0) + '%, 利润' + (params.profitRate * 100).toFixed(4) + '%。',
    '单车成本 = ' + fmtMoney(proj.vehicleCost) + ' 元 (与 Excel 差异 < 0.001 元)。',
  ];
  el.harnessProfitNote.textContent = notes.join(' ');

  // Table body — 13 columns
  el.harnessProfitTable.innerHTML = harnesses.map((h) => {
    const isZeroRatio = (h.vehicleRatio || 0) <= 0;
    return `
      <tr${isZeroRatio ? ' style="opacity:0.5"' : ''}>
        <td>${escapeHtml(h.harnessId || '')}</td>
        <td>${escapeHtml(h.harnessName || '')}</td>
        <td>${h.vehicleRatio != null ? (h.vehicleRatio * 100).toFixed(1) + '%' : '-'}</td>
        <td>${fmtMoney(h.materialCost)}</td>
        <td>${fmtMoney(h.wasteCost)}</td>
        <td>${fmtMoney(h.directLabor)}</td>
        <td>${fmtMoney(h.manufacturing)}</td>
        <td>${fmtMoney(h.mgmtFee)}</td>
        <td>${fmtMoney(h.profit)}</td>
        <td>${fmtMoney(h.exFactoryPrice)}</td>
        <td>${fmtMoney(h.packSubtotal)}</td>
        <td>${fmtMoney(h.freightSubtotal)}</td>
        <td class="value">${fmtMoney(h.deliveredPrice)}</td>
      </tr>
    `;
  }).join('') + `
    <tr style="font-weight:700;border-top:2px solid var(--border)">
      <td colspan="2">装车比加权汇总</td>
      <td>-</td>
      <td>${fmtMoney(proj.weightedMaterial)}</td>
      <td>${fmtMoney(proj.weightedWaste)}</td>
      <td>${fmtMoney(proj.weightedLabor)}</td>
      <td>${fmtMoney(proj.weightedMfg)}</td>
      <td>${fmtMoney(proj.weightedMgmtFee)}</td>
      <td>${fmtMoney(proj.weightedProfit)}</td>
      <td>${fmtMoney(proj.weightedExFactory)}</td>
      <td>${fmtMoney(proj.weightedPack)}</td>
      <td>${fmtMoney(proj.weightedFreight)}</td>
      <td class="value">${fmtMoney(proj.vehicleCost)}</td>
    </tr>
  `;
}

/**
 * renderHarnessLegacy — 旧版回退逻辑 (revenueShare分摍)
 * 当无 harness seed data 时使用
 */

function renderHarnessLegacy(m) {
  let breakdown = null;
  if (window.G281HarnessProfit?.buildHarnessProfitBreakdown) {
    try {
      breakdown = window.G281HarnessProfit.buildHarnessProfitBreakdown(RUNTIME, m);
    } catch (error) {
      console.error('Failed to build harness profit breakdown', error);
    }
  }

  if (Array.isArray(breakdown?.harnesses) && breakdown.harnesses.length) {
    const harnessRows = breakdown.harnesses
      .slice()
      .sort((left, right) => (Number(right.unitCostEstimated) || 0) - (Number(left.unitCostEstimated) || 0));
    const summaryCards = [
      ['线束条目', harnessRows.length + ' 条', '旧版 revenueShare 分摍逻辑'],
      ['整套收入/套', fmtMoney(breakdown.portfolio?.unitRevenue || 0) + ' 元', '整套利润口径'],
      ['整套成本/套', fmtMoney(breakdown.portfolio?.unitCost || 0) + ' 元', '材料 + 工时 + 包装 + 设备 + 研发'],
      ['整套毛利率', fmtPct(breakdown.portfolio?.margin || 0), '单套毛利 ' + fmtMoney(breakdown.portfolio?.unitProfit || 0) + ' 元'],
    ];
    el.harnessProfitSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
      <div class="wire-model-stat">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value)}</div>
        <div class="meta">${typeof meta === 'string' ? escapeHtml(meta) : ''}</div>
      </div>
    `).join('');
    el.harnessProfitNote.textContent = '当前使用旧版 revenueShare 分摍逻辑，未加载单线束号级种子数据。已精算引擎可用时将自动切换。';
    el.harnessProfitTable.innerHTML = harnessRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.harnessId)}</td>
        <td>${escapeHtml(row.harnessName)}</td>
        <td>-</td>
        <td>${fmtMoney(row.unitMaterialCost)}</td>
        <td>-</td>
        <td colspan="2">${fmtMoney((Number(row.unitDirectLaborCost) || 0) + (Number(row.unitManufacturingCost) || 0))}</td>
        <td>-</td>
        <td>-</td>
        <td>${fmtMoney(row.unitCostEstimated)}</td>
        <td>${fmtMoney(row.unitPackagingCost)}</td>
        <td>-</td>
        <td>${fmtMoney(row.unitCostEstimated + (Number(row.unitPackagingCost) || 0))}</td>
      </tr>
    `).join('');
    return;
  }

  // Path 3: No data at all
  el.harnessProfitSummary.innerHTML = '<div class="wire-model-stat"><div class="label">线束条目</div><div class="value">0 条</div><div class="meta">待加载线束级种子数据</div></div>';
  el.harnessProfitNote.textContent = '当前未加载线束级核算数据。请导入线束种子数据或检查 RUNTIME 配置。';
  el.harnessProfitTable.innerHTML = '<tr><td colspan="13" class="wire-empty-cell">当前未加载线束级核算数据。</td></tr>';
}
