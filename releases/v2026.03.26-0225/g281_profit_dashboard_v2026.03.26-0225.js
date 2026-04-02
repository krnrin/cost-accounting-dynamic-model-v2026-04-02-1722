const RUNTIME = window.G281_RUNTIME || {};
if (!RUNTIME.master || !window.G281Engine || !window.G281Repo) {
  throw new Error('G281 runtime bundle not loaded');
}
const BASE = RUNTIME.master;
const BOM_CHANGE_ROWS = RUNTIME.bomChanges || [];
const PROTOCOL_STATUS = RUNTIME.connectorProtocolStatus || {};
const repo = window.G281Repo.init(RUNTIME);
let lastSavedVersionId = '';
const DEFAULT_STATE = { bom: 'freeze', connector: 'batch', labor: 'base', equipment: 'base', packaging: 'base', vave: 'none' };

const state = { scenarioName: BASE.name, ...DEFAULT_STATE };
let connectorPricingState = {};
const $ = (id) => document.getElementById(id);
const el = {
  scenarioName: $('scenarioName'),
  generateBtn: $('generateBtn'),
  resetBtn: $('resetBtn'),
  printBtn: $('printBtn'),
  saveVersionBtn: $('saveVersionBtn'),
  submitApprovalBtn: $('submitApprovalBtn'),
  exportLayerBtn: $('exportLayerBtn'),
  kpiGrid: $('kpiGrid'),
  costBridge: $('costBridge'),
  annualChart: $('annualChart'),
  compareTable: document.querySelector('#compareTable tbody'),
  annualTable: document.querySelector('#annualTable tbody'),
  eventTable: document.querySelector('#eventTable tbody'),
  capitalLedger: $('capitalLedger'),
  activeSummary: $('activeSummary'),
  scenarioTags: $('scenarioTags'),
  configBars: $('configBars'),
  typeBars: $('typeBars'),
  wireCalc: $('wireCalc'),
  tapeCalc: $('tapeCalc'),
  bomStats: $('bomStats'),
  bomResourceGrid: $('bomResourceGrid'),
  bomChangeTable: document.querySelector('#bomChangeTable tbody'),
  connectorProtocolStats: $('connectorProtocolStats'),
  connectorProtocolHint: $('connectorProtocolHint'),
  connectorExecutionStats: $('connectorExecutionStats'),
  connectorPriceTable: document.querySelector('#connectorPriceTable tbody'),
  initConnectorProtocolBtn: $('initConnectorProtocolBtn'),
  clearConnectorOverridesBtn: $('clearConnectorOverridesBtn'),
  historyTable: document.querySelector('#historyTable tbody'),
  approvalTable: document.querySelector('#approvalTable tbody'),
  layerDataCount: $('layerDataCount'),
  layerDataMeta: $('layerDataMeta'),
  layerEngineMeta: $('layerEngineMeta'),
  layerHistoryCount: $('layerHistoryCount'),
  layerHistoryMeta: $('layerHistoryMeta'),
  layerApprovalCount: $('layerApprovalCount'),
  layerApprovalMeta: $('layerApprovalMeta'),
  sheets: $('sheetCount'),
  faults: $('faultCount'),
  priceTypes: $('priceTypeCount'),
};
const controls = {
  copperPrice: $('copperPrice'),
  aluminumPrice: $('aluminumPrice'),
  directHours: $('directHours'),
  directRate: $('directRate'),
  manufacturingHours: $('manufacturingHours'),
  manufacturingRate: $('manufacturingRate'),
  packInner: $('packInner'),
  packFreight: $('packFreight'),
  packWarehouse: $('packWarehouse'),
  packOther: $('packOther'),
  bomWireDrawing: $('bomWireDrawing'),
  bomWireEat: $('bomWireEat'),
  bomWireHidden: $('bomWireHidden'),
  bomTapeDiameter: $('bomTapeDiameter'),
  bomTapeWidth: $('bomTapeWidth'),
  bomTapeOverlap: $('bomTapeOverlap'),
};
const yearInputs = BASE.years.map((year) => $(`vol${year}`));
const mixInputs = ['mix0', 'mix1', 'mix2', 'mix3'].map($);

const fmtMoney = (v, d = 2) => Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (v) => Math.round(Number(v || 0)).toLocaleString('zh-CN');
const fmtPct = (v, d = 2) => `${(Number(v || 0) * 100).toFixed(d)}%`;
const fmtSigned = (v, d = 2) => `${Number(v || 0) >= 0 ? '+' : ''}${Math.abs(Number(v || 0)).toFixed(d)}`;
const fmtSignedMoney = (v) => `${Number(v || 0) >= 0 ? '+' : ''}${fmtMoney(Math.abs(Number(v || 0)))}`;
const fmtMaybeInt = (v) => { const n = Number(v); return Number.isNaN(n) ? '—' : Number.isFinite(n) ? fmtInt(n) : '∞'; };
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const normalizeMix = (vals) => window.G281Engine.normalizeMix(vals);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));
const connectorItems = Array.isArray(BASE.connectorPortfolio?.items) ? BASE.connectorPortfolio.items : [];
const connectorVersionKeys = Object.keys(BASE.versions.connector || {});
const connectorVersionSet = new Set(connectorVersionKeys);
const connectorItemIdSet = new Set(connectorItems.map((item) => item.id));
const protocolPortfolios = Array.isArray(PROTOCOL_STATUS.portfolios) ? PROTOCOL_STATUS.portfolios : [];
const protocolRows = Array.isArray(PROTOCOL_STATUS.rows) ? PROTOCOL_STATUS.rows : [];
const protocolPortfolioMap = new Map(protocolPortfolios.map((item) => [item.portfolioId, item]));
const protocolRowsByPortfolio = protocolRows.reduce((acc, row) => {
  if (!row || !row.portfolioId) return acc;
  if (!acc[row.portfolioId]) acc[row.portfolioId] = [];
  acc[row.portfolioId].push(row);
  return acc;
}, {});
const protocolStatusConfig = {
  confirmed: { label: '已达成', className: 'confirmed' },
  quoted_pending: { label: '待确认', className: 'quoted' },
  no_reply: { label: '暂无回复', className: 'blank' },
  dev_pending: { label: '开发中', className: 'dev' },
};

