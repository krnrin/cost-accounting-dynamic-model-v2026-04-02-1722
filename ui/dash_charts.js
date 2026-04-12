/**
 * dash_charts.js
 * 图表/BOM分析/变更归因/洞察模块
 * Extracted from dashboard.js — do not edit both files simultaneously.
 */


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

const BOM_ACTIVE_WIRE_CODE_SUFFIX_RE = /\/AL\d+$/i;
const BOM_ACTIVE_EMPTY_ROW_LIMIT = 36;
const BOM_ACTIVE_WIRE_UNITS = new Set(['M', '米']);
const BOM_ACTIVE_WIRE_KEYWORDS = ['导线', 'WIRE', 'CABLE'];
const BOM_ACTIVE_NON_WIRE_KEYWORDS = ['胶带', '套管', '热缩管', '编织套管', '扎带', '支架'];
const BOM_ACTIVE_CONNECTOR_KEYWORDS = ['连接器', '插座', '插头', '护套', '端子', '防水栓', '盲栓', '密封塞', '胶壳', '壳体', 'CONNECTOR', 'TERMINAL', 'SEAL', 'PLUG', 'RECEPTACLE', 'HEADER', 'TPA', 'CPA'];
let activeBomAutoExtractCacheKey = '';
let activeBomAutoExtractCacheValue = null;

