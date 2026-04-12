/**
 * dash_kanban.js
 * 看板管理卡片 + KPI/利润驱动
 * Extracted from dashboard.js — do not edit both files simultaneously.
 */


function renderKanbanScenario(m) {
  const mount = document.getElementById('kanbanScenarioBody');
  if (!mount) return;
  const factoryOptions = Object.keys(FACTORY_RATE_TABLE).map((key) => {
    const sel = key === state.factory ? ' selected' : '';
    return `<option value="${escapeHtml(key)}"${sel}>${escapeHtml(FACTORY_RATE_TABLE[key].label)}</option>`;
  }).join('');
  const tags = [
    `BOM ${m.bom.label}`, `铜铝 ${m.metal.label}`, `连接器 ${m.conn.label}`,
    `工时 ${m.labor.label}`, `资源投入 ${m.equip.label}`, `包装 ${m.pack.label}`,
  ].map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
  mount.innerHTML = `
    <div class="kanban-stat-row">
      <span class="kanban-stat-label">工厂</span>
      <select id="kanbanFactorySelect" style="font-size:10px;padding:2px 4px;border-radius:5px;border:1px solid #cbd5e1">${factoryOptions}</select>
      <span class="kanban-stat-sep">·</span>
      <span class="kanban-stat-label">效率</span>
      <span class="kanban-stat-value">${(state.productionEfficiency * 100).toFixed(0)}%</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">${tags}</div>
  `;
  const factorySelect = document.getElementById('kanbanFactorySelect');
  if (factorySelect && !factorySelect.dataset.bound) {
    factorySelect.dataset.bound = 'true';
    factorySelect.addEventListener('change', () => {
      state.factory = factorySelect.value;
      queueRender();
    });
  }
}

// ── 看板：价格管理 ──

