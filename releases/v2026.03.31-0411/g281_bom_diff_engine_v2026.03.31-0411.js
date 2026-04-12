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

  const createReleasePairKey = (leftReleaseId, rightReleaseId) =>
    `${toText(leftReleaseId, 'left')}::${toText(rightReleaseId, 'right')}`;

  const mapHeader = (header) => {
    if (!header || typeof header !== 'object') return null;
    return {
      headerId: toText(header.headerId, ''),
      releaseId: toText(header.releaseId, ''),
      harnessNo: toText(header.harnessNo, ''),
      harnessName: toText(header.harnessName, ''),
      customerPartNo: toText(header.customerPartNo, ''),
      sapNo: toText(header.sapNo, ''),
      optionCode: toText(header.optionCode, ''),
      originSheetName: toText(header.originSheetName, ''),
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
      functionName: toText(item.functionName, ''),
      spec: toText(item.spec, ''),
      qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : null,
      unit: toText(item.unit, ''),
      semiFinishedPartNo: toText(item.semiFinishedPartNo, ''),
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
          rows.push({
            harnessNo: harness.harnessNo,
            groupLabel: group.label,
            itemCategory: group.itemCategory,
            endGroup: group.endGroup,
            status: row.status,
            rowType: row.rowType,
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
        rows: buildExportRows(harnesses),
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