function sanitizeConnectorPricing(raw = {}, defaultKey = '') {
  return Object.entries(raw || {}).reduce((acc, [itemId, versionKey]) => {
    if (connectorItemIdSet.has(itemId) && connectorVersionSet.has(versionKey) && versionKey !== defaultKey) {
      acc[itemId] = versionKey;
    }
    return acc;
  }, {});
}

function connectorOverrideCount(pricing = {}, defaultKey = state.connector) {
  return Object.keys(sanitizeConnectorPricing(pricing, defaultKey)).length;
}

function connectorStageClass(stageKey) {
  return stageKey === 'protocol' ? 'protocol' : stageKey === 'sample' ? 'sample' : 'batch';
}

function protocolSummaryForItem(itemId) {
  return protocolPortfolioMap.get(itemId) || null;
}

function protocolCount(summary, key) {
  return Number(summary?.statusCounts?.[key]) || 0;
}

function protocolCountPills(summary) {
  return Object.entries(protocolStatusConfig)
    .map(([key, config]) => {
      const count = protocolCount(summary, key);
      if (!count) return '';
      return `<span class="protocol-count-pill ${config.className}">${config.label} ${count}</span>`;
    })
    .filter(Boolean)
    .join('');
}

function protocolCountsInline(summary) {
  return Object.entries(protocolStatusConfig)
    .map(([key, config]) => {
      const count = protocolCount(summary, key);
      return count ? `${config.label} ${count}` : '';
    })
    .filter(Boolean)
    .join(' / ');
}

function protocolRolledUpLabel(summary) {
  if (!summary) return '';
  const sourceCount = Number(summary.sourceCount) || 0;
  const confirmed = protocolCount(summary, 'confirmed');
  const quotedPending = protocolCount(summary, 'quoted_pending');
  const noReply = protocolCount(summary, 'no_reply');
  const devPending = protocolCount(summary, 'dev_pending');
  if (sourceCount && confirmed === sourceCount) return '已达成';
  if (devPending && !quotedPending && !noReply && !confirmed) return '开发中';
  if (quotedPending && !noReply && !devPending && !confirmed) return '待确认';
  if (noReply && !quotedPending && !devPending && !confirmed) return '暂无回复';
  return '部分达成';
}

function protocolReason(summary) {
  if (!summary) return '';
  if (summary.recommendedStage === 'protocol') {
    return '当前映射项已全部达成，可直接按协议价执行。';
  }
  if (protocolCount(summary, 'dev_pending')) {
    return '仍有开发中项，初始化先按样品价。';
  }
  if (protocolCount(summary, 'quoted_pending')) {
    return '仍有待确认项，初始化先按样品价。';
  }
  if (protocolCount(summary, 'no_reply')) {
    return '仍有暂无回复项，初始化先按样品价。';
  }
  return '按当前默认档位执行。';
}

function protocolTooltip(summary) {
  const rows = protocolRowsByPortfolio[summary?.portfolioId] || [];
  return rows.map((row) => `${row.sequence} ${row.groupLabel} | ${row.partNumber} | ${row.statusLabel}`).join('\n');
}

function applyConnectorProtocolInitialization() {
  connectorPricingState = protocolPortfolios.reduce((acc, summary) => {
    const itemId = summary?.portfolioId;
    const stageKey = summary?.recommendedStage;
    if (!connectorItemIdSet.has(itemId) || !connectorVersionSet.has(stageKey) || stageKey === state.connector) {
      return acc;
    }
    acc[itemId] = stageKey;
    return acc;
  }, {});
  renderVersions();
  queueRender();
}

function renderConnectorProtocolOverview() {
  if (!el.connectorProtocolStats || !el.connectorProtocolHint) return;
  const summary = PROTOCOL_STATUS.summary || {};
  const recommendationCounts = summary.portfolioRecommendationCounts || {};
  const stats = [
    `协议范围 <strong>${summary.totalRows || 0}</strong> 项`,
    `已达成 <strong>${summary.confirmed || 0}</strong>`,
    `待确认 <strong>${summary.quotedPending || 0}</strong>`,
    `暂无回复 <strong>${summary.noReply || 0}</strong>`,
    `开发中 <strong>${summary.devPending || 0}</strong>`,
    `聚合建议协议价 <strong>${recommendationCounts.protocol || 0}</strong>`,
    `聚合建议样品价 <strong>${recommendationCounts.sample || 0}</strong>`,
  ];
  el.connectorProtocolStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');
  const note = '初始化规则：同一聚合连接器下全部映射项已达成时切协议价；只要仍有待确认、暂无回复或开发中，就先按样品价，后续仍可逐项人工改写。';
  el.connectorProtocolHint.textContent = note;
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.disabled = !protocolPortfolios.length;
  }
}

function readDraft() {
  connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
  return { scenarioName: el.scenarioName.value.trim() || BASE.name, copperPrice: Number(controls.copperPrice.value) || 0, aluminumPrice: Number(controls.aluminumPrice.value) || 0, directHours: Number(controls.directHours.value) || 0, directRate: Number(controls.directRate.value) || 0, manufacturingHours: Number(controls.manufacturingHours.value) || 0, manufacturingRate: Number(controls.manufacturingRate.value) || 0, packInner: Number(controls.packInner.value) || 0, packFreight: Number(controls.packFreight.value) || 0, packWarehouse: Number(controls.packWarehouse.value) || 0, packOther: Number(controls.packOther.value) || 0, bomWireDrawing: Number(controls.bomWireDrawing.value) || 0, bomWireEat: Number(controls.bomWireEat.value) || 0, bomWireHidden: Number(controls.bomWireHidden.value) || 0, bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0, bomTapeWidth: Number(controls.bomTapeWidth.value) || 0, bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0, connectorPricing: { ...connectorPricingState }, mix: normalizeMix(mixInputs.map((input) => input.value)), volumes: yearInputs.map((input) => Math.max(0, Number(input.value) || 0)), asp: BASE.asp.slice() };
}