function renderKanbanPrice(m) {
  const mount = document.getElementById('kanbanPriceBody');
  if (!mount) return;
  const copperPrice = Number(m?.d?.copperPrice) || 0;
  const aluminumPrice = Number(m?.d?.aluminumPrice) || 0;
  const baseCopperPrice = Number(BASE.copperPrice) || 1;
  const baseAluminumPrice = Number(BASE.aluminumPrice) || 1;
  const copperFactor = (1 + ((copperPrice - baseCopperPrice) / baseCopperPrice) * 0.65).toFixed(4);
  const aluminumFactor = (1 + ((aluminumPrice - baseAluminumPrice) / baseAluminumPrice) * 0.45).toFixed(4);
  const connCost = fmtMoney(m?.connectorSummary?.totalCurrentCost || 0);
  const connOverride = m?.connectorSummary?.overrideCount || 0;
  const packTotal = fmtMoney(Number(m?.packaging) || 0);
  const factoryKey = state.factory || 'K3';
  const factoryRate = FACTORY_RATE_TABLE[factoryKey] || FACTORY_RATE_TABLE['K3'];
  const directHours = Number(m?.d?.directHours) || 0;
  const mfgHours = Number(m?.d?.manufacturingHours) || 0;
  const factoryRows = Object.entries(FACTORY_RATE_TABLE).map(([key, r]) => {
    const active = key === factoryKey ? ' class="is-active"' : '';
    return `<tr${active}><td>${escapeHtml(r.label)}</td><td>${r.directRate.toFixed(2)}</td><td>${r.mfgRate.toFixed(2)}</td></tr>`;
  }).join('');

  mount.innerHTML = `
    <div class="kanban-formula">
      <div class="kanban-formula-label">铜铝基价</div>
      <div class="kanban-formula-expr">材料成本 = 基准材料 × (0.38×铜价系数 + 0.18×铝价系数 + 0.24×连接器系数 + 0.20)
铜价系数 = 1 + (铜价 - ${fmtMoney(baseCopperPrice, 0)}) / ${fmtMoney(baseCopperPrice, 0)} × 0.65 = ${copperFactor}
铝价系数 = 1 + (铝价 - ${fmtMoney(baseAluminumPrice, 0)}) / ${fmtMoney(baseAluminumPrice, 0)} × 0.45 = ${aluminumFactor}</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">铜价</span>
        <span class="kanban-stat-value">${fmtMoney(copperPrice, 0)} 元/吨</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">铝价</span>
        <span class="kanban-stat-value">${fmtMoney(aluminumPrice, 0)} 元/吨</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">材料</span>
        <span class="kanban-stat-value">${fmtMoney(m?.material || 0)} 元/套</span>
      </div>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">连接器价格</div>
      <div class="kanban-formula-expr">连接器成本 = 基准连接器成本 × 执行系数</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">${escapeHtml(m?.conn?.label || '')}</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">覆盖 ${connOverride} 项</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-value">${connCost} 元/套</span>
      </div>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">包装物流</div>
      <div class="kanban-formula-expr">包装成本 = 内外包装 + 运输费 + 仓储费 + 短驳/其他</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">合计</span>
        <span class="kanban-stat-value">${packTotal} 元/套</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">${escapeHtml(m?.pack?.label || '')}</span>
      </div>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">运营工时费率（按工厂分列）</div>
      <div class="kanban-formula-expr">直接人工 = ${directHours.toFixed(4)}h × ${factoryRate.directRate.toFixed(2)}元/h = ${fmtMoney(directHours * factoryRate.directRate)} 元/套
制造费用 = ${mfgHours.toFixed(4)}h × ${factoryRate.mfgRate.toFixed(2)}元/h = ${fmtMoney(mfgHours * factoryRate.mfgRate)} 元/套</div>
      <table class="factory-rate-table">
        <thead><tr><th>工厂</th><th>直接人工(元/h)</th><th>制造费率(元/h)</th></tr></thead>
        <tbody>${factoryRows}</tbody>
      </table>
    </div>
    <div class="kanban-formula">
      <div class="kanban-formula-label">年降 / 返点 / 一次性费用</div>
      <div class="kanban-stat-row">
        <span class="kanban-stat-label">年降</span>
        <span class="kanban-stat-value">${escapeHtml(m?.annualDrop?.label || '-')}</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">返点</span>
        <span class="kanban-stat-value">${escapeHtml(m?.rebate?.label || '-')}</span>
        <span class="kanban-stat-sep">·</span>
        <span class="kanban-stat-label">一次性</span>
        <span class="kanban-stat-value">${escapeHtml(m?.oneTimeCustomer?.label || '-')}</span>
      </div>
    </div>
  `;
}

// ── 看板：数据管理 ──

function renderKanbanData(m) {
  const mount = document.getElementById('kanbanDataBody');
  if (!mount) return;
  const rows = [
    ['BOM版本', m?.bom?.label || versionOptionLabel('bom', state.bom), bomVersionSourceText(state.bom)],
    ['配置清单', versionOptionLabel('configSheet', state.configSheet), configSheetVersionSourceText(state.configSheet)],
    ['工时版本', m?.labor?.label || versionOptionLabel('labor', state.labor), `前工程 ${Number(m?.d?.directHours || 0).toFixed(4)}h × ${Number(m?.d?.directRate || 0).toFixed(1)}元/h · 后工程 ${Number(m?.d?.manufacturingHours || 0).toFixed(4)}h × ${Number(m?.d?.manufacturingRate || 0).toFixed(1)}元/h`],
    ['资源投入', m?.equip?.label || versionOptionLabel('equipment', state.equipment), `设备 ${fmtMoney(m?.capitalBreakdown?.equipment || 0)} · 模具 ${fmtMoney(m?.capitalBreakdown?.tooling || 0)} · 工装 ${fmtMoney(m?.capitalBreakdown?.fixtures || 0)} · 研发 ${fmtMoney(m?.capitalBreakdown?.rnd || 0)}`],
    ['包装物流', m?.pack?.label || versionOptionLabel('packaging', state.packaging), `内外包装 ${fmtMoney(m?.d?.packInner || 0)} · 运输 ${fmtMoney(m?.d?.packFreight || 0)} · 仓储 ${fmtMoney(m?.d?.packWarehouse || 0)} · 短驳 ${fmtMoney(m?.d?.packOther || 0)}`],
  ];
  const rowsHtml = rows.map(([label, val, meta]) => `
    <div class="kanban-stat-row">
      <span class="kanban-stat-label">${escapeHtml(label)}</span>
      <span class="kanban-stat-value">${escapeHtml(val || '-')}</span>
      <span class="kanban-stat-sep">·</span>
      <span class="kanban-stat-label" style="font-size:8px;color:#64748b">${escapeHtml(meta || '')}</span>
    </div>
  `).join('');
  const effVal = (state.productionEfficiency * 100).toFixed(0);
  mount.innerHTML = `
    ${rowsHtml}
    <div class="kanban-stat-row" style="margin-top:4px">
      <span class="kanban-stat-label">生产效率</span>
      <input id="kanbanEfficiencyInput" type="number" min="50" max="100" step="1" value="${effVal}" style="width:50px;font-size:10px;padding:2px 4px;border-radius:5px;border:1px solid #cbd5e1;text-align:center" />
      <span class="kanban-stat-label">%（K3工厂基准效率，影响工时费率折算）</span>
    </div>
  `;
  const effInput = document.getElementById('kanbanEfficiencyInput');
  if (effInput && !effInput.dataset.bound) {
    effInput.dataset.bound = 'true';
    effInput.addEventListener('input', () => {
      const val = Math.max(0.5, Math.min(1, (Number(effInput.value) || 90) / 100));
      state.productionEfficiency = val;
      try { window.localStorage?.setItem('g281.productionEfficiency.v1', String(val)); } catch (e) {}
    });
  }
}

