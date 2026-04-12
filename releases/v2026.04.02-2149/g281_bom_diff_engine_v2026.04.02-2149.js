(function (global) {
  'use strict';

  const clonePlain = (value, fallback = null) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };

  const toText = (value, fallback = '') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };

  const toNumber = (value, fallback = NaN) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const ensureArray = (value) => (Array.isArray(value) ? value : []);
  const collapseText = (value) => toText(value, '').replace(/\s+/g, ' ').trim();

  const joinedText = (...values) => values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => collapseText(value))
    .filter(Boolean)
    .join(' | ');

  const normalizeGauge = (value) => {
    const numeric = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric)) return '';
    return `${Math.abs(numeric - Math.round(numeric)) < 1e-9 ? Math.round(numeric) : numeric}平方`;
  };

  const detectWireSize = (text) => {
    const match = /(\d+(?:\.\d+)?)\s*(?:MM2|MM²|㎟|平方|方|SQ(?:MM)?)/i.exec(text || '');
    return match ? normalizeGauge(match[1]) : '';
  };

  const detectPoleCount = (text) => {
    const match = /(\d+)\s*(?:P|PIN|WAY|孔|芯)/i.exec(text || '');
    return match ? `${match[1]}P` : '';
  };

  const detectShielding = (text) => {
    const source = String(text || '');
    if (/无屏蔽|非屏蔽|UNSHIELDED/i.test(source)) return '无屏蔽';
    if (/屏蔽|SHIELD/i.test(source)) return '屏蔽';
    return '';
  };

  const detectWaterproof = (text) => {
    const source = String(text || '');
    if (/非防水|非密封|UNSEALED/i.test(source)) return '非防水';
    if (/防水|密封|SEALED|WATERPROOF/i.test(source)) return '防水';
    return '';
  };

  const detectLength = (text, qty, unit) => {
    const match = /(?:L=)?(\d+(?:\.\d+)?)\s*(MM|CM|M)/i.exec(text || '');
    if (match) return `${match[1]}${String(match[2]).toUpperCase()}`;
    if (Number.isFinite(Number(qty)) && /^(MM|CM|M)$/i.test(String(unit || '').trim())) {
      return `${Number(qty)}${String(unit).toUpperCase()}`;
    }
    return '';
  };

  const detectConductor = (text) => {
    const source = String(text || '');
    if (/铜包铝|CCA/i.test(source)) return '铜包铝';
    if (/镀锡铜|铜/i.test(source)) return '铜';
    if (/铝/i.test(source)) return '铝';
    return '';
  };

  const detectCategory = (group = {}, row = {}) => {
    const itemCategory = toText(group?.itemCategory, '');
    const text = joinedText(
      row?.left?.partName,
      row?.right?.partName,
      row?.left?.functionName,
      row?.right?.functionName,
      row?.left?.spec,
      row?.right?.spec,
    ).toUpperCase();
    if (itemCategory === 'connector') return 'CONNECTOR';
    if (itemCategory === 'terminal' || itemCategory === 'ipt_terminal') return 'TERMINAL';
    if (itemCategory === 'wire') return 'CABLE';
    if (itemCategory === 'tape_tube') return 'PROTECTION';
    if (itemCategory === 'bracket_rubber') {
      if (/扎带|卡扣|卡子|CLIP|TIE|FASTENER|支架|BRACKET/i.test(text)) return 'FASTENER';
      return 'PROTECTION';
    }
    if (/波纹管|热缩管|编织|套管|胶带|TUBE|TAPE/i.test(text)) return 'PROTECTION';
    if (/扎带|卡扣|卡子|CLIP|TIE|FASTENER|支架|BRACKET/i.test(text)) return 'FASTENER';
    return 'OTHER';
  };

  const buildFeatureSnapshot = (item = {}) => {
    const text = joinedText(item.partName, item.functionName, item.spec);
    return {
      wireSize: detectWireSize(text),
      poleCount: detectPoleCount(text),
      shielding: detectShielding(text),
      waterproof: detectWaterproof(text),
      length: detectLength(text, item.qty, item.unit),
      conductor: detectConductor(text),
    };
  };

  const diffDetail = (label, leftValue, rightValue) => `${label}: ${leftValue || '-'} -> ${rightValue || '-'}`;

  const classifyDiff = (group = {}, row = {}) => {
    if (row.rowType === 'assembly_to_parts') {
      return { diffType: 'ASSEMBLY_EXPANDED', changeDetail: '总成展开为散件', riskLevel: 'Medium' };
    }
    if (row.rowType === 'left_only') {
      return { diffType: 'REMOVED', changeDetail: '旧版存在，新版删除', riskLevel: 'Medium' };
    }
    if (row.rowType === 'right_only') {
      return { diffType: 'ADDED', changeDetail: '新版新增，旧版不存在', riskLevel: 'Medium' };
    }

    const left = row.left || null;
    const right = row.right || null;
    if (!left || !right) {
      return { diffType: 'UNKNOWN', changeDetail: '', riskLevel: 'Low' };
    }

    const leftFeatures = buildFeatureSnapshot(left);
    const rightFeatures = buildFeatureSnapshot(right);
    const businessCategory = detectCategory(group, row);
    const partChanged = toText(left.partNo, '') !== toText(right.partNo, '');
    const sapChanged = toText(left.sapNo, '') !== toText(right.sapNo, '');
    const qtyChanged = Number.isFinite(Number(left.qty)) && Number.isFinite(Number(right.qty)) && Number(left.qty) !== Number(right.qty);

    if (businessCategory === 'CABLE' && leftFeatures.wireSize && rightFeatures.wireSize && leftFeatures.wireSize !== rightFeatures.wireSize) {
      return { diffType: 'WIRE_SIZE_CHANGED', changeDetail: diffDetail('线径', leftFeatures.wireSize, rightFeatures.wireSize), riskLevel: 'High' };
    }
    if (leftFeatures.poleCount && rightFeatures.poleCount && leftFeatures.poleCount !== rightFeatures.poleCount) {
      return { diffType: 'POLE_COUNT_CHANGED', changeDetail: diffDetail('孔位', leftFeatures.poleCount, rightFeatures.poleCount), riskLevel: 'High' };
    }
    if (leftFeatures.shielding && rightFeatures.shielding && leftFeatures.shielding !== rightFeatures.shielding) {
      return { diffType: 'SHIELDING_CHANGED', changeDetail: diffDetail('屏蔽', leftFeatures.shielding, rightFeatures.shielding), riskLevel: 'High' };
    }
    if (leftFeatures.waterproof && rightFeatures.waterproof && leftFeatures.waterproof !== rightFeatures.waterproof) {
      return { diffType: 'WATERPROOF_CHANGED', changeDetail: diffDetail('防水', leftFeatures.waterproof, rightFeatures.waterproof), riskLevel: 'High' };
    }
    if (leftFeatures.length && rightFeatures.length && leftFeatures.length !== rightFeatures.length) {
      return { diffType: 'LENGTH_CHANGED', changeDetail: diffDetail('长度', leftFeatures.length, rightFeatures.length), riskLevel: 'High' };
    }
    if (qtyChanged) {
      return { diffType: 'QTY_CHANGED', changeDetail: diffDetail('数量', left.qty, right.qty), riskLevel: 'Low' };
    }
    if (partChanged || sapChanged) {
      return {
        diffType: 'POSSIBLE_SUBSTITUTE',
        changeDetail: partChanged
          ? diffDetail('料号', left.partNo, right.partNo)
          : diffDetail('SAP', left.sapNo, right.sapNo),
        riskLevel: 'Medium',
      };
    }
    if (row.status === 'same') {
      return { diffType: 'SAME', changeDetail: '', riskLevel: 'Low' };
    }
    return { diffType: 'SPEC_CHANGED', changeDetail: '同类零件存在规格差异', riskLevel: 'Medium' };
  };

  const createReleasePairKey = (leftReleaseId, rightReleaseId) =>
    `${toText(leftReleaseId, 'left')}::${toText(rightReleaseId, 'right')}`;

  const mapHeader = (header) => {
    if (!header || typeof header !== 'object') return null;
    const sheetName = toText(header.sheetName, toText(header.originSheetName, ''));
    return {
      headerId: toText(header.headerId, ''),
      releaseId: toText(header.releaseId, ''),
      harnessNo: toText(header.harnessNo, ''),
      harnessName: toText(header.harnessName, ''),
      customerPartNo: toText(header.customerPartNo, ''),
      sapNo: toText(header.sapNo, ''),
      optionCode: toText(header.optionCode, ''),
      sheetName,
      originSheetName: toText(header.originSheetName, sheetName),
      rowNo: toNumber(header.rowNo, null),
    };
  };

  const mapItem = (item) => {
    if (!item || typeof item !== 'object') return null;
    return {
      itemId: toText(item.itemId, ''),
      headerId: toText(item.headerId, ''),
      releaseId: toText(item.releaseId, ''),
      harnessNo: toText(item.harnessNo, ''),
      displayOrder: toNumber(item.displayOrder, null),
      itemCategory: toText(item.itemCategory, ''),
      endGroup: toText(item.endGroup, ''),
      alignKey: toText(item.alignKey, ''),
      partNo: toText(item.partNo, ''),
      sapNo: toText(item.sapNo, ''),
      partName: toText(item.partName, ''),
      functionName: toText(item.functionName, toText(item.functionText, '')),
      spec: toText(item.spec, ''),
      qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : null,
      unit: toText(item.unit, ''),
      semiFinishedPartNo: toText(item.semiFinishedPartNo, toText(item.subPartNo, '')),
      optionCode: toText(item.optionCode, ''),
      supplier: toText(item.supplier, ''),
      singleConsumption: item.singleConsumption ?? null,
    };
  };

  const formatBundle = (items = []) => ensureArray(items)
    .map((item) => {
      const normalized = mapItem(item);
      if (!normalized) return '';
      return normalized.partNo || normalized.sapNo || normalized.partName || normalized.itemId;
    })
    .filter(Boolean)
    .join(' | ');

  const buildRowFlags = (row = {}) => {
    const left = row.left || null;
    const right = row.right || null;
    const leftQty = toNumber(left?.qty, NaN);
    const rightQty = toNumber(right?.qty, NaN);
    return {
      same: row.status === 'same',
      changed: row.status === 'changed',
      added: row.rowType === 'right_only',
      removed: row.rowType === 'left_only',
      assemblyBundle: row.rowType === 'assembly_to_parts',
      partNoChanged: Boolean(left && right && toText(left.partNo, '') !== toText(right.partNo, '')),
      sapChanged: Boolean(left && right && toText(left.sapNo, '') !== toText(right.sapNo, '')),
      qtyChanged: Boolean(left && right && Number.isFinite(leftQty) && Number.isFinite(rightQty) && leftQty !== rightQty),
      unitChanged: Boolean(left && right && toText(left.unit, '') !== toText(right.unit, '')),
    };
  };

  const mapRow = (row = {}, harnessNo, group, rowIndex) => {
    const flags = buildRowFlags(row);
    return {
      rowId: `${toText(harnessNo, 'unknown')}::${toText(group?.key, 'group')}::${String(rowIndex + 1).padStart(4, '0')}`,
      harnessNo: toText(harnessNo, ''),
      groupKey: toText(group?.key, ''),
      groupLabel: toText(group?.label, ''),
      itemCategory: toText(group?.itemCategory, ''),
      endGroup: toText(group?.endGroup, ''),
      rowType: toText(row.rowType, ''),
      status: toText(row.status, row.rowType),
      flags,
      usageDelta: clonePlain(row.usageDelta, null),
      display: {
        usageDeltaText: toText(row?.usageDelta?.text, ''),
        leftBundle: formatBundle(row.leftParts),
        rightBundle: formatBundle(row.rightParts),
      },
      left: mapItem(row.left),
      right: mapItem(row.right),
      leftParts: ensureArray(row.leftParts).map(mapItem).filter(Boolean),
      rightParts: ensureArray(row.rightParts).map(mapItem).filter(Boolean),
    };
  };

  const mapGroup = (group = {}, harnessNo) => {
    const rows = ensureArray(group.rows).map((row, index) => mapRow(row, harnessNo, group, index));
    const changedRowCount = rows.filter((row) => !row.flags.same).length;
    return {
      key: toText(group.key, ''),
      label: toText(group.label, ''),
      itemCategory: toText(group.itemCategory, ''),
      endGroup: toText(group.endGroup, ''),
      summary: {
        ...(clonePlain(group.summary, {}) || {}),
        rowCount: rows.length,
        changedRowCount,
        sameRowCount: rows.length - changedRowCount,
      },
      rows,
    };
  };

  const mapHarness = (harness = {}) => {
    const harnessNo = toText(harness.harnessNo, '');
    const groups = ensureArray(harness.groups).map((group) => mapGroup(group, harnessNo));
    const changedGroupCount = groups.filter((group) => Number(group.summary?.changedRowCount) > 0).length;
    return {
      harnessNo,
      leftHeader: mapHeader(harness.leftHeader),
      rightHeader: mapHeader(harness.rightHeader),
      summary: {
        ...(clonePlain(harness.summary, {}) || {}),
        groupCount: groups.length,
        changedGroupCount,
        sameGroupCount: groups.length - changedGroupCount,
      },
      groups,
    };
  };

  const buildExportRows = (harnesses = []) => {
    const rows = [];
    ensureArray(harnesses).forEach((harness) => {
      ensureArray(harness.groups).forEach((group) => {
        ensureArray(group.rows).forEach((row) => {
          const businessCategory = detectCategory(group, row);
          const diff = classifyDiff(group, row);
          rows.push({
            businessCategory,
            diffType: diff.diffType,
            changeDetail: diff.changeDetail,
            riskLevel: diff.riskLevel,
            harnessNo: harness.harnessNo,
            groupLabel: group.label,
            itemCategory: group.itemCategory,
            endGroup: group.endGroup,
            status: row.status,
            rowType: row.rowType,
            oldChildPn: toText(row.left?.partNo, ''),
            oldChildName: toText(row.left?.partName, ''),
            oldQty: row.left?.qty ?? null,
            oldMainKey: toText(row.left?.partNo, toText(row.left?.sapNo, '')),
            newChildPn: toText(row.right?.partNo, ''),
            newChildName: toText(row.right?.partName, ''),
            newQty: row.right?.qty ?? null,
            newMainKey: toText(row.right?.partNo, toText(row.right?.sapNo, '')),
            reviewResult: '',
            reviewOwner: '',
            reviewDate: '',
            finalJudgement: '',
            comment: '',
            leftPartNo: toText(row.left?.partNo, ''),
            leftSapNo: toText(row.left?.sapNo, ''),
            leftPartName: toText(row.left?.partName, ''),
            leftQty: row.left?.qty ?? null,
            leftUnit: toText(row.left?.unit, ''),
            leftBundle: toText(row.display?.leftBundle, ''),
            rightPartNo: toText(row.right?.partNo, ''),
            rightSapNo: toText(row.right?.sapNo, ''),
            rightPartName: toText(row.right?.partName, ''),
            rightQty: row.right?.qty ?? null,
            rightUnit: toText(row.right?.unit, ''),
            rightBundle: toText(row.display?.rightBundle, ''),
            usageDeltaText: toText(row?.usageDelta?.text, ''),
          });
        });
      });
    });
    return rows;
  };

  const buildSummary = (alignment = {}, harnesses = []) => {
    const changedHarnessCount = ensureArray(harnesses).filter((harness) => Number(harness.summary?.changedGroupCount) > 0).length;
    const changedGroupCount = ensureArray(harnesses).reduce((acc, harness) => acc + (Number(harness.summary?.changedGroupCount) || 0), 0);
    const changedRowCount = ensureArray(harnesses).reduce((acc, harness) => acc + ensureArray(harness.groups).reduce((groupAcc, group) => groupAcc + (Number(group.summary?.changedRowCount) || 0), 0), 0);
    return {
      ...(clonePlain(alignment.summary, {}) || {}),
      harnessCount: ensureArray(harnesses).length,
      changedHarnessCount,
      sameHarnessCount: ensureArray(harnesses).length - changedHarnessCount,
      changedGroupCount,
      changedRowCount,
    };
  };

  const buildBomDiffResult = (alignment = {}, options = {}) => {
    const leftReleaseId = toText(alignment.leftReleaseId, toText(options.leftReleaseId, ''));
    const rightReleaseId = toText(alignment.rightReleaseId, toText(options.rightReleaseId, ''));
    const harnesses = ensureArray(alignment.harnesses).map(mapHarness);
    const summary = buildSummary(alignment, harnesses);
    const exportRows = buildExportRows(harnesses);
    const generatedAt = new Date().toISOString();
    return {
      diffId: '',
      releasePairKey: createReleasePairKey(leftReleaseId, rightReleaseId),
      leftReleaseId,
      rightReleaseId,
      leftLabel: toText(alignment.leftLabel, toText(options.leftLabel, 'Left BOM')),
      rightLabel: toText(alignment.rightLabel, toText(options.rightLabel, 'Right BOM')),
      comparedAt: toText(alignment.comparedAt, generatedAt),
      generatedAt,
      summary,
      harnesses,
      exportPayload: {
        meta: {
          leftReleaseId,
          rightReleaseId,
          leftLabel: toText(alignment.leftLabel, toText(options.leftLabel, 'Left BOM')),
          rightLabel: toText(alignment.rightLabel, toText(options.rightLabel, 'Right BOM')),
          comparedAt: toText(alignment.comparedAt, generatedAt),
          generatedAt,
          summary: clonePlain(summary, {}),
        },
        rows: exportRows,
      },
      sourceMeta: {
        leftWorkbookName: toText(options.leftGraph?.release?.workbookName, ''),
        rightWorkbookName: toText(options.rightGraph?.release?.workbookName, ''),
      },
    };
  };

  global.G281BomDiffEngine = {
    createReleasePairKey,
    buildBomDiffResult,
  };
})(window);