function normalizeBomExtractText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeBomLookupText(value) {
  return normalizeBomExtractText(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeBomPartCode(value) {
  return normalizeBomLookupText(value).replace(BOM_ACTIVE_WIRE_CODE_SUFFIX_RE, '');
}

function normalizeBomNameKey(value) {
  return normalizeBomExtractText(value).replace(/\s+/g, '').trim().toUpperCase();
}

function bomSectionSizeFromCodeOrName(code, name) {
  const codeMatch = String(code || '').match(/\/(\d+(?:\.\d+)?)(?:\/|$)/);
  if (codeMatch) return Number(codeMatch[1]);
  const nameMatch = String(name || '').match(/(\d+(?:\.\d+)?)\s*(?:MM²|MM2|平方|方)/i);
  if (nameMatch) return Number(nameMatch[1]);
  return null;
}

function bomFamilyKeyFromCode(value) {
  const normalized = normalizeBomPartCode(value);
  const match = normalized.match(/^(.+?)\/(\d+(?:\.\d+)?)(?:\/.*)?$/);
  return match ? match[1] : normalized;
}

function bomContainsKeyword(text, keywords) {
  const upper = normalizeBomLookupText(text);
  return keywords.some((keyword) => upper.includes(String(keyword || '').toUpperCase()));
}

function bomReadUniverCellValue(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (cell.p?.body?.dataStream) return cell.p.body.dataStream;
  if (Object.prototype.hasOwnProperty.call(cell, 'v')) return cell.v;
  if (Object.prototype.hasOwnProperty.call(cell, 'm')) return cell.m;
  return null;
}

function buildBuiltInWorkbookRowMap(sheet) {
  const rows = new Map();
  (sheet?.cells || []).forEach((cell) => {
    const rowIndex = Number(cell?.row);
    const columnIndex = Number(cell?.column);
    if (!Number.isFinite(rowIndex) || rowIndex < 1 || !Number.isFinite(columnIndex) || columnIndex < 1) return;
    if (!rows.has(rowIndex)) rows.set(rowIndex, {});
    rows.get(rowIndex)[columnIndex] = Object.prototype.hasOwnProperty.call(cell, 'display')
      ? cell.display
      : (Object.prototype.hasOwnProperty.call(cell, 'value') ? cell.value : null);
  });
  return rows;
}

function buildUniverWorkbookRowMap(sheet) {
  const rows = new Map();
  Object.entries(sheet?.cellData || {}).forEach(([rowKey, rowCells]) => {
    const rowIndex = Number(rowKey) + 1;
    if (!Number.isFinite(rowIndex) || rowIndex < 1) return;
    const rowRecord = {};
    Object.entries(rowCells || {}).forEach(([columnKey, cell]) => {
      const columnIndex = Number(columnKey) + 1;
      if (!Number.isFinite(columnIndex) || columnIndex < 1) return;
      rowRecord[columnIndex] = bomReadUniverCellValue(cell);
    });
    if (Object.keys(rowRecord).length) rows.set(rowIndex, rowRecord);
  });
  return rows;
}

function resolveActiveBomWorkbookSheet() {
  const activeBom = BASE.versions?.bom?.[state.bom] || {};
  const customSheets = activeBom?.templateWorkbookSnapshot?.sheets;
  if (customSheets && typeof customSheets === 'object') {
    const sheet = Object.values(customSheets).find((entry) => entry?.name === 'KSK线束BOM明细');
    if (sheet) {
      return {
        kind: 'custom',
        versionKey: state.bom,
        sourceLabel: `${versionOptionLabel('bom', state.bom) || state.bom} · 当前整表快照`,
        sheetName: sheet.name,
        maxRow: Number(sheet?.rowCount) || 0,
        rows: buildUniverWorkbookRowMap(sheet),
      };
    }
  }

  const workbookVersionKey = resolveWorkbookVersionKeyFromBomState();
  const workbookVersion = RUNTIME?.bomWorkbookCopies?.versions?.[workbookVersionKey];
  const workbookSheet = Array.isArray(workbookVersion?.sheets)
    ? workbookVersion.sheets.find((entry) => entry?.sheetName === 'KSK线束BOM明细')
    : null;
  if (workbookSheet) {
    return {
      kind: 'runtime',
      versionKey: workbookVersionKey,
      sourceLabel: `${VIEWER_VERSION_LABELS[workbookVersionKey] || workbookVersionKey || '当前'} · KSK线束BOM明细`,
      sheetName: workbookSheet.sheetName,
      maxRow: Number(workbookSheet?.maxRow) || 0,
      rows: buildBuiltInWorkbookRowMap(workbookSheet),
    };
  }

  return null;
}

function parseBomNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = normalizeBomExtractText(value).replace(/,/g, '');
  if (!text) return 0;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : 0;
}

function extractActiveBomLineItems() {
  const workbookSheet = resolveActiveBomWorkbookSheet();
  if (!workbookSheet) {
    return {
      hasSource: false,
      sourceLabel: '',
      sourceSheetName: '',
      items: [],
    };
  }

  const items = [];
  let emptyRun = 0;
  const maxRow = Math.max(Number(workbookSheet.maxRow) || 0, 120);
  for (let rowIndex = 2; rowIndex <= maxRow; rowIndex += 1) {
    const row = workbookSheet.rows.get(rowIndex);
    if (!row || !Object.keys(row).length) {
      emptyRun += 1;
      if (rowIndex > 40 && emptyRun >= BOM_ACTIVE_EMPTY_ROW_LIMIT) break;
      continue;
    }
    emptyRun = 0;

    const harnessId = normalizeBomExtractText(row[1]);
    const harnessName = normalizeBomExtractText(row[2]);
    const assemblyNo = normalizeBomExtractText(row[3] || row[4]);
    const partNumber = normalizeBomExtractText(row[4] || row[3]);
    const partName = normalizeBomExtractText(row[5]);
    const unit = normalizeBomExtractText(row[12]);
    const supplier = normalizeBomExtractText(row[13]);
    const sap = normalizeBomExtractText(row[7]);
    const remark = normalizeBomExtractText(row[14]);
    const quantity = parseBomNumericValue(row[11]);

    if (![harnessId, harnessName, assemblyNo, partNumber, partName, quantity].some(Boolean)) {
      continue;
    }

    items.push({
      rowIndex,
      harnessId,
      harnessName,
      assemblyNo,
      partNumber,
      partName,
      unit,
      quantity,
      supplier,
      sap,
      remark,
      sourceLabel: workbookSheet.sourceLabel,
      sourceSheetName: workbookSheet.sheetName,
    });
  }

  return {
    hasSource: items.length > 0,
    sourceLabel: workbookSheet.sourceLabel,
    sourceSheetName: workbookSheet.sheetName,
    items,
  };
}

function isActiveBomWireItem(item) {
  const nameText = `${item?.partName || ''} ${item?.partNumber || ''}`;
  const unit = normalizeBomLookupText(item?.unit);
  if (!BOM_ACTIVE_WIRE_UNITS.has(unit)) return false;
  if (!bomContainsKeyword(nameText, BOM_ACTIVE_WIRE_KEYWORDS)) return false;
  return !bomContainsKeyword(nameText, BOM_ACTIVE_NON_WIRE_KEYWORDS);
}

function isActiveBomConnectorItem(item) {
  if (isActiveBomWireItem(item)) return false;
  const text = `${item?.partNumber || ''} ${item?.partName || ''} ${item?.remark || ''}`;
  return bomContainsKeyword(text, BOM_ACTIVE_CONNECTOR_KEYWORDS);
}

function addBomUsageValue(map, key, amount) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function buildActiveBomWireExtract(lineItemsResult) {
  const exact = new Map();
  const normalized = new Map();
  const nameSize = new Map();
  const familySize = new Map();
  const items = lineItemsResult.items.filter(isActiveBomWireItem);

  items.forEach((item) => {
    const amount = Math.max(parseBomNumericValue(item.quantity), 0);
    const exactKey = normalizeBomLookupText(item.partNumber);
    const normalizedKey = normalizeBomPartCode(item.partNumber);
    const size = bomSectionSizeFromCodeOrName(item.partNumber, item.partName);
    const nameKey = normalizeBomNameKey(item.partName);
    const familyKey = bomFamilyKeyFromCode(item.partNumber);
    addBomUsageValue(exact, exactKey, amount);
    addBomUsageValue(normalized, normalizedKey, amount);
    if (nameKey && size !== null) addBomUsageValue(nameSize, `${nameKey}__${size}`, amount);
    if (familyKey && size !== null) addBomUsageValue(familySize, `${familyKey}__${size}`, amount);
  });

  return {
    hasSource: lineItemsResult.hasSource && items.length > 0,
    sourceLabel: lineItemsResult.sourceLabel,
    sourceSheetName: lineItemsResult.sourceSheetName,
    items,
    exact,
    normalized,
    nameSize,
    familySize,
  };
}

function resolveActiveBomWireUsage(row, wireExtract) {
  if (!wireExtract?.hasSource) return null;
  const exactCode = normalizeBomLookupText(row?.code);
  const normalizedCode = normalizeBomPartCode(row?.code);
  const size = bomSectionSizeFromCodeOrName(row?.code, row?.name);
  const nameKey = normalizeBomNameKey(row?.name);
  const familyKey = bomFamilyKeyFromCode(row?.code);
  if (exactCode && wireExtract.exact.has(exactCode)) {
    return { key: 'bom_auto', value: wireExtract.exact.get(exactCode), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'exact_code' };
  }
  if (normalizedCode && wireExtract.normalized.has(normalizedCode)) {
    return { key: 'bom_auto', value: wireExtract.normalized.get(normalizedCode), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'normalized_code' };
  }
  if (nameKey && size !== null) {
    const composite = `${nameKey}__${size}`;
    if (wireExtract.nameSize.has(composite)) {
      return { key: 'bom_auto', value: wireExtract.nameSize.get(composite), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'name_and_size' };
    }
  }
  if (familyKey && size !== null) {
    const composite = `${familyKey}__${size}`;
    if (wireExtract.familySize.has(composite)) {
      return { key: 'bom_auto', value: wireExtract.familySize.get(composite), hasValue: true, missing: false, sourceLabel: wireExtract.sourceLabel, matchMethod: 'family_and_size' };
    }
  }
  return { key: 'bom_auto', value: 0, hasValue: false, missing: true, sourceLabel: wireExtract.sourceLabel, matchMethod: 'unmatched' };
}

function mergeActiveBomConnectorItem(acc, item) {
  const quantity = Math.max(parseBomNumericValue(item.quantity), 0);
  acc.quantity += quantity;
  acc.rowCount += 1;
  if (item.harnessId) acc.harnessIds.add(item.harnessId);
  if (item.assemblyNo) acc.assemblyNos.add(item.assemblyNo);
  if (item.sap) acc.sapNos.add(item.sap);
  if (item.remark) acc.remarks.add(item.remark);
  return acc;
}

function normalizeConnectorMatchCode(value) {
  return normalizeBomLookupText(value).replace(/[（）()]/g, '');
}

function normalizeConnectorMatchName(value) {
  return normalizeBomLookupText(String(value || '').replace(/[（(].*?[)）]/g, ''));
}

function matchProtocolRowToConnectorItem(item) {
  const itemPartCode = normalizeConnectorMatchCode(item?.partNumber);
  const itemAssemblyCodes = Array.from(item?.assemblyNos || []).map((value) => normalizeConnectorMatchCode(value)).filter(Boolean);
  const itemSupplier = normalizeBomLookupText(item?.supplier);
  const itemName = normalizeConnectorMatchName(item?.partName);
  let bestRow = null;
  let bestScore = 0;

  protocolRows.forEach((row) => {
    let score = 0;
    const rowPartCode = normalizeConnectorMatchCode(row?.partNumber);
    const rowAssemblyCode = normalizeConnectorMatchCode(protocolAssemblyNo(row));
    const rowSupplier = normalizeBomLookupText(row?.supplierRaw || row?.supplier);
    const rowName = normalizeConnectorMatchName(row?.partNameRaw || row?.partName);
    const rowFunction = normalizeConnectorMatchCode(row?.functionRaw || row?.functionBrief);

    if (itemPartCode && rowPartCode && itemPartCode === rowPartCode) score += 100;
    if (itemPartCode && rowAssemblyCode && itemPartCode === rowAssemblyCode) score += 80;
    if (itemAssemblyCodes.length && rowAssemblyCode && itemAssemblyCodes.includes(rowAssemblyCode)) score += 60;
    if (itemAssemblyCodes.length && rowFunction && itemAssemblyCodes.some((code) => rowFunction.includes(code))) score += 40;
    if (itemSupplier && rowSupplier && itemSupplier === rowSupplier) score += 12;
    if (itemName && rowName && itemName === rowName) score += 18;

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  });

  return {
    row: bestScore >= 40 ? bestRow : null,
    score: bestScore,
  };
}

function buildActiveBomConnectorExtract(lineItemsResult) {
  const grouped = new Map();
  lineItemsResult.items
    .filter(isActiveBomConnectorItem)
    .forEach((item) => {
      const key = normalizeConnectorMatchCode(item.partNumber) || `${normalizeConnectorMatchName(item.partName)}__${normalizeBomLookupText(item.supplier)}`;
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          partNumber: item.partNumber,
          partName: item.partName,
          supplier: item.supplier,
          unit: item.unit,
          quantity: 0,
          rowCount: 0,
          harnessIds: new Set(),
          assemblyNos: new Set(),
          sapNos: new Set(),
          remarks: new Set(),
          sourceLabel: lineItemsResult.sourceLabel,
          sourceSheetName: lineItemsResult.sourceSheetName,
        });
      }
      mergeActiveBomConnectorItem(grouped.get(key), item);
    });

  const items = Array.from(grouped.values())
    .map((item) => {
      const protocolMatch = matchProtocolRowToConnectorItem(item);
      return {
        ...item,
        harnessIds: Array.from(item.harnessIds),
        assemblyNos: Array.from(item.assemblyNos),
        sapNos: Array.from(item.sapNos),
        remarks: Array.from(item.remarks),
        protocolRow: protocolMatch.row,
        protocolScore: protocolMatch.score,
      };
    })
    .sort((left, right) => {
      if (Math.abs((right.quantity || 0) - (left.quantity || 0)) > 0.0001) return (right.quantity || 0) - (left.quantity || 0);
      return String(left.partNumber || '').localeCompare(String(right.partNumber || ''), 'zh-CN');
    });

  return {
    hasSource: lineItemsResult.hasSource && items.length > 0,
    sourceLabel: lineItemsResult.sourceLabel,
    sourceSheetName: lineItemsResult.sourceSheetName,
    items,
    matchedCount: items.filter((item) => item.protocolRow).length,
    unmatchedCount: items.filter((item) => !item.protocolRow).length,
  };
}

function buildActiveBomAutoExtract() {
  const lineItemsResult = extractActiveBomLineItems();
  return {
    hasSource: lineItemsResult.hasSource,
    sourceLabel: lineItemsResult.sourceLabel,
    sourceSheetName: lineItemsResult.sourceSheetName,
    lineItems: lineItemsResult.items,
    wire: buildActiveBomWireExtract(lineItemsResult),
    connector: buildActiveBomConnectorExtract(lineItemsResult),
  };
}