// ── 看板：变更管理 ──

function renderKanbanChange(m) {
  const mount = document.getElementById('kanbanChangeBody');
  if (!mount) return;
  const bomSummary = m?.bomSummary || window.G281Engine?.summarizeBomChanges?.(BOM_CHANGE_ROWS) || {};
  const replaceCount = bomSummary.replaceCount || 0;
  const addCount = bomSummary.addCount || 0;
  const cancelCount = bomSummary.cancelCount || 0;
  const obsoleteValue = Number(bomSummary.obsoleteValue) || 0;
  const equipDelta = Number(bomSummary.equipmentDelta) || 0;
  const laborDelta = Number(bomSummary.laborDelta) || 0;
  const packDelta = Number(bomSummary.packagingDelta) || 0;
  const ca = changeAssessment;
  const devTotal = (Number(ca.dev.dvCost) || 0) + (Number(ca.dev.pvCost) || 0);
  const processTooling = (Number(ca.process.newToolingCost) || 0) + (Number(ca.process.obsoleteToolingCost) || 0);
  const processEquip = (Number(ca.process.newEquipment) || 0) + (Number(ca.process.obsoleteEquipment) || 0);
  const qualityTotal = (Number(ca.quality.newFixtures) || 0) + (Number(ca.quality.obsoleteFixtures) || 0);
  const logisticsTotal = (Number(ca.logistics.obsoleteMaterialFactory) || 0) + (Number(ca.logistics.obsoleteMaterialSupplier) || 0) + (Number(ca.logistics.obsoleteMaterialCustomer) || 0) + (Number(ca.logistics.obsoleteMaterialTransit) || 0) + (Number(ca.logistics.obsoleteWip) || 0) + (Number(ca.logistics.obsoleteFinished) || 0);
  const oneTimeTotal = devTotal + processTooling + processEquip + qualityTotal + logisticsTotal + obsoleteValue;
  const remainVol = Number(ca.remainingVolume) || Number(m?.totalVolume) || 600000;
  const perSetAlloc = remainVol > 0 ? oneTimeTotal / remainVol : 0;
  const materialDelta = (Number(m?.material) || 0) - (Number(BASE.baseMaterial) || 0);

  function caField(path, label, w) {
    const parts = path.split('.');
    const val = parts.reduce((o, k) => o?.[k], ca) || 0;
    return `<label class="field" style="flex:1 1 ${w || '80px'}"><span>${escapeHtml(label)}</span><input type="number" step="1" value="${Number(val) || 0}" data-ca-path="${escapeHtml(path)}" class="ca-input" /></label>`;
  }

  mount.innerHTML = `
    <div class="change-bom-stats">
      <span class="change-bom-stat">替换 <strong>${replaceCount}</strong></span>
      <span class="change-bom-stat">新增 <strong>${addCount}</strong></span>
      <span class="change-bom-stat">取消 <strong>${cancelCount}</strong></span>
      <span class="change-bom-stat">呆滞 <strong>${fmtMoney(obsoleteValue)}</strong> 元</span>
      <span class="change-bom-stat">设备Δ <strong>${fmtSignedMoney(equipDelta)}</strong></span>
      <span class="change-bom-stat">工时Δ <strong>${fmtSignedMoney(laborDelta)}</strong></span>
      <span class="change-bom-stat">包装Δ <strong>${fmtSignedMoney(packDelta)}</strong></span>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">开发</div>
      <div class="change-formula-row">
        <span class="change-formula-eq">试验费 =</span>
        ${caField('dev.dvCost', 'DV试验费', '90px')}
        <span class="change-formula-eq">+</span>
        ${caField('dev.pvCost', 'PV试验费', '90px')}
        <span class="change-formula-eq">=</span>
        <span class="change-formula-total">${fmtMoney(devTotal)} 元</span>
      </div>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">工艺</div>
      <div class="change-formula-row">
        <span class="change-formula-eq">新增工装 =</span>
        ${caField('process.newToolingCost', '新增工装费', '90px')}
        <span class="change-formula-eq">呆滞工装 =</span>
        ${caField('process.obsoleteToolingCost', '呆滞工装费', '90px')}
      </div>
      <div class="change-formula-row">
        <span class="change-formula-eq">新增设备 =</span>
        ${caField('process.newEquipment', '新增公用设备', '90px')}
        <span class="change-formula-eq">呆滞设备 =</span>
        ${caField('process.obsoleteEquipment', '呆滞公用设备', '90px')}
      </div>
      <div class="change-formula-row">
        <span class="change-formula-eq">工时变化 =</span>
        ${caField('process.newLaborHours', '新工时(h)', '70px')}
        <span class="change-formula-eq">× 费率 = ${fmtMoney((Number(ca.process.newLaborHours) || 0) * (Number(m?.d?.directRate) || 35))} 元</span>
      </div>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">质量</div>
      <div class="change-formula-row">
        <span class="change-formula-eq">检具变化 =</span>
        ${caField('quality.newFixtures', '新增检具', '90px')}
        <span class="change-formula-eq">-</span>
        ${caField('quality.obsoleteFixtures', '呆滞检具残值', '90px')}
        <span class="change-formula-eq">=</span>
        <span class="change-formula-total">${fmtMoney(qualityTotal)} 元</span>
      </div>
    </div>

    <div class="change-dept-block">
      <div class="change-dept-title">计划物流</div>
      <div class="change-formula-row">
        ${caField('logistics.obsoleteMaterialFactory', '厂内呆滞', '70px')}
        ${caField('logistics.obsoleteMaterialSupplier', '供应商处', '70px')}
        ${caField('logistics.obsoleteMaterialCustomer', '客户处', '70px')}
        ${caField('logistics.obsoleteMaterialTransit', '在途', '70px')}
      </div>
      <div class="change-formula-row">
        ${caField('logistics.obsoleteWip', '呆滞半成品', '90px')}
        ${caField('logistics.obsoleteFinished', '呆滞成品', '90px')}
        <span class="change-formula-eq">= 合计</span>
        <span class="change-formula-total">${fmtMoney(logisticsTotal)} 元</span>
      </div>
    </div>

    <div class="change-quote-result">
      <div class="change-quote-title">变更报价计算</div>
      <div class="change-quote-row">
        <span class="change-quote-eq">线束售价变化（单套Δ）= 材料Δ ${fmtSignedMoney(materialDelta)} + 工时Δ ${fmtSignedMoney(laborDelta)} =</span>
        <span class="change-quote-value">${fmtSignedMoney(materialDelta + laborDelta)} 元/套</span>
      </div>
      <div class="change-quote-row">
        <span class="change-quote-eq">一次性费用合计 =</span>
        <span class="change-quote-value">${fmtMoney(oneTimeTotal)} 元</span>
      </div>
      <div class="change-quote-row">
        <span class="change-quote-eq">单套分摊 = ${fmtMoney(oneTimeTotal)} /</span>
        <label class="field" style="flex:0 0 90px;margin:0"><span>剩余销量</span><input type="number" step="1000" value="${remainVol}" data-ca-path="remainingVolume" class="ca-input" style="font-size:10px;padding:2px 4px;height:20px" /></label>
        <span class="change-quote-eq">=</span>
        <span class="change-quote-value">${fmtMoney(perSetAlloc)} 元/套</span>
      </div>
    </div>
  `;

  // 绑定所有 ca-input 事件
  if (!mount.dataset.caBound) {
    mount.dataset.caBound = 'true';
    mount.addEventListener('input', (event) => {
      const input = event.target.closest('.ca-input');
      if (!input) return;
      const path = input.dataset.caPath;
      if (!path) return;
      const parts = path.split('.');
      let target = changeAssessment;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = Number(input.value) || 0;
      saveChangeAssessment(changeAssessment);
      // 重新渲染变更模块以更新计算结果
      renderKanbanChange(window._g281LastModel || m);
    });
  }
}

