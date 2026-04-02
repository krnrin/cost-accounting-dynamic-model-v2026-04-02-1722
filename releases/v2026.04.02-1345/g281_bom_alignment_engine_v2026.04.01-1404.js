(function (global) {
  'use strict';

  const CONNECTOR_LIKE = new Set(['connector', 'terminal', 'ipt_terminal']);

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
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  const normalizeKey = (value) =>
    toText(value, '')
      .replace(/\s+/g, '')
      .replace(/[（(].*?[）)]/g, '')
      .toLowerCase();

  const groupLabel = (itemCategory, endGroup) => {
    const categoryMap = {
      connector: '连接器',
      terminal: '端子',
      ipt_terminal: 'IPT端子',
      wire: '导线',
      bracket_rubber: '支架/橡胶件',
      tape_tube: '胶带/套管',
      other: '其他物料',
    };
    const categoryText = categoryMap[itemCategory] || itemCategory || '其他物料';
    return endGroup ? `${endGroup} · ${categoryText}` : categoryText;
  };

  const isConnectorLike = (item) => CONNECTOR_LIKE.has(toText(item?.itemCategory, 'other'));

  const buildGroupKey = (item) => {
    const category = toText(item?.itemCategory, 'other');
    const endGroup = toText(item?.endGroup, '');
    return `${category}|${endGroup}`;
  };

  const sortItems = (items = []) =>
    ensureArray(items)
      .slice()
      .sort((left, right) => {
        const leftOrder = toNumber(left?.displayOrder, Number.MAX_SAFE_INTEGER);
        const rightOrder = toNumber(right?.displayOrder, Number.MAX_SAFE_INTEGER);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return toText(left?.partNo, '').localeCompare(toText(right?.partNo, ''));
      });

  const buildUsageDelta = (leftItem, rightItem) => {
    const leftQty = toNumber(leftItem?.qty, NaN);
    const rightQty = toNumber(rightItem?.qty, NaN);
    const leftUnit = toText(leftItem?.unit, '');
    const rightUnit = toText(rightItem?.unit, '');
    if (Number.isFinite(leftQty) && !rightItem) {
      return { value: -leftQty, unit: leftUnit, text: `${-leftQty} ${leftUnit}`.trim() };
    }
    if (!leftItem && Number.isFinite(rightQty)) {
      return { value: rightQty, unit: rightUnit, text: `+${rightQty} ${rightUnit}`.trim() };
    }
    if (!Number.isFinite(leftQty) || !Number.isFinite(rightQty)) {
      return { value: 0, unit: rightUnit || leftUnit, text: '' };
    }
    if (leftUnit && rightUnit && leftUnit !== rightUnit) {
      return {
        value: rightQty - leftQty,
        unit: `${leftUnit}/${rightUnit}`,
        text: `${leftQty}${leftUnit} -> ${rightQty}${rightUnit}`,
      };
    }
    const delta = rightQty - leftQty;
    return {
      value: delta,
      unit: rightUnit || leftUnit,
      text: delta > 0 ? `+${delta} ${rightUnit || leftUnit}`.trim() : `${delta} ${rightUnit || leftUnit}`.trim(),
    };
  };

  const rowStatus = (leftItem, rightItem) => {
    if (leftItem && rightItem) {
      const samePart = normalizeKey(leftItem.partNo) === normalizeKey(rightItem.partNo);
      const sameSap = normalizeKey(leftItem.sapNo) === normalizeKey(rightItem.sapNo);
      const sameQty = toNumber(leftItem.qty, NaN) === toNumber(rightItem.qty, NaN);
      const sameUnit = toText(leftItem.unit, '') === toText(rightItem.unit, '');
      return samePart && sameSap && sameQty && sameUnit ? 'same' : 'changed';
    }
    return leftItem ? 'removed' : 'added';
  };

  const pairByKey = (leftItems, rightItems, keySelector) => {
    const leftRemaining = leftItems.slice();
    const rightRemaining = rightItems.slice();
    const rows = [];
    const rightIndex = new Map();

    rightRemaining.forEach((item, index) => {
      const key = keySelector(item);
      if (!key) return;
      if (!rightIndex.has(key)) rightIndex.set(key, []);
      rightIndex.get(key).push(index);
    });

    const usedRight = new Set();
    leftRemaining.forEach((leftItem) => {
      const key = keySelector(leftItem);
      const candidates = key ? rightIndex.get(key) : null;
      if (!candidates?.length) return;
      const targetIndex = candidates.find((index) => !usedRight.has(index));
      if (targetIndex === undefined) return;
      usedRight.add(targetIndex);
      rows.push({
        rowType: 'matched',
        left: leftItem,
        right: rightRemaining[targetIndex],
      });
    });

    return {
      rows,
      leftRemaining: leftRemaining.filter((leftItem) => !rows.some((row) => row.left?.itemId === leftItem.itemId)),
      rightRemaining: rightRemaining.filter((rightItem) => !rows.some((row) => row.right?.itemId === rightItem.itemId)),
    };
  };

  const buildAssemblyRows = (leftItems, rightItems) => {
    const connectorLeft = leftItems.filter(isConnectorLike);
    const connectorRight = rightItems.filter(isConnectorLike);
    if (connectorLeft.length === 1 && connectorRight.length > 1) {
      return [{
        rowType: 'assembly_to_parts',
        left: connectorLeft[0],
        rightParts: sortItems(connectorRight),
      }];
    }
    if (connectorRight.length === 1 && connectorLeft.length > 1) {
      return [{
        rowType: 'assembly_to_parts',
        leftParts: sortItems(connectorLeft),
        right: connectorRight[0],
      }];
    }
    return [];
  };

  const summarizeRows = (rows = []) =>
    rows.reduce((acc, row) => {
      if (row.rowType === 'matched') {
        if (rowStatus(row.left, row.right) === 'same') {
          acc.matchedCount += 1;
        } else {
          acc.changedCount += 1;
        }
      } else if (row.rowType === 'assembly_to_parts') {
        acc.assemblyBundleCount += 1;
      } else if (row.rowType === 'left_only') {
        acc.leftOnlyCount += 1;
      } else if (row.rowType === 'right_only') {
        acc.rightOnlyCount += 1;
      }
      return acc;
    }, {
      matchedCount: 0,
      changedCount: 0,
      assemblyBundleCount: 0,
      leftOnlyCount: 0,
      rightOnlyCount: 0,
    });

  const alignGroupItems = (leftItems, rightItems, groupKey) => {
    const exactAligned = pairByKey(leftItems, rightItems, (item) => normalizeKey(item.alignKey));
    const partAligned = pairByKey(exactAligned.leftRemaining, exactAligned.rightRemaining, (item) => {
      const partNo = normalizeKey(item.partNo);
      return partNo ? `${normalizeKey(item.itemCategory)}|${normalizeKey(item.endGroup)}|${partNo}` : '';
    });
    const sapAligned = pairByKey(partAligned.leftRemaining, partAligned.rightRemaining, (item) => {
      const sapNo = normalizeKey(item.sapNo);
      return sapNo ? `${normalizeKey(item.itemCategory)}|${normalizeKey(item.endGroup)}|${sapNo}` : '';
    });

    const assemblyRows = buildAssemblyRows(sapAligned.leftRemaining, sapAligned.rightRemaining);
    const assemblyConsumedLeft = new Set();
    const assemblyConsumedRight = new Set();
    assemblyRows.forEach((row) => {
      if (row.left?.itemId) assemblyConsumedLeft.add(row.left.itemId);
      ensureArray(row.leftParts).forEach((item) => assemblyConsumedLeft.add(item.itemId));
      if (row.right?.itemId) assemblyConsumedRight.add(row.right.itemId);
      ensureArray(row.rightParts).forEach((item) => assemblyConsumedRight.add(item.itemId));
    });

    const leftRest = sapAligned.leftRemaining.filter((item) => !assemblyConsumedLeft.has(item.itemId));
    const rightRest = sapAligned.rightRemaining.filter((item) => !assemblyConsumedRight.has(item.itemId));

    const rows = [
      ...exactAligned.rows,
      ...partAligned.rows,
      ...sapAligned.rows,
      ...assemblyRows,
      ...sortItems(leftRest).map((item) => ({ rowType: 'left_only', left: item })),
      ...sortItems(rightRest).map((item) => ({ rowType: 'right_only', right: item })),
    ].map((row) => ({
      ...row,
      groupKey,
      status: row.rowType === 'matched' ? rowStatus(row.left, row.right) : row.rowType,
      usageDelta: buildUsageDelta(row.left, row.right),
    }));

    const [itemCategory, endGroup] = groupKey.split('|');
    return {
      key: groupKey,
      itemCategory,
      endGroup,
      label: groupLabel(itemCategory, endGroup),
      rows,
      summary: summarizeRows(rows),
    };
  };

  const buildHarnessGraph = (headers, items) => {
    const headerMap = new Map();
    ensureArray(headers).forEach((header) => {
      headerMap.set(header.harnessNo, header);
    });
    const itemMap = new Map();
    ensureArray(items).forEach((item) => {
      const harnessNo = toText(item.harnessNo, '');
      if (!itemMap.has(harnessNo)) itemMap.set(harnessNo, []);
      itemMap.get(harnessNo).push(item);
    });
    return { headerMap, itemMap };
  };

  const compareHarness = (leftHeader, rightHeader, leftItems, rightItems) => {
    const groupMap = new Map();
    sortItems(leftItems).forEach((item) => {
      const key = buildGroupKey(item);
      if (!groupMap.has(key)) groupMap.set(key, { left: [], right: [] });
      groupMap.get(key).left.push(item);
    });
    sortItems(rightItems).forEach((item) => {
      const key = buildGroupKey(item);
      if (!groupMap.has(key)) groupMap.set(key, { left: [], right: [] });
      groupMap.get(key).right.push(item);
    });

    const groups = Array.from(groupMap.entries())
      .map(([key, pair]) => alignGroupItems(pair.left, pair.right, key))
      .filter((group) => group.rows.length);

    const summary = groups.reduce((acc, group) => {
      Object.entries(group.summary).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + value;
      });
      return acc;
    }, {
      matchedCount: 0,
      changedCount: 0,
      assemblyBundleCount: 0,
      leftOnlyCount: 0,
      rightOnlyCount: 0,
    });

    const harnessNo = toText(leftHeader?.harnessNo, toText(rightHeader?.harnessNo, ''));
    return {
      harnessNo,
      leftHeader: clonePlain(leftHeader, null),
      rightHeader: clonePlain(rightHeader, null),
      groups,
      summary,
    };
  };

  const alignBomReleases = (leftGraph = {}, rightGraph = {}, options = {}) => {
    const leftRelease = clonePlain(leftGraph.release, {});
    const rightRelease = clonePlain(rightGraph.release, {});
    const leftHarness = buildHarnessGraph(leftGraph.headers, leftGraph.items);
    const rightHarness = buildHarnessGraph(rightGraph.headers, rightGraph.items);
    const harnessNos = Array.from(new Set([
      ...leftHarness.headerMap.keys(),
      ...rightHarness.headerMap.keys(),
      ...leftHarness.itemMap.keys(),
      ...rightHarness.itemMap.keys(),
    ])).sort();

    const harnesses = harnessNos.map((harnessNo) =>
      compareHarness(
        leftHarness.headerMap.get(harnessNo) || null,
        rightHarness.headerMap.get(harnessNo) || null,
        leftHarness.itemMap.get(harnessNo) || [],
        rightHarness.itemMap.get(harnessNo) || [],
      ));

    const summary = harnesses.reduce((acc, harness) => {
      Object.entries(harness.summary).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + value;
      });
      return acc;
    }, {
      matchedCount: 0,
      changedCount: 0,
      assemblyBundleCount: 0,
      leftOnlyCount: 0,
      rightOnlyCount: 0,
      harnessCount: harnesses.length,
    });

    return {
      leftReleaseId: toText(leftRelease.releaseId, ''),
      rightReleaseId: toText(rightRelease.releaseId, ''),
      leftLabel: toText(leftRelease.releaseLabel, toText(options.leftLabel, '左侧版本')),
      rightLabel: toText(rightRelease.releaseLabel, toText(options.rightLabel, '右侧版本')),
      comparedAt: new Date().toISOString(),
      harnesses,
      summary,
    };
  };

  global.G281BomAlignmentEngine = {
    alignBomReleases,
  };
})(window);
