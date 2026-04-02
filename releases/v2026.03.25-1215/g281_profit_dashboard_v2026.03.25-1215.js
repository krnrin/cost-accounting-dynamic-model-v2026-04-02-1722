const RUNTIME = window.G281_RUNTIME || {};
if (!RUNTIME.master || !window.G281Engine || !window.G281Repo) {
  throw new Error('G281 runtime bundle not loaded');
}
const BASE = RUNTIME.master;
const BOM_CHANGE_ROWS = RUNTIME.bomChanges || [];
const repo = window.G281Repo.init(RUNTIME);
let lastSavedVersionId = '';
const DEFAULT_STATE = { bom: 'freeze', connector: 'batch', labor: 'base', equipment: 'base', packaging: 'base', vave: 'none' };

const state = { scenarioName: BASE.name, ...DEFAULT_STATE };
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

function readDraft() {
  return { scenarioName: el.scenarioName.value.trim() || BASE.name, copperPrice: Number(controls.copperPrice.value) || 0, aluminumPrice: Number(controls.aluminumPrice.value) || 0, directHours: Number(controls.directHours.value) || 0, directRate: Number(controls.directRate.value) || 0, manufacturingHours: Number(controls.manufacturingHours.value) || 0, manufacturingRate: Number(controls.manufacturingRate.value) || 0, packInner: Number(controls.packInner.value) || 0, packFreight: Number(controls.packFreight.value) || 0, packWarehouse: Number(controls.packWarehouse.value) || 0, packOther: Number(controls.packOther.value) || 0, bomWireDrawing: Number(controls.bomWireDrawing.value) || 0, bomWireEat: Number(controls.bomWireEat.value) || 0, bomWireHidden: Number(controls.bomWireHidden.value) || 0, bomTapeDiameter: Number(controls.bomTapeDiameter.value) || 0, bomTapeWidth: Number(controls.bomTapeWidth.value) || 0, bomTapeOverlap: Number(controls.bomTapeOverlap.value) || 0, mix: normalizeMix(mixInputs.map((input) => input.value)), volumes: yearInputs.map((input) => Math.max(0, Number(input.value) || 0)), asp: BASE.asp.slice() };
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

function renderTags(m){el.scenarioTags.innerHTML=[`BOM ${m.bom.label}`,`连接器 ${m.conn.label}`,`工时 ${m.labor.label}`,`设备 ${m.equip.label}`,`包装 ${m.pack.label}`,`VAVE ${m.vave.label}`].map(t=>`<span class="chip">${t}</span>`).join('')}
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
  el.layerDataCount.textContent = '5 个文件';
  el.layerDataMeta.textContent = ['g281_data_master.json', 'g281_data_bom_changes.json', 'g281_data_history.json', 'g281_data_approvals.json', 'g281_data_bom_validation.json'].join(' / ');
  el.layerEngineMeta.textContent = `${m.engineLayer} / pure compute / 无 DOM 依赖`;
  el.layerHistoryCount.textContent = `${history.length} 条`;
  el.layerHistoryMeta.textContent = `seed ${seedHistoryCount} + 自定义 ${extraHistoryCount}`;
  el.layerApprovalCount.textContent = `${approvals.length} 条`;
  el.layerApprovalMeta.textContent = `seed ${seedApprovalCount} + 自定义 ${extraApprovalCount}`;

  el.historyTable.innerHTML = history.map((record) => {
    const preview = historyPreview(record);
    const stateText = [record.state?.bom, record.state?.connector, record.state?.labor, record.state?.equipment, record.state?.packaging, record.state?.vave].filter(Boolean).join(' / ');
    const note = record.note || '未填写版本说明';
    const author = record.author || 'system';
    return `<tr><td><div class="record-title"><div>${record.name || record.scenarioName}</div><div class="subtle">${record.scenarioName || ''}</div><div class="subtle">${formatDateTime(record.createdAt)} · ${author}</div></div></td><td><div class="state-stack"><div>${stateText || '基准'}</div><div class="subtle">${Object.values(record.state || {}).filter(Boolean).length} 个版本开关</div></div></td><td class="${preview.totalProfit >= 0 ? 'positive' : 'negative'}">${fmtMoney(preview.totalProfit)}</td><td>${Number.isFinite(preview.paybackYears) ? `${preview.paybackYears.toFixed(2)} 年` : '∞'}</td><td><div class="note-stack"><div>${note}</div><div class="subtle">ID ${record.id}</div></div></td><td><div class="table-actions"><button class="mini-button primary" type="button" data-load-history="${record.id}">载入版本</button></div></td></tr>`;
  }).join('');

  el.approvalTable.innerHTML = approvals.map((record) => {
    const related = record.relatedVersionId ? (historyMap.get(record.relatedVersionId)?.name || record.relatedVersionId) : '未关联';
    const action = record.relatedVersionId ? `<button class="mini-button secondary" type="button" data-load-history="${record.relatedVersionId}">载入关联版本</button>` : '<span class="subtle">无</span>';
    return `<tr><td><div class="record-title"><div>${record.title}</div><div class="subtle">${record.owner || '未指定责任人'}</div></div></td><td>${related}</td><td><span class="status-pill status-${statusKey(record.status)}">${record.status}</span></td><td>${formatDateTime(record.submittedAt || record.createdAt)}</td><td><div class="table-actions">${action}</div></td></tr>`;
  }).join('');
}

function renderEventTable(m){
  const rows=[['BOM',m.bom.label,`${((m.material/BASE.baseMaterial-1)*100).toFixed(1)}% 材料变动`],['连接器',m.conn.label,`${((m.conn.factor-1)*100).toFixed(1)}%`],['工时',m.labor.label,`${((m.labor.factor-1)*100).toFixed(1)}% 费率/工时`],['设备',m.equip.label,`${((m.equip.factor-1)*100).toFixed(1)}% 设备分摊`],['包装物流',m.pack.label,`${((m.pack.factor-1)*100).toFixed(1)}% 包装费率`],['VAVE',m.vave.label,`${fmtMoney(m.vave.savings)} 元/套`],['销量结构','已归一化',`${m.currentMix.map(v=>v.toFixed(1)+'%').join(' / ')}`]];
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
  el.scenarioName.value=m.d.scenarioName; renderTags(m); renderSummary(m); renderKPIs(m); renderBomAnalysis(m); renderArchitecture(m); renderCostBridge(m); renderAnnualChart(m); renderConfigBars(m); renderEventTable(m); renderCompare(m); renderCapital(m); renderAnnualTable(m); clearDirty();
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
  el.exportLayerBtn.addEventListener('click',()=>{repo.exportSnapshot(`g281_layer_snapshot_${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{master:BASE,bomChanges:BOM_CHANGE_ROWS,bomValidation:RUNTIME.bomValidation||null,history:repo.getHistory(),approvals:repo.getApprovals()})});
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

function renderVersions(){Object.entries(BASE.versions).forEach(([g,opts])=>{const box=document.querySelector(`.option-row[data-group="${g}"]`);box.innerHTML='';Object.entries(opts).forEach(([k,it])=>{const b=document.createElement('button');b.type='button';b.className='option'+(state[g]===k?' active':'');b.textContent=it.label;b.title=it.note;b.addEventListener('click',()=>{state[g]=k;renderVersions();queueRender()});box.appendChild(b)});$(g+'Note').textContent=opts[state[g]].note})}

el.sheets.textContent=`${BASE.sheetCount} sheets parsed`; el.faults.textContent=`${BASE.faultCount} formula faults`; el.priceTypes.textContent=`${BASE.priceTypeCount} price types`; bind();