function calcModel() {
  return window.G281Engine.computeModel(RUNTIME, readDraft(), state);
}

function applyStateSnapshot(snapshot = {}) {
  Object.keys(DEFAULT_STATE).forEach((group) => {
    const nextValue = snapshot[group];
    state[group] = BASE.versions[group][nextValue] ? nextValue : DEFAULT_STATE[group];
  });
}

function applyDraft(draft = {}, fallbackScenarioName = '') {
  const nextDraft = {
    scenarioName: fallbackScenarioName || draft.scenarioName || BASE.name,
    copperPrice: draft.copperPrice ?? BASE.copperPrice,
    aluminumPrice: draft.aluminumPrice ?? BASE.aluminumPrice,
    directHours: draft.directHours ?? BASE.baseDirectHours,
    directRate: draft.directRate ?? BASE.baseDirectRate,
    manufacturingHours: draft.manufacturingHours ?? BASE.baseMfgHours,
    manufacturingRate: draft.manufacturingRate ?? BASE.baseMfgRate,
    packInner: draft.packInner ?? 3.2,
    packFreight: draft.packFreight ?? 4.1,
    packWarehouse: draft.packWarehouse ?? 2.95,
    packOther: draft.packOther ?? 2.3943008441667,
    bomWireDrawing: draft.bomWireDrawing ?? BASE.bomDefaults.wireDrawing,
    bomWireEat: draft.bomWireEat ?? BASE.bomDefaults.wireEat,
    bomWireHidden: draft.bomWireHidden ?? BASE.bomDefaults.wireHidden,
    bomTapeDiameter: draft.bomTapeDiameter ?? BASE.bomDefaults.tapeDiameter,
    bomTapeWidth: draft.bomTapeWidth ?? BASE.bomDefaults.tapeWidth,
    bomTapeOverlap: draft.bomTapeOverlap ?? BASE.bomDefaults.tapeOverlap,
    mix: Array.isArray(draft.mix) && draft.mix.length ? normalizeMix(draft.mix) : BASE.baselineMix.slice(),
    volumes: Array.isArray(draft.volumes) && draft.volumes.length ? draft.volumes.map((value) => Math.max(0, Number(value) || 0)) : BASE.volumes.slice(),
  };
  connectorPricingState = sanitizeConnectorPricing(draft.connectorPricing || {}, state.connector);

  state.scenarioName = nextDraft.scenarioName;
  el.scenarioName.value = nextDraft.scenarioName;
  controls.copperPrice.value = nextDraft.copperPrice;
  controls.aluminumPrice.value = nextDraft.aluminumPrice;
  controls.directHours.value = nextDraft.directHours;
  controls.directRate.value = nextDraft.directRate;
  controls.manufacturingHours.value = nextDraft.manufacturingHours;
  controls.manufacturingRate.value = nextDraft.manufacturingRate;
  controls.packInner.value = nextDraft.packInner;
  controls.packFreight.value = nextDraft.packFreight;
  controls.packWarehouse.value = nextDraft.packWarehouse;
  controls.packOther.value = nextDraft.packOther;
  controls.bomWireDrawing.value = nextDraft.bomWireDrawing;
  controls.bomWireEat.value = nextDraft.bomWireEat;
  controls.bomWireHidden.value = nextDraft.bomWireHidden;
  controls.bomTapeDiameter.value = nextDraft.bomTapeDiameter;
  controls.bomTapeWidth.value = nextDraft.bomTapeWidth;
  controls.bomTapeOverlap.value = nextDraft.bomTapeOverlap;
  yearInputs.forEach((input, index) => { input.value = nextDraft.volumes[index] ?? BASE.volumes[index]; });
  mixInputs.forEach((input, index) => { input.value = nextDraft.mix[index] ?? BASE.baselineMix[index]; });
}

function historyPreview(record) {
  if (record.summary && Number.isFinite(Number(record.summary.profit))) {
    const paybackYears = record.summary.paybackYears === null || record.summary.paybackYears === '' ? Infinity : Number(record.summary.paybackYears);
    return {
      totalProfit: Number(record.summary.profit) || 0,
      paybackYears,
    };
  }
  return window.G281Engine.computeModel(RUNTIME, record.draft || readDraft(), record.state || state);
}

function loadHistoryRecord(historyId) {
  const record = repo.getHistory().find((item) => item.id === historyId);
  if (!record) return;
  applyStateSnapshot(record.state || {});
  applyDraft(record.draft || {}, record.scenarioName || record.name || BASE.name);
  lastSavedVersionId = record.id;
  renderVersions();
  render(calcModel());
}

function markDirty(){el.generateBtn.textContent='生成场景 · 待更新'}
function clearDirty(){el.generateBtn.textContent='生成场景'}