// ── 看板总调度 ──

function renderDataManagementOverview(m) {
  syncManagementButtonLabels();
  renderKanbanScenario(m);
  renderKanbanPrice(m);
  renderKanbanData(m);
  renderKanbanChange(m);
}

function renderTags(m){
  const tags = [
    `BOM ${m.bom.label}`,
    `铜铝 ${m.metal.label}`,
    `连接器 ${m.conn.label}`,
    `工时 ${m.labor.label}`,
    `资源投入 ${m.equip.label}`,
    `包装 ${m.pack.label}`,
    `年降 ${m.annualDrop?.label || ''}`.trim(),
    `一次性费用 ${m.oneTimeCustomer?.label || ''}`.trim(),
    `返点 ${m.rebate?.label || ''}`.trim(),
    `VAVE ${m.vave.label}`,
  ].filter((item) => !/\s$/.test(item));
  if (m.connectorSummary?.overrideCount) {
    tags.splice(3, 0, `连接器覆盖 ${m.connectorSummary.overrideCount} 项`);
  }
  el.scenarioTags.innerHTML = tags.map(t=>`<span class="chip">${t}</span>`).join('');
}

function renderSummary(m){el.activeSummary.innerHTML=[['混合售价系数',m.mixPrice.toFixed(4)+'x'],['混合成本系数',m.mixCost.toFixed(4)+'x'],['资本投入池',fmtMoney(m.capitalTotal)+' 元'],['静态回收销量',fmtInt(m.paybackVolume)+' 套']].map(x=>`<div class="summary-line"><span>${x[0]}</span><span>${x[1]}</span></div>`).join('')}