function activeBomAutoExtractCacheToken() {
  const activeBom = BASE.versions?.bom?.[state.bom] || {};
  const workbookSnapshot = activeBom?.templateWorkbookSnapshot;
  return [
    state.bom,
    resolveWorkbookVersionKeyFromBomState(),
    activeBom.updatedAt || activeBom.createdAt || '',
    workbookSnapshot?.id || '',
    Array.isArray(workbookSnapshot?.sheetOrder) ? workbookSnapshot.sheetOrder.join('|') : '',
  ].join('::');
}

function getActiveBomAutoExtract() {
  const token = activeBomAutoExtractCacheToken();
  if (token === activeBomAutoExtractCacheKey && activeBomAutoExtractCacheValue) {
    return activeBomAutoExtractCacheValue;
  }
  activeBomAutoExtractCacheKey = token;
  activeBomAutoExtractCacheValue = buildActiveBomAutoExtract();
  return activeBomAutoExtractCacheValue;
}

function activeBomWireMatchLabel(method) {
  return ({
    exact_code: 'BOM零件号直取',
    normalized_code: 'BOM规格归一',
    name_and_size: '名称+截面匹配',
    family_and_size: '系列+截面匹配',
    unmatched: '当前BOM未命中',
  })[method] || '当前BOM自动抓取';
}

function renderActiveBomConnectorPartDetail(item) {
  const notes = [];
  if (item?.sapNos?.length) notes.push(`SAP ${item.sapNos[0]}`);
  if (item?.remarks?.length) notes.push(item.remarks[0]);
  notes.push(`BOM数量 ${fmtNumber(item?.quantity || 0, 2)} ${item?.unit || ''}`.trim());
  const partLine = [item?.partNumber, item?.partName].filter(Boolean)
    .map((text, index) => `<span class="${index === 0 ? 'connector-part-code' : 'connector-part-name'}">${escapeHtml(text)}</span>`)
    .join('<span class="connector-part-sep">/</span>');
  const noteLine = notes.length
    ? `<div class="connector-part-notes">${notes.map((text) => `<span class="connector-mini-note">${escapeHtml(text)}</span>`).join('')}</div>`
    : '';
  return `<div class="connector-part-detail">
    ${partLine ? `<div class="connector-part-line">${partLine}</div>` : ''}
    ${noteLine}
  </div>`;
}

function wireUsageLabel(key) {
  return ({
    quote: '报价版',
    fixed: '定点版',
    tt: 'TT版',
    bom_auto: '当前 BOM 自动抓取',
  })[key] || key || '-';
}

function requestedWireUsageKey() {
  const label = versionOptionLabel('bom', state.bom);
  const raw = `${state.bom || ''} ${label || ''}`.toLowerCase();
  if (state.bom === 'regress' || raw.includes('tt')) return 'tt';
  if (state.bom === 'light' || raw.includes('fixed') || raw.includes('定点')) return 'fixed';
  if (state.bom === 'freeze' || raw.includes('quote') || raw.includes('报价')) return 'quote';
  return 'fixed';
}

function wireUsageCandidates(requestedKey) {
  const candidates = [requestedKey];
  const fallback = WIRE_CATALOG.meta?.usageFallbackOrder?.[requestedKey];
  if (Array.isArray(fallback)) {
    fallback.forEach((key) => {
      if (key && !candidates.includes(key)) candidates.push(key);
    });
  }
  return candidates;
}

function resolveWireUsage(row, requestedKey, autoExtract = null) {
  const activeWireExtract = autoExtract?.wire || null;
  if (activeWireExtract?.hasSource) {
    return resolveActiveBomWireUsage(row, activeWireExtract);
  }
  const usage = row?.usage || {};
  const candidates = wireUsageCandidates(requestedKey);
  for (const key of candidates) {
    const value = usage[key];
    if (value !== null && value !== undefined && value !== '') {
      return { key, value: Number(value) || 0, hasValue: true, missing: false };
    }
  }
  return { key: requestedKey, value: 0, hasValue: false, missing: true };
}