function renderTags(m){
  const tags = [`BOM ${m.bom.label}`,`连接器默认 ${m.conn.label}`,`工时 ${m.labor.label}`,`设备 ${m.equip.label}`,`包装 ${m.pack.label}`,`VAVE ${m.vave.label}`];
  if (m.connectorSummary?.overrideCount) {
    tags.splice(2, 0, `连接器覆盖 ${m.connectorSummary.overrideCount} 项`);
  }
  el.scenarioTags.innerHTML = tags.map(t=>`<span class="chip">${t}</span>`).join('');
}
function renderSummary(m){el.activeSummary.innerHTML=[['混合售价系数',m.mixPrice.toFixed(4)+'x'],['混合成本系数',m.mixCost.toFixed(4)+'x'],['资本投入池',fmtMoney(m.capitalTotal)+' 元'],['静态回收销量',fmtInt(m.paybackVolume)+' 套']].map(x=>`<div class="summary-line"><span>${x[0]}</span><span>${x[1]}</span></div>`).join('')}
function renderKPIs(m){
  const cards=[['生命周期收入',fmtMoney(m.totalRevenue),`按 ${fmtInt(m.totalVolume)} 套计算`,'kpi info'],['生命周期成本',fmtMoney(m.totalCost),`单套成本 ${fmtMoney(m.operating)} 元`,'kpi warn'],['生命周期利润',fmtMoney(m.totalProfit),`单套利润 ${fmtMoney(m.avgProfit)} 元`,m.totalProfit>=0?'kpi good accent':'kpi bad accent'],['毛利率',fmtPct(m.margin),`混合售价系数 ${m.mixPrice.toFixed(4)}x`,'kpi good'],['静态回收期',Number.isFinite(m.paybackYears)?`${m.paybackYears.toFixed(2)} 年`:'∞',`资本投入 ${fmtMoney(m.capitalTotal)} 元`,'kpi info']];
  el.kpiGrid.innerHTML=cards.map(c=>`<article class="${c[3]}"><div class="title">${c[0]}</div><div class="num">${c[1]}</div><div class="sub">${c[2]}</div></article>`).join('');
}

function renderCostBridge(m){
  const avgAsp=m.annual.reduce((s,r)=>s+r.asp,0)/m.annual.length; const rows=[['单套收入',avgAsp,1,'revenue'],['材料',m.material,m.material/avgAsp,'cost'],['工时',m.directLabor+m.manufacturing,(m.directLabor+m.manufacturing)/avgAsp,'cost'],['包装物流',m.packaging,m.packaging/avgAsp,'cost'],['设备',m.equipment,m.equipment/avgAsp,'cost'],['研发',m.rnd,m.rnd/avgAsp,'cost'],['VAVE',-m.vave.savings,m.vave.savings/avgAsp,'profit'],['单套利润',m.avgProfit,m.avgProfit/avgAsp,'profit']];
  const max=Math.max(...rows.map(r=>Math.abs(r[1])),1);
  el.costBridge.innerHTML=rows.map(r=>`<div class="bridge-row ${r[3]}"><div class="label">${r[0]}</div><div class="bridge-bar"><span style="width:${clamp(Math.abs(r[1])/max*100,2,100)}%"></span></div><div class="value ${r[1]>=0?'positive':'negative'}">${r[1]>=0?'':'-'}${fmtMoney(Math.abs(r[1]))}</div><div class="share">${fmtPct(r[2])}</div></div>`).join('');
}

function svgText(x,y,text,opts={}){return `<text x="${x}" y="${y}" fill="${opts.fill||'#dbe5fb'}" text-anchor="${opts.anchor||'middle'}" font-size="${opts.size||12}" font-weight="${opts.weight||500}" font-family="var(--body)">${text}</text>`}