function renderKPIs(m){
  const cards=[['生命周期收入',fmtMoney(m.totalRevenue),`按 ${fmtInt(m.totalVolume)} 套计算`,'kpi info'],['生命周期成本',fmtMoney(m.totalCost),`单套成本 ${fmtMoney(m.operating)} 元`,'kpi warn'],['生命周期利润',fmtMoney(m.totalProfit),`单套利润 ${fmtMoney(m.avgProfit)} 元`,m.totalProfit>=0?'kpi good accent':'kpi bad accent'],['毛利率',fmtPct(m.margin),`混合售价系数 ${m.mixPrice.toFixed(4)}x`,'kpi good'],['静态回收期',Number.isFinite(m.paybackYears)?`${m.paybackYears.toFixed(2)} 年`:'∞',`资本投入 ${fmtMoney(m.capitalTotal)} 元`,'kpi info']];
  el.kpiGrid.innerHTML=cards.map(c=>`<article class="${c[3]}"><div class="title">${c[0]}</div><div class="num">${c[1]}</div><div class="sub">${c[2]}</div></article>`).join('');
}

function costDeltaTone(delta) {
  if (Math.abs(Number(delta) || 0) < 0.005) return 'info';
  return Number(delta) > 0 ? 'bad' : 'good';
}

function renderProfitDrivers(m) {
  if (!el.profitDriverGrid) return;
  const baseMaterial = Number(BASE.baseMaterial) || 0;
  const baseLabor = (Number(BASE.baseDirectHours) || 0) * (Number(BASE.baseDirectRate) || 0) + (Number(BASE.baseMfgHours) || 0) * (Number(BASE.baseMfgRate) || 0);
  const basePackaging = Number(BASE.basePackagingPerSet) || 0;
  const baseConnector = Number(BASE.connectorPortfolio?.baseCostPerSet) || baseMaterial * 0.24;
  const laborCost = (Number(m.directLabor) || 0) + (Number(m.manufacturing) || 0);
  const connectorCost = Number(m.connectorSummary?.totalCurrentCost) || 0;
  const connectorDelta = Number(m.connectorSummary?.deltaCost);
  const resolvedConnectorDelta = Number.isFinite(connectorDelta) ? connectorDelta : (connectorCost - baseConnector);
  const mixSpread = Number(m.mixPrice) - Number(m.mixCost);
  const lifecycleVave = (Number(m.vave?.savings) || 0) * (Number(m.totalVolume) || 0);
  const drivers = [
    {
      title: '材料 / BOM',
      value: `${fmtMoney(m.material)} 元/套`,
      meta: `${m.bom.label} / ${m.metal.label} · 对基准 ${fmtSignedMoney((Number(m.material) || 0) - baseMaterial)} 元/套`,
      tone: costDeltaTone((Number(m.material) || 0) - baseMaterial),
    },
    {
      title: '连接器执行',
      value: `${fmtMoney(connectorCost)} 元/套`,
      meta: `${m.conn.label} · ${fmtSignedMoney(resolvedConnectorDelta)} 元/套 · 覆盖 ${m.connectorSummary?.overrideCount || 0} 项`,
      tone: costDeltaTone(resolvedConnectorDelta),
    },
    {
      title: '工时',
      value: `${fmtMoney(laborCost)} 元/套`,
      meta: `${m.labor.label} · 对报价 ${fmtSignedMoney(laborCost - baseLabor)} 元/套`,
      tone: costDeltaTone(laborCost - baseLabor),
    },
    {
      title: '包装物流',
      value: `${fmtMoney(m.packaging)} 元/套`,
      meta: `${m.pack.label} · 对报价 ${fmtSignedMoney((Number(m.packaging) || 0) - basePackaging)} 元/套`,
      tone: costDeltaTone((Number(m.packaging) || 0) - basePackaging),
    },
    {
      title: '设备摊销',
      value: `${fmtMoney(m.equipment)} 元/套`,
      meta: `${m.equip.label} · 资本池 ${fmtMoney(m.capitalTotal)} 元 · ${fmtMoney(m.capitalPerSet)} 元/套`,
      tone: 'info',
    },
    {
      title: '销量预测',
      value: `${fmtInt(m.totalVolume)} 套`,
      meta: `${m.sales.label} · 生命周期销量`,
      tone: 'info',
    },
    {
      title: '配置比例',
      value: `${m.mixPrice.toFixed(4)}x`,
      meta: `${m.mix.label} · 成本系数 ${m.mixCost.toFixed(4)}x`,
      tone: mixSpread >= 0 ? 'good' : 'bad',
    },
    {
      title: 'VAVE',
      value: `${fmtMoney(m.vave.savings)} 元/套`,
      meta: `${m.vave.label} · 生命周期改善 ${fmtMoney(lifecycleVave)} 元`,
      tone: Number(m.vave.savings) > 0 ? 'good' : 'info',
    },
  ];
  el.profitDriverGrid.innerHTML = drivers.map((item) => `
    <article class="driver-card driver-${item.tone}">
      <div class="driver-title">${escapeHtml(item.title)}</div>
      <div class="driver-value">${escapeHtml(item.value)}</div>
      <div class="driver-meta">${escapeHtml(item.meta)}</div>
    </article>
  `).join('');
}