function renderWireCatalog(m) {
  if (!el.wireModelSummary || !el.wireCalcNote || !el.wireModelTable) return;
  if (!WIRE_MODELS.length) {
    el.wireModelSummary.innerHTML = '<div class="wire-model-stat"><div class="label">导线型号</div><div class="value">0 个</div><div class="meta">当前未导入导线目录</div></div>';
    el.wireCalcNote.textContent = '当前未加载导线型号联动数据。';
    if (el.wireTableStatus) {
      el.wireTableStatus.textContent = '当前未加载导线型号数据。';
    }
    el.wireModelTable.innerHTML = '<tr><td colspan="10" class="wire-empty-cell">当前未加载导线型号数据。</td></tr>';
    return;
  }

  const requestedUsage = requestedWireUsageKey();
  const bomLabel = versionOptionLabel('bom', state.bom) || wireUsageLabel(requestedUsage);
  const activeBomExtract = getActiveBomAutoExtract();
  const copperPrice = Number(m.d.copperPrice) || 0;
  const aluminumPrice = Number(m.d.aluminumPrice) || 0;
  const rows = WIRE_MODELS.map((row) => {
    const weights = row.weights || {};
    const usage = resolveWireUsage(row, requestedUsage, activeBomExtract);
    const aluminumWeight = Number(weights.aluminum) || 0;
    const copperWeight = Number(weights.copper) || 0;
    const nonCopper = Number(weights.nonCopper) || 0;
    const aluminumCost = (aluminumWeight / 1000000) * aluminumPrice;
    const copperCost = (copperWeight / 1000000) * copperPrice;
    const currentUnitPrice = aluminumCost + copperCost + (nonCopper / 1000);
    const currentAmount = currentUnitPrice * usage.value;
    return {
      ...row,
      usageKey: usage.key,
      usageValue: usage.value,
      hasUsageValue: usage.hasValue,
      usageMissing: usage.missing,
      usageSourceLabel: usage.sourceLabel || '',
      usageMatchMethod: usage.matchMethod || '',
      aluminumWeight,
      copperWeight,
      nonCopper,
      aluminumCost,
      copperCost,
      currentUnitPrice,
      currentAmount,
    };
  }).sort((left, right) => {
    const leftRank = left.usageValue > 0 ? 2 : left.hasUsageValue ? 1 : 0;
    const rightRank = right.usageValue > 0 ? 2 : right.hasUsageValue ? 1 : 0;
    if (leftRank !== rightRank) return rightRank - leftRank;
    if (Math.abs(right.currentAmount - left.currentAmount) > 0.0001) return right.currentAmount - left.currentAmount;
    return String(left.code || '').localeCompare(String(right.code || ''), 'zh-CN');
  });

  const totalModels = rows.length;
  const activeRows = rows.filter((row) => row.usageValue > 0);
  const activeCount = activeRows.length;
  const zeroUsageRows = rows.filter((row) => row.hasUsageValue && row.usageValue <= 0);
  const missingUsageRows = rows.filter((row) => !row.hasUsageValue);
  const inactiveCount = totalModels - activeCount;
  const usageRows = activeCount ? activeRows : rows.filter((row) => row.hasUsageValue);
  const fallbackRows = activeCount ? activeRows : rows.filter((row) => row.hasUsageValue);
  const rowsForView = showInactiveWireModels ? rows : fallbackRows;
  const hiddenCount = Math.max(0, totalModels - rowsForView.length);
  const totalUsage = activeRows.reduce((sum, row) => sum + row.usageValue, 0);
  const totalAmount = activeRows.reduce((sum, row) => sum + row.currentAmount, 0);
  const inferredRows = rows.filter((row) => row.weightSource?.inferred);
  const sourceCounts = usageRows.reduce((acc, row) => {
    acc[row.usageKey] = (acc[row.usageKey] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(sourceCounts)
    .map(([key, count]) => `${wireUsageLabel(key)} ${count} 项`)
    .join(' / ');
  const sourceBooks = activeBomExtract?.wire?.hasSource
    ? `${activeBomExtract.wire.sourceLabel} / ${activeBomExtract.wire.sourceSheetName}`
    : [WIRE_CATALOG.meta?.ttSourceWorkbook, WIRE_CATALOG.meta?.fixedSourceWorkbook, WIRE_CATALOG.meta?.quoteSourceWorkbook]
      .filter(Boolean)
      .join(' / ');
  const summaryCards = [
    ['导线目录', `${totalModels} 个`, '所有版本导线型号'],
    ['当前 BOM', `${bomLabel} / ${totalModels} 个`, activeCount ? `实取 ${sourceSummary || wireUsageLabel(requestedUsage)}` : '当前版本未启用'],
    ['版本覆盖', `${activeCount}/${totalModels} 型号启用`, inactiveCount ? `${inactiveCount} 型号还未启用` : '全部启用'],
    ['铜基价', `${fmtMoney(copperPrice, 0)} 元/吨`, m.metal.label],
    ['铝基价', `${fmtMoney(aluminumPrice, 0)} 元/吨`, m.metal.label],
    ['材料汇总', `铝 ${fmtNumber(WIRE_CATALOG.summary?.totalAluminumWeight || 0, 2)} / 铜 ${fmtNumber(WIRE_CATALOG.summary?.totalCopperWeight || 0, 2)}`, `非铜 ${fmtNumber(WIRE_CATALOG.summary?.totalNonCopper || 0, 2)}`],
    ['当前导线金额', `${fmtMoney(totalAmount)} 元/套`, inferredRows.length ? `当前用量 ${fmtNumber(totalUsage, 2)} / 推算 ${inferredRows.length} 项` : `当前用量 ${fmtNumber(totalUsage, 2)}`],
  ];
  el.wireModelSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const inferredNote = inferredRows.length ? `当前有 ${inferredRows.length} 项按 TT 专有规格模板推算，表内已标注。` : '';
  el.wireCalcNote.innerHTML = `单价规则：铝重 × 当前铝价 / 1,000,000 + 铜重 × 当前铜价 / 1,000,000 + 非铜/1000。铜价、铝价按元/吨输入，铝重 / 铜重 / 非铜按核算表原字段直接搬入。数据来源：${escapeHtml(sourceBooks || '导线联动核算表')}。当前 BOM 口径：${escapeHtml(bomLabel)}，用量来源：${escapeHtml(sourceSummary || wireUsageLabel(requestedUsage))}。${escapeHtml(inferredNote)}`;

  if (el.wireTableStatus) {
    el.wireTableStatus.innerHTML = `
      <span class="wire-table-status-count">${totalModels} 型号 · ${activeCount} 已用 · ${zeroUsageRows.length} 零用量 · ${missingUsageRows.length} 缺失</span>
      <span class="wire-table-status-note">全部 26 个型号保留展示；零用量和缺失项不再隐藏。</span>
    `;
  }

  if (el.wireTableStatus) {
    const statusNote = showInactiveWireModels
      ? `已展开全部导线，其中 ${zeroUsageRows.length} 条零用量，${missingUsageRows.length} 条缺失口径。`
      : hiddenCount > 0
        ? `默认仅显示当前版本已用导线，已隐藏 ${hiddenCount} 条非当前版本导线。`
        : '当前版本导线已全部显示。';
    el.wireTableStatus.innerHTML = `
      <span class="wire-table-status-count">${totalModels} 型号 · ${activeCount} 已用 · 当前显示 ${rowsForView.length} 条</span>
      <span class="wire-table-status-note">${statusNote}</span>
    `;
  }
  updateWireCatalogToggleButton(hiddenCount);

  if (!rowsForView.length) {
    el.wireModelTable.innerHTML = '<tr><td colspan="10" class="wire-empty-cell">当前版本暂无已用导线，点击“显示非版本导线”可查看全部目录。</td></tr>';
    return;
  }

  el.wireModelTable.innerHTML = rowsForView.map((row) => {
    const metaBits = [row.supplier, row.sap ? `SAP ${row.sap}` : '', row.priceType].filter(Boolean);
    const weightLabel = row.weightSource?.label || '';
    const weightNote = row.weightSource?.note || '';
    const templateCode = row.weightSource?.templateCode || '';
    const isActive = row.usageValue > 0;
    const isMissing = !row.hasUsageValue;
    const statusKey = isActive ? 'active' : isMissing ? 'missing' : 'zero';
    const usageLabelText = wireUsageLabel(row.usageKey);
    const usageNote = isActive
      ? `<div class="wire-cell-note">${escapeHtml(usageLabelText)}</div>`
      : `<div class="wire-cell-note wire-cell-note--inactive">${isMissing ? '当前版本缺失用量' : '当前版本零用量'} · ${escapeHtml(usageLabelText)}</div>`;
    const usageFlag = `<div class="wire-usage-flag is-${statusKey}">${isActive ? '已启用' : isMissing ? '缺失' : '零用量'}</div>`;
    return `
      <tr class="wire-row${isActive ? '' : ' wire-row-inactive'}${isMissing ? ' wire-row-missing' : ''}" data-wire-status="${statusKey}">
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.code || '-')}</strong>
            <span>${escapeHtml(row.name || '-')}</span>
          </div>
          <div class="wire-inline-meta">${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join('')}</div>
          ${weightLabel ? `<div class="wire-cell-note" title="${escapeHtml(weightNote)}">${escapeHtml(weightLabel)}${templateCode ? ` 路 ${escapeHtml(templateCode)}` : ''}</div>` : ''}
        </td>
        <td>
          <div class="wire-family-stack">
            <span class="wire-family-chip">${escapeHtml(row.relationLabel || row.materialFamily || '-')}</span>
            <span class="wire-cell-note">${escapeHtml(row.materialFamily || '-')}</span>
          </div>
        </td>
        <td class="wire-number-cell">
          <div class="wire-number-main${isActive ? '' : ' wire-number-muted'}">${fmtNumber(row.usageValue, 2)}</div>
          ${usageNote}
          ${usageFlag}
        </td>
        <td class="wire-number-cell">${fmtMetric(row.aluminumWeight, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.copperWeight, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.nonCopper, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.aluminumCost, 3)}</td>
        <td class="wire-number-cell">${fmtMetric(row.copperCost, 3)}</td>
        <td class="wire-number-cell wire-money-cell">${fmtMoney(row.currentUnitPrice, 3)}</td>
        <td class="wire-number-cell wire-money-cell">${fmtMoney(row.currentAmount, 2)}</td>
      </tr>
    `;
  }).join('');
}

/* Legacy duplicate kept only for reference during recovery; disabled so the
   full-catalog implementation above remains the single active renderer.
renderWireCatalog legacy backup:
  if (!el.wireModelSummary || !el.wireCalcNote || !el.wireModelTable) return;
  if (!WIRE_MODELS.length) {
    el.wireModelSummary.innerHTML = '<div class="wire-model-stat"><div class="label">导线型号</div><div class="value">0 个</div><div class="meta">当前未导入导线目录</div></div>';
    el.wireCalcNote.textContent = '当前未加载导线型号联动数据。';
    if (el.wireTableStatus) el.wireTableStatus.textContent = '暂无导线型号数据。';
    el.wireModelTable.innerHTML = '<tr><td colspan="10" class="wire-empty-cell">当前未加载导线型号数据。</td></tr>';
    return;
  }

  const requestedUsage = requestedWireUsageKey();
  const bomLabel = versionOptionLabel('bom', state.bom) || wireUsageLabel(requestedUsage);
  const copperPrice = Number(m.d.copperPrice) || 0;
  const aluminumPrice = Number(m.d.aluminumPrice) || 0;
  const rows = WIRE_MODELS.map((row) => {
    const weights = row.weights || {};
    const usage = resolveWireUsage(row, requestedUsage);
    const aluminumWeight = Number(weights.aluminum) || 0;
    const copperWeight = Number(weights.copper) || 0;
    const nonCopper = Number(weights.nonCopper) || 0;
    const aluminumCost = (aluminumWeight / 1000000) * aluminumPrice;
    const copperCost = (copperWeight / 1000000) * copperPrice;
    const currentUnitPrice = aluminumCost + copperCost + (nonCopper / 1000);
    const currentAmount = currentUnitPrice * usage.value;
    return {
      ...row,
      usageKey: usage.key,
      usageValue: usage.value,
      aluminumWeight,
      copperWeight,
      nonCopper,
      aluminumCost,
      copperCost,
      currentUnitPrice,
      currentAmount,
    };
  }).sort((left, right) => {
    const leftActive = left.usageValue > 0 ? 1 : 0;
    const rightActive = right.usageValue > 0 ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    if (Math.abs(right.currentAmount - left.currentAmount) > 0.0001) return right.currentAmount - left.currentAmount;
    return String(left.code || '').localeCompare(String(right.code || ''), 'zh-CN');
  });

  const totalModels = rows.length;
  const activeRows = rows.filter((row) => row.usageValue > 0);
  const activeCount = activeRows.length;
  const inactiveCount = totalModels - activeCount;
  const sourceRows = activeRows.length ? activeRows : rows;
  const totalUsage = activeRows.reduce((sum, row) => sum + row.usageValue, 0);
  const totalAmount = activeRows.reduce((sum, row) => sum + row.currentAmount, 0);
  const inferredRows = rows.filter((row) => row.weightSource?.inferred);
  const sourceCounts = sourceRows.reduce((acc, row) => {
    acc[row.usageKey] = (acc[row.usageKey] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(sourceCounts)
    .map(([key, count]) => `${wireUsageLabel(key)} ${count}项`)
    .join(' / ');
  const sourceBooks = [WIRE_CATALOG.meta?.ttSourceWorkbook, WIRE_CATALOG.meta?.fixedSourceWorkbook, WIRE_CATALOG.meta?.quoteSourceWorkbook]
    .filter(Boolean)
    .join(' / ');
  const summaryCards = [
    ['导线目录', `${totalModels} 个`, '按当前项目已导入的全部导线型号展示'],
    ['当前 BOM', `${bomLabel} / 启用 ${activeCount} 个`, activeCount ? `实际取数 ${sourceSummary || wireUsageLabel(requestedUsage)}` : '当前版本未启用导线用量'],
    ['版本覆盖', `${activeCount}/${totalModels} 型号启用`, inactiveCount ? `${inactiveCount} 个型号当前为零用量` : '全部型号已启用'],
    ['铜基价', `${fmtMoney(copperPrice, 0)} 元/吨`, m.metal.label],
    ['铝基价', `${fmtMoney(aluminumPrice, 0)} 元/吨`, m.metal.label],
    ['材料重量', `铝 ${fmtNumber(WIRE_CATALOG.summary?.totalAluminumWeight || 0, 2)} / 铜 ${fmtNumber(WIRE_CATALOG.summary?.totalCopperWeight || 0, 2)}`, `非铜 ${fmtNumber(WIRE_CATALOG.summary?.totalNonCopper || 0, 2)}`],
    ['当前导线金额', `${fmtMoney(totalAmount)} 元/套`, inferredRows.length ? `当前用量 ${fmtNumber(totalUsage, 2)} / 推算 ${inferredRows.length} 项` : `当前用量 ${fmtNumber(totalUsage, 2)}`],
  ];
  el.wireModelSummary.innerHTML = summaryCards.map(([label, value, meta]) => `
    <div class="wire-model-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
  `).join('');

  const inferredNote = inferredRows.length ? `当前有 ${inferredRows.length} 项按模板规则推算，表内已标注。` : '';
  el.wireCalcNote.innerHTML = `单价规则：铝重 × 当前铝价 / 1,000,000 + 铜重 × 当前铜价 / 1,000,000 + 非铜 / 1000。数据来源：${escapeHtml(sourceBooks || '导线联动核算表')}。当前 BOM 口径：${escapeHtml(bomLabel)}；实际启用来源：${escapeHtml(sourceSummary || wireUsageLabel(requestedUsage))}。${escapeHtml(inferredNote)}`;

  if (el.wireTableStatus) {
    el.wireTableStatus.innerHTML = `
      <span class="wire-table-status-count">${totalModels} 型号 · ${activeCount} 已启用 · ${inactiveCount} 零用量保留展示</span>
      <span class="wire-table-status-note">当前版本未用到的型号不再隐藏，方便核对 26 个型号的完整性</span>
    `;
  }

  el.wireModelTable.innerHTML = rows.map((row) => {
    const metaBits = [row.supplier, row.sap ? `SAP ${row.sap}` : '', row.priceType].filter(Boolean);
    const weightLabel = row.weightSource?.label || '';
    const weightNote = row.weightSource?.note || '';
    const templateCode = row.weightSource?.templateCode || '';
    const isActive = row.usageValue > 0;
    const usageLabelText = wireUsageLabel(row.usageKey);
    const usageNote = isActive
      ? `<div class="wire-cell-note">${escapeHtml(usageLabelText)}</div>`
      : `<div class="wire-cell-note wire-cell-note--inactive">当前版本未启用 · ${escapeHtml(usageLabelText)}</div>`;
    return `
      <tr class="wire-row${isActive ? '' : ' wire-row-inactive'}" data-wire-status="${isActive ? 'active' : 'inactive'}">
        <td class="wire-model-cell">
          <div class="wire-model-main">
            <strong>${escapeHtml(row.code || '-')}</strong>
            <span>${escapeHtml(row.name || '-')}</span>
          </div>
          <div class="wire-inline-meta">${metaBits.map((text) => `<span>${escapeHtml(text)}</span>`).join('')}</div>
          ${weightLabel ? `<div class="wire-cell-note" title="${escapeHtml(weightNote)}">${escapeHtml(weightLabel)}${templateCode ? ` 路 ${escapeHtml(templateCode)}` : ''}</div>` : ''}
        </td>
        <td>
          <div class="wire-family-stack">
            <span class="wire-family-chip">${escapeHtml(row.relationLabel || row.materialFamily || '-')}</span>
            <span class="wire-cell-note">${escapeHtml(row.materialFamily || '-')}</span>
          </div>
        </td>
        <td class="wire-number-cell">
          <div class="wire-number-main${isActive ? '' : ' wire-number-muted'}">${fmtNumber(row.usageValue, 2)}</div>
          ${usageNote}
        </td>
        <td class="wire-number-cell">${fmtMetric(row.aluminumWeight, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.copperWeight, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.nonCopper, 2)}</td>
        <td class="wire-number-cell">${fmtMetric(row.aluminumCost, 3)}</td>
        <td class="wire-number-cell">${fmtMetric(row.copperCost, 3)}</td>
        <td class="wire-number-cell wire-money-cell">${fmtMoney(row.currentUnitPrice, 3)}</td>
        <td class="wire-number-cell wire-money-cell">${fmtMoney(row.currentAmount, 2)}</td>
      </tr>
    `;
  }).join('');
}
*/

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
  const stageCounts = summary.stageCounts || { quote: 0, fixed: 0, progress: 0 };
  const deltaClass = summary.deltaCost > 0 ? 'delta-up' : summary.deltaCost < 0 ? 'delta-down' : 'delta-flat';
  const stats = [
    `默认执行 <strong>${summary.defaultLabel || BASE.versions.connector[state.connector].label}</strong>`,
    `跟随默认 <strong>${summary.followCount || 0}</strong>`,
    `逐项覆盖 <strong>${summary.overrideCount || 0}</strong>`,
    `报价版 <strong>${stageCounts.quote || 0}</strong>`,
    `定点版 <strong>${stageCounts.fixed || 0}</strong>`,
    `进度价 <strong>${stageCounts.progress || 0}</strong>`,
    `连接器成本 <strong>${fmtMoney(summary.totalCurrentCost || 0)}</strong> 元/套`,
    `相对基准 <strong class="${deltaClass}">${fmtSignedMoney(summary.deltaCost || 0)}</strong> 元/套`,
  ];
  el.connectorExecutionStats.innerHTML = stats.map((text) => `<span class="stat-pill">${text}</span>`).join('');

  el.connectorPriceTable.innerHTML = protocolRows.map((row) => {
    const assemblyNo = protocolAssemblyNo(row);
    const assemblyMeta = protocolAssemblyMeta(row);
    const partDetail = renderProtocolPartDetail(row);
    const supplierLabel = row?.supplierRaw || row?.supplier || '-';
    const protocolPrice = fmtMaybeMoney(row?.targetProtocolPrice);
    const progressPrice = fmtMaybeMoney(row?.replyPrice);
    const initialQuote = fmtMaybeMoney(protocolRowInitialQuote(row));
    const initialQuoteTitle = row?.initialQuoteSource || '报价核算《二次物料明细》未匹配到对应总成';
    const statusLabel = protocolStatusLabel(row?.statusKey, row?.statusLabel || '未配置');
    const statusClass = protocolStatusConfig[row?.statusKey]?.className || 'blank';

    return `<tr>
      <td class="connector-assembly-cell">
        <div class="connector-assembly-code" title="${escapeHtml(assemblyNo)}">${escapeHtml(assemblyNo)}</div>
        ${assemblyMeta ? `<div class="subtle connector-assembly-meta" title="${escapeHtml(row?.functionRaw || assemblyMeta)}">${escapeHtml(assemblyMeta)}</div>` : ''}
        ${partDetail}
      </td>
      <td class="connector-supplier-cell">${escapeHtml(supplierLabel)}</td>
      <td class="connector-number-cell">${protocolPrice}</td>
      <td class="connector-number-cell">${progressPrice}</td>
      <td class="connector-number-cell" title="${escapeHtml(initialQuoteTitle)}">${initialQuote}</td>
      <td class="connector-status-cell"><span class="protocol-count-pill ${statusClass}">${escapeHtml(statusLabel)}</span></td>
      <td class="connector-mark-cell">${protocolStatusMark(row, 'confirmed')}</td>
      <td class="connector-mark-cell">${protocolStatusMark(row, 'quoted_pending')}</td>
      <td class="connector-mark-cell">${protocolStatusMark(row, 'dev_pending')}</td>
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
  el.layerDataCount.textContent = '11 个文件';
  el.layerDataMeta.textContent = ['g281_data_master.json', 'g281_data_bom_changes.json', 'g281_data_bom_validation.json', 'g281_data_bom_versions.json', 'g281_data_capital_validation.json', 'g281_data_labor_validation.json', 'g281_data_packaging_validation.json', 'g281_data_connector_protocol_status.json', 'g281_data_wire_catalog.json', 'g281_data_history.json', 'g281_data_approvals.json'].join(' / ');
  el.layerEngineMeta.textContent = `${m.engineLayer} / pure compute / 无 DOM 依赖`;
  el.layerHistoryCount.textContent = `${history.length} 条`;
  el.layerHistoryMeta.textContent = `seed ${seedHistoryCount} + 自定义 ${extraHistoryCount}`;
  el.layerApprovalCount.textContent = `${approvals.length} 条`;
  el.layerApprovalMeta.textContent = `seed ${seedApprovalCount} + 自定义 ${extraApprovalCount}`;

  el.historyTable.innerHTML = history.map((record) => {
    const preview = historyPreview(record);
    const stateText = [
      versionOptionLabel('bom', record.state?.bom),
      versionOptionLabel('metal', recordMetalVersionKey(record)),
      versionOptionLabel('connector', record.state?.connector),
      versionOptionLabel('labor', record.state?.labor),
      versionOptionLabel('equipment', record.state?.equipment),
      versionOptionLabel('packaging', record.state?.packaging),
      versionOptionLabel('sales', record.state?.sales),
      versionOptionLabel('mix', record.state?.mix),
      versionOptionLabel('vave', record.state?.vave),
    ].filter(Boolean).join(' / ');
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
  const quoteMaterialBase = Number(FINANCIAL_VERSIONS?.versions?.quote?.perSet?.material) || Number(BASE.baseMaterial) || 0;
  const connectorImpact = `${((m.conn.effectiveFactor - 1) * 100).toFixed(1)}% / 默认 ${m.conn.label} / 覆盖 ${m.connectorSummary?.overrideCount || 0} 项`;
  const rows=[
    ['BOM',m.bom.label,`${((m.material/quoteMaterialBase-1)*100).toFixed(1)}% 材料变动`],
    ['铜铝基价',m.metal.label,`铜 ${fmtMoney(m.d.copperPrice,0)} 元/吨 / 铝 ${fmtMoney(m.d.aluminumPrice,0)} 元/吨`],
    ['连接器',m.conn.label,connectorImpact],
    ['工时',m.labor.label,`${((m.labor.factor-1)*100).toFixed(1)}% 费率/工时`],
    ['设备',m.equip.label,`${((m.equip.factor-1)*100).toFixed(1)}% 设备分摊`],
    ['包装物流',m.pack.label,`${((m.pack.factor-1)*100).toFixed(1)}% 包装费率`],
    ['年降',m.annualDrop?.label || '-',annualDropSnapshotSummary(m.annualDrop)],
    ['一次性费用',m.oneTimeCustomer?.label || '-',oneTimeCustomerSnapshotSummary(m.oneTimeCustomer)],
    ['返点',m.rebate?.label || '-',rebateSnapshotSummary(m.rebate)],
    ['VAVE',m.vave.label,`${fmtMoney(m.vave.savings)} 元/套`]
  ];
  el.eventTable.innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
}

function renderCompare(m){
  el.compareTable.innerHTML=m.compare.map(([label,base,current])=>{const diff=current-base,isPct=label==='毛利率',isVol=label==='回收销量';return `<tr><td>${label}</td><td>${isVol?fmtMaybeInt(base):isPct?fmtPct(base):fmtMoney(base)}</td><td>${isVol?fmtMaybeInt(current):isPct?fmtPct(current):fmtMoney(current)}</td><td class="${diff>=0?'positive':'negative'}">${isVol?fmtMaybeInt(diff):isPct?fmtPct(diff):fmtMoney(diff)}</td></tr>`}).join('');
}

function renderCapital(m){
  const capital = m.capitalBreakdown || {};
  const rows=[['设备资源',capital.equipment || 0,m.totalVolume ? (capital.equipment || 0)/m.totalVolume : 0],['专用模具',capital.tooling || 0,m.totalVolume ? (capital.tooling || 0)/m.totalVolume : 0],['工装投入',capital.fixtures || 0,m.totalVolume ? (capital.fixtures || 0)/m.totalVolume : 0],['研发费用',capital.rnd || 0,m.totalVolume ? (capital.rnd || 0)/m.totalVolume : 0],['合计',m.capitalTotal,m.capitalPerSet]];
  el.capitalLedger.innerHTML=rows.map(r=>`<div class="ledger-item"><div class="name">${r[0]}</div><div class="meta"><div>${fmtMoney(r[1])} 元</div><div>${fmtMoney(r[2])} 元 / 套</div></div></div>`).join('');
}

function renderAnnualTable(m){
  el.annualTable.innerHTML=m.annual.map(r=>`<tr><td>${r.year}</td><td>${fmtInt(r.volume)}</td><td>${fmtMoney(r.asp)}</td><td>${fmtMoney(r.revenue)}</td><td>${fmtMoney(m.operating)}</td><td>${fmtMoney(r.cost)}</td><td class="${r.profit>=0?'positive':'negative'}">${fmtMoney(r.profit)}</td><td class="${r.margin>=0?'positive':'negative'}">${fmtPct(r.margin)}</td></tr>`).join('');
}

function ensureProfitInsights() {
  if (profitInsightsView || !el.profitInsightsMount || !window.g281ProfitInsights?.init) return;
  profitInsightsView = window.g281ProfitInsights.init('g281-profit-insights', el.profitInsightsMount, {
    onTargetMarginChange: setCustomTargetMarginPercent,
    onTargetMarginReset: () => resetCustomTargetMarginPercent(),
  });
}

function describeTargetPriceConvergence(targetPrice, requestedMarginPercent) {
  const convergence = targetPrice?.convergence || {};
  const marginText = `${fmtNumber(requestedMarginPercent, 2)}%`;
  if (convergence.reason === 'already_at_target') {
    return {
      statusLabel: '已满足',
      note: `当前场景毛利率已满足目标毛利率 ${marginText}，无需调整售价。`,
    };
  }
  if (convergence.reason === 'converged') {
    return {
      statusLabel: '已收敛',
      note: `已按目标毛利率 ${marginText} 完成反推。`,
    };
  }
  if (convergence.reason === 'tolerance_on_factor') {
    return {
      statusLabel: '近似收敛',
      note: `已在精度阈值内停止，结果接近目标毛利率 ${marginText}。`,
    };
  }
  if (convergence.reason === 'target_not_bracketed') {
    return {
      statusLabel: '待复核',
      note: `未找到完整求解区间，已返回最接近目标毛利率 ${marginText} 的售价，请人工复核。`,
    };
  }
  return {
    statusLabel: convergence.success ? '已收敛' : '待计算',
    note: convergence.reason || '',
  };
}

function computeProfitInsightsPayload(model) {
  if (!window.G281TargetPriceSolver?.solveTargetPrice || !window.G281ProfitShapley?.compute) {
    return null;
  }
  const scenarioState = { ...(model?.stateSnapshot || currentScenarioStateSnapshot()) };
  const draft = model?.d ? JSON.parse(JSON.stringify(model.d)) : readDraft();
  const cacheKey = insightPayloadKey(draft, scenarioState);
  if (profitInsightsCacheKey === cacheKey && profitInsightsCacheValue) {
    return profitInsightsCacheValue;
  }

  const hasCustomTargetMargin = Number.isFinite(customTargetMarginPercent);
  const targetPrice = window.G281TargetPriceSolver.solveTargetPrice(RUNTIME, draft, scenarioState, {
    metric: 'margin',
    ...(hasCustomTargetMargin ? { targetValue: customTargetMarginPercent / 100 } : {}),
  });
  const shapley = window.G281ProfitShapley.compute({
    engine: window.G281Engine,
    runtime: RUNTIME,
    draft,
    scenarioState,
  });

  const baselineASP = averageAsp(targetPrice.baselineModel);
  const currentASP = averageAsp(targetPrice.currentModel);
  const requiredASP = averageAsp(targetPrice.solvedModel);
  const annualAspSeries = Array.isArray(targetPrice.effectiveAnnualAspSeries) ? targetPrice.effectiveAnnualAspSeries : [];
  const requestedMarginPercent = (Number(targetPrice.targetValue) || 0) * 100;
  const convergenceMeta = describeTargetPriceConvergence(targetPrice, requestedMarginPercent);
  const sparkline = (RUNTIME.master?.years || []).map((year, index) => {
    const asp = Number(annualAspSeries[index]) || 0;
    return `${year}:${fmtMoney(asp)}`;
  }).join(' / ');

  const payload = {
    targetPrice: {
      scenarioName: draft.scenarioName || BASE.name,
      varianceLabel: targetPrice.metric === 'margin' ? '目标毛利率反推售价' : '保持报价总利润',
      targetMode: hasCustomTargetMargin ? 'custom' : 'baseline',
      targetModeLabel: hasCustomTargetMargin ? '自定义目标毛利率' : '保持报价毛利率',
      currentASP,
      requiredASP,
      baseASP: baselineASP,
      deltaASP: requiredASP - currentASP,
      currentMargin: (Number(targetPrice.currentModel?.margin) || 0) * 100,
      baseMargin: (Number(targetPrice.baselineModel?.margin) || 0) * 100,
      requestedMargin: requestedMarginPercent,
      requiredMargin: (Number(targetPrice.solvedModel?.margin) || 0) * 100,
      currentMetric: Number(targetPrice.currentMetric) || 0,
      baselineMetric: Number(targetPrice.baselineMetric) || 0,
      achievedMetric: Number(targetPrice.achievedMetric) || 0,
      statusLabel: convergenceMeta.statusLabel,
      note: convergenceMeta.note,
      convergence: targetPrice.convergence || null,
      sparkline,
    },
    shapley: {
      title: 'Shapley 利润归因',
      subtitle: '相对全报价版本的利润率变化占比',
      baselineMargin: (Number(shapley.baseline?.margin) || 0) * 100,
      scenarioMargin: (Number(shapley.scenario?.margin) || 0) * 100,
      totalDelta: (Number(shapley.delta) || 0) * 100,
      items: (shapley.contributions || []).map((item) => ({
        key: item.key,
        label: item.label,
        value: (Number(item.marginContribution) || 0) * 100,
        share: Number(item.share) || 0,
        from: item.baseState,
        to: item.scenarioState,
      })),
    },
  };


    // --- Issue #3: 计算因果链瀑布图 ---
    if (window.G281WaterfallCausal) {
      const waterfallData = window.G281WaterfallCausal.computeCausalWaterfall({
        engine: window.G281Engine,
        runtime: RUNTIME,
        baselineState: shapley.baseline.state,
        baselineDraft: shapley.baseline.draft,
        scenarioState: shapley.scenario.state,
        scenarioDraft: shapley.scenario.draft,
        factors: window.G281WaterfallCausal.CAUSAL_ORDER.map(f => {
          const shapleyFactor = window.G281ProfitShapley.defaultFactors.find(sf => sf.key === f.key);
          return { ...f, draftKeys: shapleyFactor?.draftKeys || [] };
        }),
      });
      payload.waterfall = {
        html: window.G281WaterfallCausal.renderWaterfallHTML(waterfallData),
        data: waterfallData,
      };
    }
  profitInsightsCacheKey = cacheKey;
  profitInsightsCacheValue = payload;
  return payload;
}

function renderProfitInsights(model) {
  ensureProfitInsights();
  if (!profitInsightsView) return;
  const payload = computeProfitInsightsPayload(model);
  if (!payload) return;
  profitInsightsView.renderTargetPrice(payload.targetPrice);
  profitInsightsView.renderShapleyWaterfall(payload.shapley);
  if (payload.waterfall) {
    profitInsightsView.renderWaterfall(payload.waterfall);
  }
}

function compareRowSnapshot(model, index) {
  const rows = Array.isArray(model?.compare) ? model.compare : [];
  const row = Array.isArray(rows[index]) ? rows[index] : [];
  return {
    label: row[0] || '',
    base: coerceNumber(row[1], 0),
    current: coerceNumber(row[2], 0),
  };
}

function formatSignedPoints(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)} pt`;
}

function formatSignedCurrency(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${numeric >= 0 ? '+' : '-'}${fmtMoney(Math.abs(numeric), digits)}`;
}

function changeTone(value, epsilon = 0.005) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) < epsilon) return 'neutral';
  return numeric > 0 ? 'positive' : 'negative';
}

function changeFactorMode(item) {
  const from = toText(item?.from);
  const to = toText(item?.to);
  if (from && to && from !== to) return 'version';
  if (Math.abs(Number(item?.value) || 0) >= 0.005) return 'input';
  return 'steady';
}

function changeFactorMeta(key, model, item) {
  if (key === 'bom') {
    const summary = model?.bomSummary || {};
    return `替换 ${fmtInt(summary.replaceCount || 0)} / 新增 ${fmtInt(summary.addCount || 0)} / 取消 ${fmtInt(summary.cancelCount || 0)}`;
  }
  if (key === 'metal') {
    return `铜 ${fmtMoney(model?.d?.copperPrice || 0, 0)} 元/吨 / 铝 ${fmtMoney(model?.d?.aluminumPrice || 0, 0)} 元/吨`;
  }
  if (key === 'connector') {
    return `覆盖 ${fmtInt(model?.connectorSummary?.overrideCount || 0)} 项 / 当前 ${fmtMoney(model?.connectorSummary?.totalCurrentCost || 0)} 元/套`;
  }
  if (key === 'labor') {
    return `直接 ${fmtMoney(model?.directLabor || 0)} / 制造 ${fmtMoney(model?.manufacturing || 0)} 元/套`;
  }
  if (key === 'equipment') {
    return `资源投入 ${fmtMoney(model?.equipment || 0)} / 研发 ${fmtMoney(model?.rnd || 0)} 元/套`;
  }
  if (key === 'packaging') {
    return `包装物流 ${fmtMoney(model?.packaging || 0)} 元/套`;
  }
  if (key === 'sales') {
    return `生命周期销量 ${fmtInt(model?.totalVolume || 0)} 套`;
  }
  if (key === 'mix') {
    return `售价系数 ${fmtNumber(model?.mixPrice || 0, 4)}x / 成本系数 ${fmtNumber(model?.mixCost || 0, 4)}x`;
  }
  if (key === 'annualDrop') {
    return annualDropSnapshotSummary(model?.annualDrop);
  }
  if (key === 'oneTimeCustomer') {
    return oneTimeCustomerSnapshotSummary(model?.oneTimeCustomer);
  }
  if (key === 'rebate') {
    return rebateSnapshotSummary(model?.rebate);
  }
  if (key === 'vave') {
    return `VAVE ${fmtMoney(model?.vave?.savings || 0)} 元/套`;
  }
  return `${toText(item?.from, '-')} → ${toText(item?.to, '-')}`;
}

function computeChangeVisualizationPayload(model) {
  const insight = computeProfitInsightsPayload(model);
  const unitRevenue = compareRowSnapshot(model, 0);
  const unitCost = compareRowSnapshot(model, 1);
  const unitProfit = compareRowSnapshot(model, 2);
  const lifecycleProfit = compareRowSnapshot(model, 5);
  const margin = compareRowSnapshot(model, 6);
  const bomSummary = model?.bomSummary || {};
  const shapleyItems = Array.isArray(insight?.shapley?.items) ? insight.shapley.items : [];
  const factors = shapleyItems
    .map((item) => {
      const value = Number(item?.value) || 0;
      const mode = changeFactorMode(item);
      return {
        key: item.key || '',
        label: item.label || item.key || '-',
        from: toText(item?.from, '-'),
        to: toText(item?.to, '-'),
        value,
        share: Number(item?.share) || 0,
        mode,
        changed: mode !== 'steady',
        meta: changeFactorMeta(item?.key, model, item),
      };
    })
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  const visibleFactors = factors.filter((item) => item.changed);
  const factorRows = visibleFactors.length ? visibleFactors : factors;
  const maxFactorAbs = factorRows.reduce((max, item) => Math.max(max, Math.abs(item.value)), 0) || 1;
  const bomChangeCount = coerceNumber(bomSummary.replaceCount, 0) + coerceNumber(bomSummary.addCount, 0) + coerceNumber(bomSummary.cancelCount, 0);
  const changedFactorCount = visibleFactors.length;
  const targetPrice = insight?.targetPrice || null;
  const financialContext = model?.financialContext || {};
  const summary = [
    {
      label: '已变更要素',
      value: fmtInt(changedFactorCount),
      meta: `共 ${fmtInt(factors.length)} 个成本因子参与归因`,
      tone: changedFactorCount ? 'positive' : 'neutral',
    },
    {
      label: 'BOM 变更项',
      value: fmtInt(bomChangeCount),
      meta: `替换 ${fmtInt(bomSummary.replaceCount || 0)} / 新增 ${fmtInt(bomSummary.addCount || 0)} / 取消 ${fmtInt(bomSummary.cancelCount || 0)}`,
      tone: bomChangeCount ? 'negative' : 'neutral',
    },
    {
      label: '单套成本变化',
      value: formatSignedCurrency(unitCost.current - unitCost.base),
      meta: `当前 ${fmtMoney(unitCost.current)} / 基准 ${fmtMoney(unitCost.base)}`,
      tone: changeTone(unitCost.current - unitCost.base),
    },
    {
      label: '生命周期利润变化',
      value: formatSignedCurrency(lifecycleProfit.current - lifecycleProfit.base),
      meta: `当前 ${fmtMoney(lifecycleProfit.current)} / 基准 ${fmtMoney(lifecycleProfit.base)}`,
      tone: changeTone(lifecycleProfit.current - lifecycleProfit.base, 1),
    },
    {
      label: '毛利率变化',
      value: formatSignedPoints((margin.current - margin.base) * 100),
      meta: `当前 ${fmtPct(margin.current)} / 基准 ${fmtPct(margin.base)}`,
      tone: changeTone((margin.current - margin.base) * 100, 0.01),
    },
  ];
  const bomRows = [
    {
      label: '替换',
      value: fmtInt(bomSummary.replaceCount || 0),
      meta: `配置影响 ${fmtInt(bomSummary.configCount || 0)} 项`,
    },
    {
      label: '新增',
      value: fmtInt(bomSummary.addCount || 0),
      meta: `呆滞数量 ${fmtInt(bomSummary.obsoleteQty || 0)} 套`,
    },
    {
      label: '取消',
      value: fmtInt(bomSummary.cancelCount || 0),
      meta: `呆滞金额 ${fmtMoney(bomSummary.obsoleteValue || 0)}`,
    },
    {
      label: '单套利润变化',
      value: formatSignedCurrency(unitProfit.current - unitProfit.base),
      meta: `收入 ${formatSignedCurrency(unitRevenue.current - unitRevenue.base)} / 成本 ${formatSignedCurrency(unitCost.current - unitCost.base)}`,
    },
  ];
  const contextRows = [];
  if (targetPrice) {
    contextRows.push(
      `${targetPrice.targetModeLabel || '目标毛利率'} ${fmtNumber(targetPrice.requestedMargin || 0, 2)}%，所需 ASP ${fmtMoney(targetPrice.requiredASP)} / 套，较当前 ${formatSignedCurrency(targetPrice.deltaASP)}。`
    );
  }
  if (financialContext.exactApplied) {
    contextRows.push(`当前命中核算口径：${toText(financialContext.exactLabel || financialContext.exactKey, '未命名版本')}。`);
  } else {
    contextRows.push(`当前按 ${toText(financialContext.referenceLabel || financialContext.referenceKey, '参考版本')} 做推演。`);
  }
  if (Array.isArray(financialContext.warnings) && financialContext.warnings.length) {
    financialContext.warnings.slice(0, 3).forEach((warning) => {
      contextRows.push(String(warning));
    });
  } else {
    contextRows.push(
      changedFactorCount
        ? `当前最显著的利润率变化来自 ${factorRows[0]?.label || '核心成本因子'}。`
        : '当前场景与报价基准没有形成显著变更。'
    );
  }
  if (Array.isArray(bomSummary.configList) && bomSummary.configList.length) {
    contextRows.push(`受影响配置：${bomSummary.configList.join(' / ')}`);
  }
  return {
    pill: {
      value: formatSignedPoints((margin.current - margin.base) * 100),
      tone: changeTone((margin.current - margin.base) * 100, 0.01),
    },
    summary,
    factors: factorRows,
    maxFactorAbs,
    bomRows,
    configList: Array.isArray(bomSummary.configList) ? bomSummary.configList : [],
    contextRows,
  };
}

function renderChangeVisualization(model) {
  if (!el.changeVisualSummary || !el.changeVisualFactorList || !el.changeVisualBom || !el.changeVisualContext) {
    return;
  }
  const payload = computeChangeVisualizationPayload(model);
  if (el.changeVisualDeltaPill) {
    el.changeVisualDeltaPill.textContent = payload.pill.value;
    el.changeVisualDeltaPill.dataset.tone = payload.pill.tone;
  }
  el.changeVisualSummary.innerHTML = payload.summary.map((card) => `
    <article class="change-visual-summary-card" data-tone="${escapeHtml(card.tone || 'neutral')}">
      <div class="label">${escapeHtml(card.label)}</div>
      <div class="value">${escapeHtml(card.value)}</div>
      <div class="meta">${escapeHtml(card.meta)}</div>
    </article>
  `).join('');

  if (!payload.factors.length) {
    el.changeVisualFactorList.innerHTML = '<div class="change-visual-empty">当前没有可展示的显著变更因子。</div>';
  } else {
    el.changeVisualFactorList.innerHTML = payload.factors.map((item) => {
      const width = Math.max(6, Math.round((Math.abs(item.value) / payload.maxFactorAbs) * 50));
      const tone = item.value >= 0 ? 'positive' : 'negative';
      const modeLabel = item.mode === 'version' ? '版本切换' : item.mode === 'input' ? '录入变化' : '未变化';
      const versionText = item.from === item.to ? item.to : `${item.from} → ${item.to}`;
      return `
        <article class="change-factor-row">
          <div class="change-factor-label">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="change-factor-meta">${escapeHtml(versionText)}</span>
            <span class="change-factor-meta">${escapeHtml(item.meta)}</span>
          </div>
          <div class="change-factor-track" aria-hidden="true">
            <span class="change-factor-fill ${tone}" style="width:${width}%"></span>
          </div>
          <div class="change-factor-value">
            <span class="change-factor-chip ${escapeHtml(item.mode)}">${escapeHtml(modeLabel)}</span>
            <strong>${escapeHtml(formatSignedPoints(item.value))}</strong>
            <span>${escapeHtml(fmtPct(item.share, 1))}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  el.changeVisualBom.innerHTML = `
    <div class="change-visual-bom-grid">
      ${payload.bomRows.map((row) => `
        <div class="change-visual-bom-item">
          <div class="label">${escapeHtml(row.label)}</div>
          <div class="value">${escapeHtml(row.value)}</div>
          <div class="meta">${escapeHtml(row.meta)}</div>
        </div>
      `).join('')}
    </div>
    ${payload.configList.length ? `<div class="change-visual-config-list">${payload.configList.map((value) => `<span class="mini-tag">${escapeHtml(value)}</span>`).join('')}</div>` : ''}
  `;
  el.changeVisualContext.innerHTML = `<div class="change-visual-context-list">${payload.contextRows.map((row) => `<div class="change-visual-context-row">${escapeHtml(row)}</div>`).join('')}</div>`;
}