function renderAnnualChart(m){
  const W=1040,H=340,p={t:26,r:26,b:44,l:56},cw=W-p.l-p.r,ch=H-p.t-p.b,max=Math.max(...m.annual.map(d=>Math.max(d.revenue,d.cost,Math.abs(d.profit))),1),gw=cw/m.annual.length,bw=Math.min(18,gw*.18),gap=Math.max(8,gw*.08),base=p.t+ch,scale=ch/max;
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label="年度收益图"><defs><linearGradient id="revGrad" x1="0%" x2="0%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ffb463"/><stop offset="100%" stop-color="#ff7f32"/></linearGradient><linearGradient id="costGrad" x1="0%" x2="0%" y1="0%" y2="100%"><stop offset="0%" stop-color="#77a7ff"/><stop offset="100%" stop-color="#4f6ef5"/></linearGradient><linearGradient id="profitGrad" x1="0%" x2="0%" y1="0%" y2="100%"><stop offset="0%" stop-color="#69e49b"/><stop offset="100%" stop-color="#23c55e"/></linearGradient></defs>`;
  for(let i=0;i<5;i++){const y=p.t+(ch/4)*i;svg+=`<line x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`}
  m.annual.forEach((row,i)=>{const gx=p.l+i*gw+gw*.16,revH=row.revenue*scale,costH=row.cost*scale,profH=Math.abs(row.profit)*scale,rx=gx,cx=gx+bw+gap,px=gx+(bw+gap)*2;svg+=`<rect x="${rx}" y="${base-revH}" width="${bw}" height="${revH}" rx="9" fill="url(#revGrad)"/><rect x="${cx}" y="${base-costH}" width="${bw}" height="${costH}" rx="9" fill="url(#costGrad)"/><rect x="${px}" y="${base-profH}" width="${bw}" height="${profH}" rx="9" fill="url(#profitGrad)"/>`;svg+=svgText(rx+bw/2,base-revH-8,fmtMoney(row.revenue,0),{size:10,fill:'#ffd9b3'});svg+=svgText(cx+bw/2,base-costH-8,fmtMoney(row.cost,0),{size:10,fill:'#c2d8ff'});svg+=svgText(px+bw/2,base-profH-8,fmtMoney(row.profit,0),{size:10,fill:'#b6f2cf'});svg+=svgText(gx+(bw+gap),H-16,row.year,{size:11,fill:'#c6d3e7'})});
  svg+=svgText(p.l-20,p.t+6,'元',{anchor:'end',size:11,fill:'#94a3b8'})+svgText(p.l-20,base-2,'0',{anchor:'end',size:11,fill:'#94a3b8'})+`</svg>`; el.annualChart.innerHTML=svg;
}

function renderConfigBars(m){
  const rows=m.currentMix.map((share,i)=>({name:BASE.configNames[i],share,rev:m.totalRevenue*(share/100)*BASE.priceMixIndexes[i]/m.mixPrice,cost:m.totalCost*(share/100)*BASE.costMixIndexes[i]/m.mixCost,profit:0}));
  const maxRev=Math.max(...rows.map(r=>r.rev),1); el.configBars.innerHTML=rows.map(r=>`<div class="price-row-visual"><div class="label">${r.name}</div><div class="bar"><span style="width:${clamp(r.rev/maxRev*100,2,100)}%"></span></div><div class="count">${fmtPct(r.share/100)} / ${fmtMoney(r.rev-r.cost)}</div></div>`).join('');
  const maxType=Math.max(...BASE.priceTypeCounts.map(d=>d.count),1); el.typeBars.innerHTML=BASE.priceTypeCounts.map(r=>`<div class="price-row-visual"><div class="label">${r.name}</div><div class="bar"><span style="width:${clamp(r.count/maxType*100,2,100)}%"></span></div><div class="count">${r.count}</div></div>`).join('');
}

function renderBomAnalysis(m){
  const wireCards=[
    ['结算线长',`${m.bomCalc.wireQuoteM.toFixed(2)} m`,`图纸 ${fmtInt(m.d.bomWireDrawing)} + 吃线 ${fmtInt(m.d.bomWireEat)} + 余量 ${fmtInt(m.d.bomWireHidden)} mm`,'accent'],
    ['隐藏余量占比',fmtPct(m.bomCalc.wireHiddenRate),'隐藏利润余量 / 结算线长',''],
    ['线长折算',`${fmtMaybeInt(m.bomCalc.wireQuoteMm)} mm`,'用于裁线、出料与报价联动','blue'],
    ['工程结论','可直接下发','BOM 线长已经纳入场景引擎','green']
  ];
  el.wireCalc.innerHTML=wireCards.map(([label,value,meta,cls])=>`<div class="calc-chip ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></div>`).join('');

  const tapeCards=[
    ['每米胶带用量',`${m.bomCalc.tapePerMm.toFixed(2)} m/m`,`受 ${m.d.bomTapeDiameter} mm 线径与 ${fmtPct(m.bomCalc.tapeOverlap)} 重叠率影响`,'blue'],
    ['单件胶带用量',`${m.bomCalc.tapeLengthM.toFixed(2)} m`,`${fmtMaybeInt(m.bomCalc.tapeLengthMm)} mm / 单件`,'accent'],
    ['缠绕圈数',`${m.bomCalc.tapeTurns.toFixed(1)} 圈`,`节距 ${m.bomCalc.tapePitch.toFixed(1)} mm`,'green'],
    ['重叠率',fmtPct(m.bomCalc.tapeOverlap),'越高则单位用量越大','']
  ];
  el.tapeCalc.innerHTML=tapeCards.map(([label,value,meta,cls])=>`<div class="calc-chip ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></div>`).join('');

  const summary=m.bomSummary;
  const statRows=[
    ['替换',summary.replaceCount],
    ['新增',summary.addCount],
    ['取消',summary.cancelCount],
    ['影响配置',summary.configCount],
    ['呆滞库存',`${fmtInt(summary.obsoleteQty)} 套`],
    ['呆滞金额',`${fmtMoney(summary.obsoleteValue)} 元`]
  ];
  el.bomStats.innerHTML=statRows.map(([label,value])=>`<span class="stat-pill">${label} <strong>${value}</strong></span>`).join('');

  const impactRows=[
    ['设备资源',`${fmtSigned(summary.equipmentDelta,2)} h/套`,`裁线 / 压接 / 缠绕 / 测试联动`],
    ['工时',`${fmtSigned(summary.laborDelta,2)} h/套`,`节拍与返修动作变化`],
    ['包装',`${fmtSignedMoney(summary.packagingDelta)} / 套`,`内衬 / 箱规 / 贴标变化`],
    ['呆滞',`${fmtInt(summary.obsoleteQty)} 套`,`${fmtMoney(summary.obsoleteValue)} 元 · 处置`],
    ['配置',`${summary.configCount} 项`,summary.configList.join(' / ')]
  ];
  el.bomResourceGrid.innerHTML=impactRows.map(([label,value,meta])=>`<div class="metric-card"><div class="name">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></div>`).join('');

  el.bomChangeTable.innerHTML=BOM_CHANGE_ROWS.map(row=>{
    const actionClass=row.action==='替换'?'replace':row.action==='新增'?'add':'cancel';
    const relation=row.action==='取消' ? `<div class="relation"><span class="subtle">取消：</span>${row.from}</div>` : `<div class="relation"><span class="subtle">${row.from}</span> → <span class="relation">${row.to}</span></div>`;
    return `<tr><td><span class="action-pill ${actionClass}">${row.action}</span></td><td>${row.part}</td><td>${relation}</td><td><div>${row.resource}</div><div class="subtle">${fmtSigned(row.equipmentDelta,2)} h/套</div></td><td><div>${row.stock}</div><div class="subtle">${fmtMoney(row.obsoleteValue)} 元</div></td><td><div>${fmtSigned(row.laborDelta,2)} h/套</div><div class="subtle">${row.note}</div></td><td><div>${fmtSignedMoney(row.packagingDelta)} / 套</div></td><td><div class="config-list">${row.configs.map(c=>`<span class="mini-tag">${c}</span>`).join('')}</div></td></tr>`;
  }).join('');
}

function renderConnectorPricing(m){
  renderConnectorProtocolOverview();
  const summary = m.connectorSummary || {};
  const stageCounts = summary.stageCounts || { batch: 0, protocol: 0, sample: 0 };
  const deltaClass = summary.deltaCost > 0 ? 'delta-up' : summary.deltaCost < 0 ? 'delta-down' : 'delta-flat';
  const stats = [
    `默认执行 <strong>${summary.defaultLabel || BASE.versions.connector[state.connector].label}</strong>`,
    `跟随默认 <strong>${summary.followCount || 0}</strong>`,
    `逐项覆盖 <strong>${summary.overrideCount || 0}</strong>`,
    `批量价 <strong>${stageCounts.batch || 0}</strong>`,
    `协议价 <strong>${stageCounts.protocol || 0}</strong>`,
    `样品价 <strong>${stageCounts.sample || 0}</strong>`,
    `连接器成本 <strong>${fmtMoney(summary.totalCurrentCost || 0)}</strong> 元/套`,
    `相对基准 <strong class="${deltaClass}">${fmtSignedMoney(summary.deltaCost || 0)}</strong> 元/套`,
  ];
  el.connectorExecutionStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');

  el.connectorPriceTable.innerHTML = (m.connectorItems || []).map((item) => {
    const protocolSummary = protocolSummaryForItem(item.id);
    const stageKey = item.selectionKey || state.connector;
    const stageLabel = item.selectionLabel || BASE.versions.connector[state.connector].label;
    const itemDeltaClass = item.deltaCost > 0 ? 'delta-up' : item.deltaCost < 0 ? 'delta-down' : 'delta-flat';
    const recommendedStage = protocolSummary?.recommendedStage || '';
    const recommendedLabel = recommendedStage && BASE.versions.connector[recommendedStage]
      ? BASE.versions.connector[recommendedStage].label
      : '跟随默认';
    const protocolStatusText = protocolSummary ? protocolCountsInline(protocolSummary) : '未配置';
    const protocolPills = protocolSummary ? protocolCountPills(protocolSummary) : '<span class="protocol-count-pill blank">未映射</span>';
    const sourceTooltip = protocolSummary ? escapeHtml(protocolTooltip(protocolSummary)) : '';
    const buttons = [
      `<button class="connector-option follow${item.followsDefault ? ' active' : ''}" type="button" data-connector-id="${item.id}" data-connector-mode="follow">跟随默认</button>`,
      ...connectorVersionKeys.map((versionKey) => `<button class="connector-option${item.overrideKey === versionKey ? ' active' : ''}" type="button" data-connector-id="${item.id}" data-connector-stage="${versionKey}">${BASE.versions.connector[versionKey].label}</button>`),
    ].join('');

    return `<tr>
      <td>
        <div class="connector-title">
          <strong>${item.name}</strong>
          <div class="subtle">${item.code} / 数量 ${item.quantity}</div>
          <div class="subtle">${item.note || ''}</div>
        </div>
      </td>
      <td>
        <div>${item.supplier || '-'}</div>
        <div class="subtle">连接器占比 ${fmtPct(item.share)}</div>
        <div class="connector-protocol-summary"${sourceTooltip ? ` title="${sourceTooltip}"` : ''}>
          <div class="subtle">协议来源 ${protocolSummary?.sourceCount || 0} 项${protocolSummary ? ` · ${protocolRolledUpLabel(protocolSummary)}` : ''}</div>
          <div class="protocol-count-row">${protocolPills}</div>
        </div>
      </td>
      <td>
        <div>${fmtMoney(item.baseCost)} 元/套</div>
        <div class="subtle">批量价基准分摊</div>
      </td>
      <td>
        <div class="connector-stage">
          <div class="stage-line">
            <span class="connector-stage-pill ${connectorStageClass(stageKey)}">${item.followsDefault ? `跟随默认 · ${stageLabel}` : `单独指定 · ${stageLabel}`}</span>
            ${protocolSummary ? `<span class="connector-stage-pill recommended ${connectorStageClass(recommendedStage)}">建议 · ${recommendedLabel}</span>` : ''}
          </div>
          <div class="cost-line">
            <span>${fmtMoney(item.currentCost)} 元/套</span>
            <span class="subtle">${item.followsDefault ? '跟随当前默认档位' : '该连接器单独执行'}</span>
          </div>
          ${protocolSummary ? `<div class="subtle">${protocolStatusText}</div><div class="subtle">${escapeHtml(protocolReason(protocolSummary))}</div>` : ''}
        </div>
      </td>
      <td><div class="connector-option-row">${buttons}</div></td>
      <td>
        <div class="connector-impact">
          <div class="${itemDeltaClass}">${fmtSignedMoney(item.deltaCost)} 元/套</div>
          <div class="subtle">有效分摊 ${fmtPct(item.currentShare || 0)}</div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function formatDateTime(value){
  if(!value) return '—';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function statusKey(value){
  const text = String(value || '').toLowerCase();
  if(text.includes('approve')) return 'approved';
  if(text.includes('pending')) return 'pending';
  if(text.includes('review')) return 'review';
  if(text.includes('reject')) return 'rejected';
  return 'neutral';
}

function renderArchitecture(m){
  const history = repo.getHistory();
  const approvals = repo.getApprovals();
  const seedHistoryCount = Array.isArray(RUNTIME.historySeed) ? RUNTIME.historySeed.length : 0;
  const seedApprovalCount = Array.isArray(RUNTIME.approvalSeed) ? RUNTIME.approvalSeed.length : 0;
  const extraHistoryCount = Math.max(0, history.length - seedHistoryCount);
  const extraApprovalCount = Math.max(0, approvals.length - seedApprovalCount);
  const historyMap = new Map(history.map((record) => [record.id, record]));
  el.layerDataCount.textContent = '6 个文件';
  el.layerDataMeta.textContent = ['g281_data_master.json', 'g281_data_bom_changes.json', 'g281_data_bom_validation.json', 'g281_data_connector_protocol_status.json', 'g281_data_history.json', 'g281_data_approvals.json'].join(' / ');
  el.layerEngineMeta.textContent = `${m.engineLayer} / pure compute / 无 DOM 依赖`;
  el.layerHistoryCount.textContent = `${history.length} 条`;
  el.layerHistoryMeta.textContent = `seed ${seedHistoryCount} + 自定义 ${extraHistoryCount}`;
  el.layerApprovalCount.textContent = `${approvals.length} 条`;
  el.layerApprovalMeta.textContent = `seed ${seedApprovalCount} + 自定义 ${extraApprovalCount}`;

  el.historyTable.innerHTML = history.map((record) => {
    const preview = historyPreview(record);
    const stateText = [record.state?.bom, record.state?.connector, record.state?.labor, record.state?.equipment, record.state?.packaging, record.state?.vave].filter(Boolean).join(' / ');
    const connectorOverrides = connectorOverrideCount(record.draft?.connectorPricing || {}, record.state?.connector || DEFAULT_STATE.connector);
    const note = record.note || '未填写版本说明';
    const author = record.author || 'system';
    return `<tr><td><div class="record-title"><div>${record.name || record.scenarioName}</div><div class="subtle">${record.scenarioName || ''}</div><div class="subtle">${formatDateTime(record.createdAt)} · ${author}</div></div></td><td><div class="state-stack"><div>${stateText || '基准'}</div><div class="subtle">${Object.values(record.state || {}).filter(Boolean).length} 个版本开关</div></div></td><td class="${preview.totalProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(preview.totalProfit)}</td><td>${Number.isFinite(preview.paybackYears) ? `${preview.paybackYears.toFixed(2)} 年` : '∞'}</td><td><div class="note-stack"><div>${note}</div><div class="subtle">ID ${record.id}</div></div></td><td><div class="table-actions"><button class="mini-button primary" type="button" data-load-history="${record.id}">载入版本</button></div></td></tr>`;
  }).join('');
  Array.from(el.historyTable.querySelectorAll('tr')).forEach((row, index) => {
    const record = history[index];
    const overrideCount = connectorOverrideCount(record?.draft?.connectorPricing || {}, record?.state?.connector || DEFAULT_STATE.connector);
    if (!overrideCount) return;
    const stateMeta = row.querySelector('.state-stack .subtle');
    if (!stateMeta || stateMeta.textContent.includes('连接器覆盖')) return;
    stateMeta.textContent = `${stateMeta.textContent} · 连接器覆盖 ${overrideCount} 项`;
  });

  el.approvalTable.innerHTML = approvals.map((record) => {
    const related = record.relatedVersionId ? (historyMap.get(record.relatedVersionId)?.name || record.relatedVersionId) : '未关联';
    const action = record.relatedVersionId ? `<button class="mini-button secondary" type="button" data-load-history="${record.relatedVersionId}">载入关联版本</button>` : '<span class="subtle">无</span>';
    return `<tr><td><div class="record-title"><div>${record.title}</div><div class="subtle">${record.owner || '未指定责任人'}</div></div></td><td>${related}</td><td><span class="status-pill status-${statusKey(record.status)}">${record.status}</span></td><td>${formatDateTime(record.submittedAt || record.createdAt)}</td><td><div class="table-actions">${action}</div></td></tr>`;
  }).join('');
}

function renderEventTable(m){
  const connectorImpact = `${((m.conn.effectiveFactor - 1) * 100).toFixed(1)}% / 默认 ${m.conn.label} / 覆盖 ${m.connectorSummary?.overrideCount || 0} 项`;
  const rows=[['BOM',m.bom.label,`${((m.material/BASE.baseMaterial-1)*100).toFixed(1)}% 材料变动`],['连接器',m.conn.label,connectorImpact],['工时',m.labor.label,`${((m.labor.factor-1)*100).toFixed(1)}% 费率/工时`],['设备',m.equip.label,`${((m.equip.factor-1)*100).toFixed(1)}% 设备分摊`],['包装物流',m.pack.label,`${((m.pack.factor-1)*100).toFixed(1)}% 包装费率`],['VAVE',m.vave.label,`${fmtMoney(m.vave.savings)} 元/套`],['销量结构','已归一化',`${m.currentMix.map(v=>v.toFixed(1)+'%').join(' / ')}`]];
  el.eventTable.innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
}

function renderCompare(m){
  el.compareTable.innerHTML=m.compare.map(([label,base,current])=>{const diff=current-base,isPct=label==='毛利率',isVol=label==='回收销量';return `<tr><td>${label}</td><td>${isVol?fmtMaybeInt(base):isPct?fmtPct(base):fmtMoney(base)}</td><td>${isVol?fmtMaybeInt(current):isPct?fmtPct(current):fmtMoney(current)}</td><td class="${diff>=0?'positive':'negative'}">${isVol?fmtMaybeInt(diff):isPct?fmtPct(diff):fmtMoney(diff)}</td></tr>`}).join('');
}

function renderCapital(m){
  const rows=[['设备资源',BASE.capital.equipment,BASE.capital.equipment/m.totalVolume],['专用模具',BASE.capital.tooling,BASE.capital.tooling/m.totalVolume],['工装投入',BASE.capital.fixtures,BASE.capital.fixtures/m.totalVolume],['研发费用',BASE.capital.rnd,BASE.capital.rnd/m.totalVolume],['合计',m.capitalTotal,m.capitalPerSet]];
  el.capitalLedger.innerHTML=rows.map(r=>`<div class="ledger-item"><div class="name">${r[0]}</div><div class="meta"><div>${fmtMoney(r[1])} 元</div><div>${fmtMoney(r[2])} 元 / 套</div></div></div>`).join('');
}

function renderAnnualTable(m){
  el.annualTable.innerHTML=m.annual.map(r=>`<tr><td>${r.year}</td><td>${fmtInt(r.volume)}</td><td>${fmtMoney(r.asp)}</td><td>${fmtMoney(r.revenue)}</td><td>${fmtMoney(m.operating)}</td><td>${fmtMoney(r.cost)}</td><td class="${r.profit>=0?'positive':'negative'}">${fmtMoney(r.profit)}</td><td class="${r.margin>=0?'positive':'negative'}">${fmtPct(r.margin)}</td></tr>`).join('');
}

function render(m){
  el.scenarioName.value=m.d.scenarioName; renderTags(m); renderSummary(m); renderKPIs(m); renderBomAnalysis(m); renderConnectorPricing(m); renderArchitecture(m); renderCostBridge(m); renderAnnualChart(m); renderConfigBars(m); renderEventTable(m); renderCompare(m); renderCapital(m); renderAnnualTable(m); clearDirty();
}

function syncInputs(){
  applyDraft({}, state.scenarioName);
}

function generate(){state.scenarioName=el.scenarioName.value.trim()||BASE.name; render(calcModel())}
function reset(){applyStateSnapshot(DEFAULT_STATE);state.scenarioName=BASE.name;lastSavedVersionId='';syncInputs();renderVersions();generate()}

let renderTimer=0;
function queueRender(){markDirty(); clearTimeout(renderTimer); renderTimer=setTimeout(generate,120)}

function bind(){
  renderVersions(); syncInputs(); generate();
  el.generateBtn.addEventListener('click',generate); el.resetBtn.addEventListener('click',reset); el.printBtn.addEventListener('click',()=>window.print());
  el.saveVersionBtn.addEventListener('click',()=>{const model=calcModel(); const record=repo.createHistoryRecord(model); repo.saveHistory(record); lastSavedVersionId=record.id; render(model)});
  el.submitApprovalBtn.addEventListener('click',()=>{const model=calcModel(); let versionRecord=lastSavedVersionId?repo.getHistory().find(item=>item.id===lastSavedVersionId):null; if(!versionRecord){versionRecord=repo.createHistoryRecord(model); repo.saveHistory(versionRecord); lastSavedVersionId=versionRecord.id;} const record=repo.createApprovalRecord(model,versionRecord); repo.saveApproval(record); render(model)});
  el.exportLayerBtn.addEventListener('click',()=>{repo.exportSnapshot(`g281_layer_snapshot_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{master:BASE,bomChanges:BOM_CHANGE_ROWS,bomValidation:RUNTIME.bomValidation||null,connectorProtocolStatus:RUNTIME.connectorProtocolStatus||null,history:repo.getHistory(),approvals:repo.getApprovals()})});
  if (el.initConnectorProtocolBtn) {
    el.initConnectorProtocolBtn.addEventListener('click', applyConnectorProtocolInitialization);
  }
  if (el.clearConnectorOverridesBtn) {
    el.clearConnectorOverridesBtn.addEventListener('click',()=>{connectorPricingState={}; renderVersions(); queueRender()});
  }
  if (el.connectorPriceTable) {
    el.connectorPriceTable.addEventListener('click',(event)=>{
      const followButton = event.target.closest('[data-connector-mode="follow"]');
      if (followButton) {
        delete connectorPricingState[followButton.dataset.connectorId];
        renderVersions();
        queueRender();
        return;
      }
      const stageButton = event.target.closest('[data-connector-stage]');
      if (!stageButton) return;
      const itemId = stageButton.dataset.connectorId;
      const stageKey = stageButton.dataset.connectorStage;
      if (!connectorItemIdSet.has(itemId) || !connectorVersionSet.has(stageKey)) return;
      if (stageKey === state.connector) {
        delete connectorPricingState[itemId];
      } else {
        connectorPricingState[itemId] = stageKey;
      }
      renderVersions();
      queueRender();
    });
  }
  [el.historyTable, el.approvalTable].forEach((table) => {
    table.addEventListener('click', (event) => {
      const button = event.target.closest('[data-load-history]');
      if (!button) return;
      loadHistoryRecord(button.dataset.loadHistory);
    });
  });
  [el.scenarioName,...Object.values(controls),...yearInputs,...mixInputs].forEach(x=>x.addEventListener('input',queueRender));
  el.scenarioName.addEventListener('change',()=>state.scenarioName=el.scenarioName.value.trim()||BASE.name);
}

function renderVersions(){Object.entries(BASE.versions).forEach(([g,opts])=>{const box=document.querySelector(`.option-row[data-group="${g}"]`);box.innerHTML='';Object.entries(opts).forEach(([k,it])=>{const b=document.createElement('button');b.type='button';b.className='option'+(state[g]===k?' active':'');b.textContent=it.label;b.title=it.note;b.addEventListener('click',()=>{state[g]=k;renderVersions();queueRender()});box.appendChild(b)});const note=$(g+'Note');if(!note)return;note.textContent=g==='connector'?`默认执行档位：${opts[state[g]].label}。${opts[state[g]].note} 当前已单独指定 ${connectorOverrideCount(connectorPricingState)} 个连接器。`:opts[state[g]].note})}

function renderVersions() {
  Object.entries(BASE.versions).forEach(([group, options]) => {
    const box = document.querySelector(`.option-row[data-group="${group}"]`);
    if (!box) return;
    box.innerHTML = '';

    Object.entries(options).forEach(([key, option]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option' + (state[group] === key ? ' active' : '');
      button.textContent = option.label;
      button.title = option.note;
      button.addEventListener('click', () => {
        state[group] = key;
        if (group === 'connector') {
          connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
        }
        renderVersions();
        queueRender();
      });
      box.appendChild(button);
    });

    const note = $(group + 'Note');
    if (!note) return;
    if (group === 'connector') {
      const overrideCount = connectorOverrideCount(connectorPricingState, state.connector);
      note.textContent = `默认执行档位：${options[state[group]].label}。${options[state[group]].note} 当前已单独指定 ${overrideCount} 个连接器。`;
      return;
    }
    note.textContent = options[state[group]].note;
  });
}

el.sheets.textContent=`${BASE.sheetCount} sheets parsed`; el.faults.textContent=`${BASE.faultCount} formula faults`; el.priceTypes.textContent=`${BASE.priceTypeCount} price types`; bind();
