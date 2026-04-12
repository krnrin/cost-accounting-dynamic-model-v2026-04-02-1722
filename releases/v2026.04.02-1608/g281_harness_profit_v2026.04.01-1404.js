(function (global) {
  'use strict';

  const VERSION_KEY_MAP = {
    freeze: 'quote',
    light: 'fixed',
    regress: 'tt',
  };

  const WIRE_CODE_SUFFIX_RE = /\/AL\d+$/i;

  function numberOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function stringOr(value, fallback) {
    return typeof value === 'string' ? value : fallback;
  }

  function detectBomVersionKey(runtime, model, options) {
    if (options && typeof options.versionKey === 'string' && options.versionKey.trim()) {
      return options.versionKey.trim();
    }

    const requested = stringOr(model && model.stateSnapshot && model.stateSnapshot.bom, '').trim();
    if (VERSION_KEY_MAP[requested]) {
      return VERSION_KEY_MAP[requested];
    }

    const versionOrder = safeArray(runtime && runtime.bomValidation && runtime.bomValidation.meta && runtime.bomValidation.meta.versionOrder);
    return versionOrder[0] || 'quote';
  }

  function selectedVersionLabel(runtime, versionKey) {
    const labels = safeObject(runtime && runtime.bomValidation && runtime.bomValidation.meta && runtime.bomValidation.meta.versionLabels);
    return labels[versionKey] || versionKey;
  }

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase().replace(WIRE_CODE_SUFFIX_RE, '');
  }

  function normalizeName(value) {
    return String(value || '').replace(/\s+/g, '').trim().toUpperCase();
  }

  function familyKeyFromCode(value) {
    const normalized = normalizeCode(value);
    const match = normalized.match(/^(.+?)\/(\d+(?:\.\d+)?)(?:\/.*)?$/);
    return match ? match[1] : normalized;
  }

  function sectionSizeFromCodeOrName(code, name) {
    const codeMatch = String(code || '').match(/\/(\d+(?:\.\d+)?)(?:\/|$)/);
    if (codeMatch) {
      return Number(codeMatch[1]);
    }
    const nameMatch = String(name || '').match(/(\d+(?:\.\d+)?)MM/i);
    if (nameMatch) {
      return Number(nameMatch[1]);
    }
    return null;
  }

  function buildWireCatalogIndex(wireCatalog) {
    const models = safeArray(wireCatalog && wireCatalog.models);
    const exact = new Map();
    const normalized = new Map();
    const nameSize = new Map();
    const familySize = new Map();

    models.forEach((row) => {
      const code = String(row && row.code || '').trim().toUpperCase();
      const normalizedCode = normalizeCode(code);
      const nameKey = normalizeName(row && row.name);
      const size = sectionSizeFromCodeOrName(row && row.code, row && row.name);
      const family = familyKeyFromCode(row && row.code);

      if (code && !exact.has(code)) {
        exact.set(code, row);
      }
      if (normalizedCode && !normalized.has(normalizedCode)) {
        normalized.set(normalizedCode, row);
      }
      if (nameKey && size !== null) {
        const composite = `${nameKey}__${size}`;
        if (!nameSize.has(composite)) {
          nameSize.set(composite, row);
        }
      }
      if (family && size !== null) {
        const composite = `${family}__${size}`;
        if (!familySize.has(composite)) {
          familySize.set(composite, row);
        }
      }
    });

    return {
      exact,
      normalized,
      nameSize,
      familySize,
    };
  }

  function resolveWireCatalogMatch(item, wireIndex) {
    const partNumber = String(item && item.partNumber || item && item.itemKey || '').trim().toUpperCase();
    const normalizedCode = normalizeCode(partNumber);
    const nameKey = normalizeName(item && item.partName);
    const size = sectionSizeFromCodeOrName(partNumber, item && item.partName);
    const family = familyKeyFromCode(partNumber);

    if (partNumber && wireIndex.exact.has(partNumber)) {
      return { row: wireIndex.exact.get(partNumber), method: 'exact_code' };
    }
    if (normalizedCode && wireIndex.normalized.has(normalizedCode)) {
      return { row: wireIndex.normalized.get(normalizedCode), method: 'normalized_code' };
    }
    if (nameKey && size !== null) {
      const composite = `${nameKey}__${size}`;
      if (wireIndex.nameSize.has(composite)) {
        return { row: wireIndex.nameSize.get(composite), method: 'name_and_size' };
      }
    }
    if (family && size !== null) {
      const composite = `${family}__${size}`;
      if (wireIndex.familySize.has(composite)) {
        return { row: wireIndex.familySize.get(composite), method: 'family_and_size' };
      }
    }
    return { row: null, method: 'unmatched' };
  }

  function computeWireUnitCost(catalogRow, draft) {
    const weights = safeObject(catalogRow && catalogRow.weights);
    const aluminum = numberOr(weights.aluminum, 0);
    const copper = numberOr(weights.copper, 0);
    const nonCopper = numberOr(weights.nonCopper, 0);
    const aluminumCost = (aluminum / 1000000) * numberOr(draft && draft.aluminumPrice, 0);
    const copperCost = (copper / 1000000) * numberOr(draft && draft.copperPrice, 0);
    return {
      unitCost: aluminumCost + copperCost + (nonCopper / 1000),
      aluminumWeight: aluminum,
      copperWeight: copper,
      nonCopper,
    };
  }

  function pickAlignedItemsForVersion(alignedRow, versionKey) {
    const result = [];
    const direct = safeObject(alignedRow && alignedRow.versions)[versionKey];
    if (direct) {
      result.push(direct);
    }
    safeArray(safeObject(alignedRow && alignedRow.partLists)[versionKey]).forEach((part) => result.push(part));
    return result;
  }

  function classifyResidualSection(section) {
    if (section === 'connector') return 'connector';
    if (section === 'wire') return 'wire';
    if (section === 'sync') return 'sync';
    return 'material';
  }

  function flattenHarnessData(harnessId, comparison, versionKey, wireIndex, draft) {
    const harnessName = stringOr(comparison && comparison.harnessName, harnessId);
    const wireLines = [];
    const sectionStats = {
      connectorQty: 0,
      syncQty: 0,
      materialQty: 0,
      unmatchedWireQty: 0,
      matchedWireCost: 0,
    };
    const itemStats = {
      selectedItemCount: 0,
      matchedWireCount: 0,
      unmatchedWireCount: 0,
      wireLineCount: 0,
    };

    safeArray(comparison && comparison.groups).forEach((group) => {
      safeArray(group && group.aligned).forEach((alignedRow, alignedIndex) => {
        const selectedItems = pickAlignedItemsForVersion(alignedRow, versionKey);
        selectedItems.forEach((item, itemIndex) => {
          const quantity = numberOr(item && item.quantity, 0);
          const section = classifyResidualSection(group && group.section);
          itemStats.selectedItemCount += 1;

          if (section === 'wire') {
            itemStats.wireLineCount += 1;
            const match = resolveWireCatalogMatch(item, wireIndex);
            const weights = match.row ? computeWireUnitCost(match.row, draft) : null;
            const matched = Boolean(match.row);
            const materialCost = matched ? weights.unitCost * quantity : null;
            if (matched) {
              itemStats.matchedWireCount += 1;
              sectionStats.matchedWireCost += materialCost;
            } else {
              itemStats.unmatchedWireCount += 1;
              sectionStats.unmatchedWireQty += Math.max(quantity, 0);
            }

            wireLines.push({
              lineId: `${harnessId}::${group && group.key || 'wire'}::${alignedIndex + 1}::${itemIndex + 1}`,
              harnessId,
              harnessName,
              groupKey: stringOr(group && group.key, 'wire'),
              groupLabel: stringOr(group && group.label, '导线'),
              itemKey: stringOr(item && item.itemKey, ''),
              rowType: stringOr(alignedRow && alignedRow.rowType, 'standard'),
              partNumber: stringOr(item && item.partNumber, ''),
              partName: stringOr(item && item.partName, ''),
              quantity,
              unit: stringOr(item && item.unit, ''),
              supplier: safeArray(item && item.suppliers).join(' / '),
              sapNos: safeArray(item && item.sapNos),
              remarks: safeArray(item && item.remarks),
              otherRemarks: safeArray(item && item.otherRemarks),
              matchState: stringOr(alignedRow && alignedRow.matchState, ''),
              sourceCount: numberOr(alignedRow && alignedRow.sourceCount, 0),
              catalogMatchMethod: match.method,
              catalogCode: stringOr(match.row && match.row.code, ''),
              catalogName: stringOr(match.row && match.row.name, ''),
              catalogMatched: matched,
              materialUnitCost: matched ? weights.unitCost : null,
              materialCost,
              materialCostPrecision: matched ? 'catalog_estimated' : 'allocated_residual',
              aluminumWeight: matched ? weights.aluminumWeight : null,
              copperWeight: matched ? weights.copperWeight : null,
              nonCopperCostComponent: matched ? weights.nonCopper : null,
              residualBasis: matched ? 0 : Math.max(quantity, 0),
              allocationBasis: matched
                ? ['导线目录重量 × 当前铜铝价 + 非铜成本']
                : ['未命中导线目录，后续按残余材料池和数量口径分摊'],
              notes: matched
                ? []
                : ['当前 BOM 行未命中导线目录，成本为近似分摊值，不是精确采购价。'],
            });
            return;
          }

          if (section === 'connector') {
            sectionStats.connectorQty += Math.max(quantity, 0);
            return;
          }
          if (section === 'sync') {
            sectionStats.syncQty += Math.max(quantity, 0);
            return;
          }
          sectionStats.materialQty += Math.max(quantity, 0);
        });
      });
    });

    return {
      harnessId,
      harnessName,
      groupCount: safeArray(comparison && comparison.groups).length,
      matchedCount: numberOr(comparison && comparison.summary && comparison.summary.matchedCount, 0),
      fullMatchCount: numberOr(comparison && comparison.summary && comparison.summary.fullMatchCount, 0),
      partialMatchCount: numberOr(comparison && comparison.summary && comparison.summary.partialMatchCount, 0),
      connectorQty: sectionStats.connectorQty,
      syncQty: sectionStats.syncQty,
      materialQty: sectionStats.materialQty,
      unmatchedWireQty: sectionStats.unmatchedWireQty,
      matchedWireCost: sectionStats.matchedWireCost,
      residualBasis: sectionStats.connectorQty + sectionStats.syncQty + sectionStats.materialQty + sectionStats.unmatchedWireQty,
      wireLines,
      itemStats,
    };
  }

  function averageUnitRevenue(model) {
    const totalVolume = numberOr(model && model.totalVolume, 0);
    const totalRevenue = numberOr(model && model.totalRevenue, 0);
    if (totalVolume > 0) {
      return totalRevenue / totalVolume;
    }
    const annual = safeArray(model && model.annual);
    if (!annual.length) {
      return 0;
    }
    const sum = annual.reduce((acc, row) => acc + numberOr(row && row.asp, 0), 0);
    return annual.length ? sum / annual.length : 0;
  }

  function buildEmptyResult(runtime, model, options, reason) {
    const selectedVersionKey = detectBomVersionKey(runtime, model, options);
    return {
      meta: {
        selectedBomVersionKey: selectedVersionKey,
        selectedBomVersionLabel: selectedVersionLabel(runtime, selectedVersionKey),
        exactness: {
          portfolio: 'exact_from_model',
          harness: 'not_available',
          wire: 'not_available',
        },
        warnings: [reason],
      },
      portfolio: {
        unitRevenue: averageUnitRevenue(model),
        unitCost: numberOr(model && model.operating, 0),
        unitProfit: numberOr(model && model.avgProfit, 0),
        margin: numberOr(model && model.margin, 0),
        lifecycleVolume: numberOr(model && model.totalVolume, 0),
        lifecycleRevenue: numberOr(model && model.totalRevenue, 0),
        lifecycleCost: numberOr(model && model.totalCost, 0),
        lifecycleProfit: numberOr(model && model.totalProfit, 0),
      },
      harnesses: [],
      wireLines: [],
      totals: {
        harnessCount: 0,
        wireLineCount: 0,
        matchedWireLineCount: 0,
        unmatchedWireLineCount: 0,
      },
    };
  }

  function buildHarnessProfitBreakdown(runtime, model, options) {
    const bomValidation = runtime && runtime.bomValidation;
    const wireCatalog = runtime && runtime.wireCatalog;

    if (!bomValidation || !safeArray(bomValidation.harnessOrder).length) {
      return buildEmptyResult(runtime, model, options, 'runtime.bomValidation 不存在或没有线束数据。');
    }
    if (!model || typeof model !== 'object') {
      return buildEmptyResult(runtime, model, options, 'model 不存在，无法生成利润拆解。');
    }

    const selectedVersionKey = detectBomVersionKey(runtime, model, options);
    const selectedVersionName = selectedVersionLabel(runtime, selectedVersionKey);
    const portfolio = {
      unitRevenue: averageUnitRevenue(model),
      unitCost: numberOr(model.operating, 0),
      unitProfit: numberOr(model.avgProfit, 0),
      margin: numberOr(model.margin, 0),
      lifecycleVolume: numberOr(model.totalVolume, 0),
      lifecycleRevenue: numberOr(model.totalRevenue, 0),
      lifecycleCost: numberOr(model.totalCost, 0),
      lifecycleProfit: numberOr(model.totalProfit, 0),
      materialCost: numberOr(model.material, 0),
      directLaborCost: numberOr(model.directLabor, 0),
      manufacturingCost: numberOr(model.manufacturing, 0),
      packagingCost: numberOr(model.packaging, 0),
      equipmentCost: numberOr(model.equipment, 0),
      rndCost: numberOr(model.rnd, 0),
    };

    const wireIndex = buildWireCatalogIndex(wireCatalog);
    const harnessDrafts = safeArray(bomValidation.harnessOrder).map((harnessId) => (
      flattenHarnessData(
        harnessId,
        safeObject(bomValidation.comparisons)[harnessId],
        selectedVersionKey,
        wireIndex,
        model.d || {}
      )
    ));

    let matchedWireTotal = harnessDrafts.reduce((sum, row) => sum + numberOr(row.matchedWireCost, 0), 0);
    let residualMaterialPool = portfolio.materialCost - matchedWireTotal;
    const warnings = [];
    let matchedWireScale = 1;

    if (portfolio.materialCost > 0 && matchedWireTotal > portfolio.materialCost) {
      matchedWireScale = portfolio.materialCost / matchedWireTotal;
      matchedWireTotal = portfolio.materialCost;
      residualMaterialPool = 0;
      warnings.push('导线目录估算总额高于模型材料成本，已按比例整体缩放导线成本以回到模型总材料口径。');
    } else if (portfolio.materialCost <= 0) {
      residualMaterialPool = 0;
      warnings.push('模型材料成本小于等于 0，线束利润与导线原材料成本估算将全部回落为 0。');
    }

    const totalResidualBasis = harnessDrafts.reduce((sum, row) => sum + numberOr(row.residualBasis, 0), 0);
    const totalHarnessMaterial = matchedWireTotal + Math.max(residualMaterialPool, 0);
    const nonMaterialPools = {
      directLabor: portfolio.directLaborCost,
      manufacturing: portfolio.manufacturingCost,
      packaging: portfolio.packagingCost,
      equipment: portfolio.equipmentCost,
      rnd: portfolio.rndCost,
    };
    const revenueMultiplier = portfolio.unitCost > 0 ? portfolio.unitRevenue / portfolio.unitCost : 0;

    const harnesses = [];
    const wireLines = [];

    harnessDrafts.forEach((draftRow) => {
      const scaledMatchedWireCost = numberOr(draftRow.matchedWireCost, 0) * matchedWireScale;
      const harnessResidualShare = totalResidualBasis > 0
        ? numberOr(draftRow.residualBasis, 0) / totalResidualBasis
        : (harnessDrafts.length ? 1 / harnessDrafts.length : 0);
      const residualAllocatedMaterial = Math.max(residualMaterialPool, 0) * harnessResidualShare;
      const harnessMaterialCost = scaledMatchedWireCost + residualAllocatedMaterial;
      const harnessMaterialShare = totalHarnessMaterial > 0
        ? harnessMaterialCost / totalHarnessMaterial
        : (harnessDrafts.length ? 1 / harnessDrafts.length : 0);

      const harnessDirectLabor = nonMaterialPools.directLabor * harnessMaterialShare;
      const harnessManufacturing = nonMaterialPools.manufacturing * harnessMaterialShare;
      const harnessPackaging = nonMaterialPools.packaging * harnessMaterialShare;
      const harnessEquipment = nonMaterialPools.equipment * harnessMaterialShare;
      const harnessRnd = nonMaterialPools.rnd * harnessMaterialShare;
      const harnessUnitCost = harnessMaterialCost + harnessDirectLabor + harnessManufacturing + harnessPackaging + harnessEquipment + harnessRnd;
      const harnessUnitRevenue = harnessUnitCost * revenueMultiplier;
      const harnessUnitProfit = harnessUnitRevenue - harnessUnitCost;

      const unmatchedWireBasis = numberOr(draftRow.unmatchedWireQty, 0);
      const nonWireResidualBasis = Math.max(numberOr(draftRow.residualBasis, 0) - unmatchedWireBasis, 0);
      const unmatchedWireAllocatedMaterial = draftRow.residualBasis > 0
        ? residualAllocatedMaterial * (unmatchedWireBasis / draftRow.residualBasis)
        : 0;
      const nonWireAllocatedMaterial = residualAllocatedMaterial - unmatchedWireAllocatedMaterial;

      const finalizedWireLines = draftRow.wireLines.map((line) => {
        const matchedMaterialCost = line.catalogMatched
          ? numberOr(line.materialCost, 0) * matchedWireScale
          : 0;
        const unmatchedMaterialCost = !line.catalogMatched && unmatchedWireBasis > 0
          ? unmatchedWireAllocatedMaterial * (numberOr(line.residualBasis, 0) / unmatchedWireBasis)
          : 0;
        const wireMaterialCost = matchedMaterialCost + unmatchedMaterialCost;
        const wireOperatingShare = harnessMaterialCost > 0
          ? wireMaterialCost / harnessMaterialCost
          : (draftRow.wireLines.length ? 1 / draftRow.wireLines.length : 0);
        const wireUnitCost = harnessUnitCost * wireOperatingShare;
        const wireUnitRevenue = harnessUnitRevenue * wireOperatingShare;
        const wireUnitProfit = wireUnitRevenue - wireUnitCost;
        const allocationBasis = line.allocationBasis.slice();

        allocationBasis.push('线束级非材料成本按该导线在本线束材料成本占比分摊');
        allocationBasis.push('该分摊仅用于线束级利润定位，导线本身不单独形成售价或利润');

        const notes = line.notes.slice();
        if (line.catalogMatched) {
          notes.push('导线材料成本来自导线目录当前铜铝价估算，用于原材料成本测算，不代表实时采购结算价。');
        }

        return {
          lineId: line.lineId,
          harnessId: line.harnessId,
          harnessName: line.harnessName,
          groupKey: line.groupKey,
          groupLabel: line.groupLabel,
          rowType: line.rowType,
          itemKey: line.itemKey,
          partNumber: line.partNumber,
          partName: line.partName,
          quantity: line.quantity,
          unit: line.unit,
          supplier: line.supplier,
          sapNos: line.sapNos,
          remarks: line.remarks,
          otherRemarks: line.otherRemarks,
          matchState: line.matchState,
          sourceCount: line.sourceCount,
          catalogMatched: line.catalogMatched,
          catalogMatchMethod: line.catalogMatchMethod,
          catalogCode: line.catalogCode,
          catalogName: line.catalogName,
          materialUnitCost: line.catalogMatched
            ? (line.quantity ? wireMaterialCost / line.quantity : 0)
            : null,
          materialCost: wireMaterialCost,
          materialCostPrecision: line.materialCostPrecision,
          aluminumWeight: line.aluminumWeight,
          copperWeight: line.copperWeight,
          nonCopperCostComponent: line.nonCopperCostComponent,
          unitCostEstimated: wireUnitCost,
          unitRevenueEstimated: wireUnitRevenue,
          unitProfitEstimated: wireUnitProfit,
          marginEstimated: wireUnitRevenue ? wireUnitProfit / wireUnitRevenue : 0,
          isApproximate: true,
          allocationBasis,
          precision: {
            material: line.catalogMatched ? 'catalog_estimated' : 'allocated_residual',
            operating: 'allocated_from_harness',
            revenue: 'allocated_from_portfolio',
            profit: 'allocated_from_portfolio',
          },
          notes,
        };
      });

      finalizedWireLines.forEach((line) => wireLines.push(line));

      harnesses.push({
        harnessId: draftRow.harnessId,
        harnessName: draftRow.harnessName,
        selectedBomVersionKey: selectedVersionKey,
        selectedBomVersionLabel: selectedVersionName,
        unitMaterialCost: harnessMaterialCost,
        unitDirectLaborCost: harnessDirectLabor,
        unitManufacturingCost: harnessManufacturing,
        unitPackagingCost: harnessPackaging,
        unitEquipmentCost: harnessEquipment,
        unitRndCost: harnessRnd,
        unitCostEstimated: harnessUnitCost,
        unitRevenueEstimated: harnessUnitRevenue,
        unitProfitEstimated: harnessUnitProfit,
        marginEstimated: harnessUnitRevenue ? harnessUnitProfit / harnessUnitRevenue : 0,
        matchedWireMaterialCost: scaledMatchedWireCost,
        unmatchedWireAllocatedMaterial,
        nonWireAllocatedMaterial,
        residualMaterialShare: harnessResidualShare,
        residualBasis: draftRow.residualBasis,
        counts: {
          groupCount: draftRow.groupCount,
          selectedItemCount: draftRow.itemStats.selectedItemCount,
          wireLineCount: draftRow.itemStats.wireLineCount,
          matchedWireCount: draftRow.itemStats.matchedWireCount,
          unmatchedWireCount: draftRow.itemStats.unmatchedWireCount,
          connectorQty: draftRow.connectorQty,
          syncQty: draftRow.syncQty,
          materialQty: draftRow.materialQty,
          unmatchedWireQty: draftRow.unmatchedWireQty,
          matchedCount: draftRow.matchedCount,
          fullMatchCount: draftRow.fullMatchCount,
          partialMatchCount: draftRow.partialMatchCount,
        },
        exactness: {
          material: draftRow.itemStats.unmatchedWireCount ? 'mixed_exact_and_allocated' : 'mixed_catalog_and_allocated_non_wire',
          operating: 'allocated_by_harness_material_share',
          revenue: 'allocated_by_portfolio_cost_ratio',
          profit: 'allocated_by_portfolio_cost_ratio',
        },
        allocationBasis: {
          matchedWire: '导线目录重量 × 当前铜铝价 + 非铜成本',
          residualMaterial: '模型材料成本扣除已命中导线成本后的残余材料池，按 BOM 非导线数量 + 未命中导线数量分摊',
          nonMaterial: '人工/制造/包装/设备/R&D 按线束材料成本占比分摊',
          revenueAndProfit: '按当前整套 ASP/成本倍率回推，不代表真实线束单价',
        },
        isApproximate: true,
        notes: [
          '当前线束级收入、利润不是核算表中的真实单线报价，而是按整套模型利润率回推的展示口径。',
          draftRow.itemStats.unmatchedWireCount
            ? `存在 ${draftRow.itemStats.unmatchedWireCount} 条导线未命中导线目录，已按残余材料池分摊。`
            : '导线材料成本已优先使用导线目录估算。',
        ],
      });
    });

    return {
      meta: {
        selectedBomVersionKey: selectedVersionKey,
          selectedBomVersionLabel: selectedVersionName,
        exactness: {
          portfolio: 'exact_from_model',
          harness: 'allocated_from_model_and_bom_validation',
          wire: 'catalog_estimated_plus_allocated',
        },
        warnings,
      },
      portfolio,
      harnesses,
      wireLines,
      totals: {
        harnessCount: harnesses.length,
        wireLineCount: wireLines.length,
        matchedWireLineCount: wireLines.filter((line) => line.catalogMatched).length,
        unmatchedWireLineCount: wireLines.filter((line) => !line.catalogMatched).length,
        matchedWireMaterialCost: matchedWireTotal,
        residualMaterialPool: Math.max(residualMaterialPool, 0),
        allocatedMaterialTotal: harnesses.reduce((sum, row) => sum + numberOr(row.unitMaterialCost, 0), 0),
        allocatedOperatingTotal: harnesses.reduce((sum, row) => sum + numberOr(row.unitCostEstimated, 0), 0),
      },
    };
  }

  const QUOTE_MATRIX_ROW_DEFS = [
    { key: 'targetVolume', rowIndex: 5, group: 'sales', format: 'int', sourceSummary: '项目评估汇总目标销售数量' },
    { key: 'targetAsp', rowIndex: 6, group: 'sales', format: 'money_precise', sourceSummary: '项目评估汇总目标销售单价' },
    { key: 'targetRevenue', rowIndex: 9, group: 'sales', format: 'money_precise', sourceSummary: '项目评估汇总目标销售收入' },
    { key: 'targetProfit', rowIndex: 10, group: 'sales', format: 'money_precise', sourceSummary: '项目评估汇总目标利润额' },
    { key: 'grossMargin', rowIndex: 11, group: 'sales', format: 'percent_precise', sourceSummary: '项目评估汇总毛利率' },
    { key: 'grossProfit', rowIndex: 12, group: 'sales', format: 'money_precise', sourceSummary: '项目评估汇总毛利额' },
    { key: 'rebateAmount', rowIndex: 13, group: 'sales', format: 'money_precise', sourceSummary: '项目评估汇总返点金额' },
    { key: 'projectCost', rowIndex: 14, group: 'cost', format: 'money_precise', sourceSummary: 'P15 + P16 + P20 + P23 + P31 + P32' },
    { key: 'materialCost', rowIndex: 15, group: 'cost', format: 'money_precise', sourceSummary: '配置明细材料成本' },
    { key: 'directLabor', rowIndex: 16, group: 'labor', format: 'money_precise', sourceSummary: 'P17 + P18 + P19' },
    { key: 'frontOpening', rowIndex: 17, group: 'labor', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准' },
    { key: 'frontShared', rowIndex: 18, group: 'labor', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准' },
    { key: 'rearAssembly', rowIndex: 19, group: 'labor', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准' },
    { key: 'equipmentTotal', rowIndex: 20, group: 'capital', format: 'money_precise', sourceSummary: 'P21 + P22' },
    { key: 'equipmentShared', rowIndex: 21, group: 'capital', format: 'money_precise', sourceSummary: '设备投资明细!Q30' },
    { key: 'equipmentDedicated', rowIndex: 22, group: 'capital', format: 'money_precise', sourceSummary: '设备投资明细!Q40 + 项目专用模具!O12 + 项目工装投入!O15' },
    { key: 'manufacturing', rowIndex: 23, group: 'manufacturing', format: 'money_precise', sourceSummary: 'P24 + P25 + P26 + P27 + P28 + P29 + P30' },
    { key: 'indirectLabor', rowIndex: 24, group: 'manufacturing', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准!E10' },
    { key: 'lowValueConsumables', rowIndex: 25, group: 'manufacturing', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准!E11' },
    { key: 'mroConsumption', rowIndex: 26, group: 'manufacturing', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准!E12' },
    { key: 'plantAllocation', rowIndex: 27, group: 'manufacturing', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准!E13' },
    { key: 'warehouseAllocation', rowIndex: 28, group: 'manufacturing', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准!E14' },
    { key: 'otherManufacturing', rowIndex: 29, group: 'manufacturing', format: 'money_precise', sourceSummary: '配置明细 + 运营工时费报价基准!E15' },
    { key: 'materialLoss', rowIndex: 30, group: 'manufacturing', format: 'money_precise', sourceSummary: 'P15 * 0.5%' },
    { key: 'rndCost', rowIndex: 31, group: 'support', format: 'money_precise', sourceSummary: '研发费用!F21 * 装车比' },
    { key: 'packagingCost', rowIndex: 32, group: 'support', format: 'money_precise', sourceSummary: '包装物流费用 VLOOKUP' },
  ];

  const QUOTE_RESOURCE_SPECS = {
    equipment: {
      workbookIndex: 2,
      headerRow: 2,
      groups: [
        { key: 'shared', label: '共用设备', startRow: 4, endRow: 28, itemCol: 4, specCol: 5, unitPriceCol: 13, demandColMin: 17, noteCol: 14 },
        { key: 'dedicated', label: '专用设备', startRow: 32, endRow: 38, itemCol: 4, specCol: 5, unitPriceCol: 13, demandColMin: 17, noteCol: 14 },
      ],
    },
    tooling: {
      workbookIndex: 3,
      headerRow: 2,
      groups: [
        { key: 'tooling', label: '项目专用模具', startRow: 4, endRow: 11, itemCol: 4, specCol: 5, unitPriceCol: 14, demandColMin: 15, noteCol: 13 },
      ],
    },
    fixtures: {
      workbookIndex: 4,
      headerRow: 2,
      groups: [
        { key: 'fixtures', label: '项目工装投入', startRow: 4, endRow: 10, itemCol: 4, specCol: 5, unitPriceCol: 14, demandColMin: 15, noteCol: 13 },
      ],
    },
  };

  function toText(value, fallback) {
    if (value === null || value === undefined) return fallback || '';
    const text = String(value).trim();
    return text || fallback || '';
  }

  function normalizeLookupKey(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number.isInteger(value) ? String(value) : String(value);
    }
    const text = String(value).trim();
    if (!text) return '';
    const numeric = Number(text);
    if (Number.isFinite(numeric) && String(numeric) === text.replace(/,/g, '')) {
      return Number.isInteger(numeric) ? String(numeric) : String(numeric);
    }
    return text;
  }

  function indexToColumnLabel(index) {
    let value = index;
    let result = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function formatPreciseNumber(value, digits) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    if (Math.abs(numeric) < 1e-12) return '0';
    return numeric.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatWorkbookValue(value, format) {
    const numeric = Number(value);
    switch (format) {
      case 'int':
        return Number.isFinite(numeric) ? formatPreciseNumber(numeric, 0) : '-';
      case 'percent_precise':
        return Number.isFinite(numeric) ? `${formatPreciseNumber(numeric * 100, 6)}%` : '-';
      case 'money_precise':
        return Number.isFinite(numeric) ? formatPreciseNumber(numeric, 12) : '-';
      default:
        if (Number.isFinite(numeric)) return formatPreciseNumber(numeric, 12);
        return toText(value, '-');
    }
  }

  function buildSheetRuntime(sheet) {
    const byAddress = Object.create(null);
    const byRow = Object.create(null);
    safeArray(sheet && sheet.cells).forEach((cell) => {
      if (!cell || typeof cell !== 'object') return;
      const address = toText(cell.address, '');
      if (address) {
        byAddress[address] = cell;
      }
      const row = numberOr(cell.row, 0);
      const column = numberOr(cell.column, 0);
      if (!row || !column) return;
      if (!byRow[row]) byRow[row] = Object.create(null);
      byRow[row][column] = cell;
    });
    return Object.assign({}, sheet, { byAddress, byRow });
  }

  function buildWorkbookSeedRuntime(seed) {
    const sheets = safeArray(seed && seed.sheets).map((sheet) => buildSheetRuntime(sheet));
    const byName = Object.create(null);
    sheets.forEach((sheet) => {
      byName[toText(sheet.sheetName, '')] = sheet;
    });
    return {
      workbookName: toText(seed && seed.workbookName, ''),
      sheetOrder: safeArray(seed && seed.sheetOrder),
      sheets,
      byName,
    };
  }

  function sheetByIndex(workbook, index) {
    return safeArray(workbook && workbook.sheets)[index] || null;
  }

  function cellAt(sheet, row, column) {
    return safeObject(safeObject(sheet && sheet.byRow)[row])[column] || null;
  }

  function cellByAddress(sheet, address) {
    return safeObject(sheet && sheet.byAddress)[address] || null;
  }

  function rowText(sheet, row, columns) {
    const values = safeArray(columns).map((column) => toText(cellAt(sheet, row, column)?.value, '')).filter(Boolean);
    return values.join(' / ');
  }

  function workbookHarnessName(runtime, harnessId) {
    const comparisons = safeObject(runtime && runtime.bomValidation && runtime.bomValidation.comparisons);
    const direct = safeObject(comparisons)[harnessId];
    if (toText(direct && direct.harnessName, '')) return direct.harnessName;
    const match = Object.keys(comparisons).find((key) => normalizeLookupKey(key) === normalizeLookupKey(harnessId));
    return toText(match && comparisons[match] && comparisons[match].harnessName, harnessId);
  }

  function findHarnessColumns(runtime, summarySheet) {
    const columns = [];
    for (let column = 16; column <= numberOr(summarySheet && summarySheet.maxColumn, 0); column += 1) {
      const harnessCell = cellAt(summarySheet, 3, column);
      const harnessId = normalizeLookupKey(harnessCell && harnessCell.value);
      if (!harnessId) continue;
      columns.push({
        harnessId,
        harnessName: workbookHarnessName(runtime, harnessId),
        columnIndex: column,
        columnLetter: indexToColumnLabel(column),
        configQty: numberOr(cellAt(summarySheet, 4, column)?.value, 0),
        lifecycleVolume: numberOr(cellAt(summarySheet, 37, column)?.value, 0),
        loadRatio: numberOr(cellAt(summarySheet, 35, column)?.value, 0),
        targetAsp: numberOr(cellAt(summarySheet, 6, column)?.value, 0),
      });
    }
    return columns;
  }

  function findRowByValue(sheet, searchColumn, expectedValue, startRow) {
    const target = normalizeLookupKey(expectedValue);
    for (let row = startRow || 1; row <= numberOr(sheet && sheet.maxRow, 0); row += 1) {
      const candidate = normalizeLookupKey(cellAt(sheet, row, searchColumn)?.value);
      if (candidate && candidate === target) return row;
    }
    return 0;
  }

  function findHarnessColumnInSheet(sheet, harnessId, headerRow, minColumn) {
    const expected = normalizeLookupKey(harnessId);
    for (let column = minColumn || 1; column <= numberOr(sheet && sheet.maxColumn, 0); column += 1) {
      const candidate = normalizeLookupKey(cellAt(sheet, headerRow || 2, column)?.value);
      if (candidate && candidate === expected) return column;
    }
    return 0;
  }

  function makeSourceDetail(sheet, row, column, label, extra) {
    const cell = cellAt(sheet, row, column);
    if (!cell) return null;
    const detail = Object.assign({
      label: label || `${toText(sheet && sheet.sheetName, '-')}:${indexToColumnLabel(column)}${row}`,
      sheetName: toText(sheet && sheet.sheetName, ''),
      address: `${indexToColumnLabel(column)}${row}`,
      value: cell.value,
      displayText: formatWorkbookValue(cell.value, 'money_precise'),
      formula: toText(cell.formula, ''),
    }, extra || {});
    return detail;
  }

  function summarizeDetailRefs(details) {
    return safeArray(details)
      .map((detail) => detail && detail.sheetName && detail.address ? `${detail.sheetName}!${detail.address}` : '')
      .filter(Boolean);
  }

  function configLookupRow(workbook, harnessId) {
    const configSheet = sheetByIndex(workbook, 7);
    return {
      sheet: configSheet,
      row: findRowByValue(configSheet, 2, harnessId, 3),
    };
  }

  function packagingLookupRow(workbook, harnessId) {
    const packagingSheet = sheetByIndex(workbook, 6);
    return {
      sheet: packagingSheet,
      row: findRowByValue(packagingSheet, 1, harnessId, 4),
    };
  }

  function buildConfigLaborSources(workbook, harness, configColumn, laborAddress, extraAddress) {
    const config = configLookupRow(workbook, harness.harnessId);
    const laborSheet = sheetByIndex(workbook, 1);
    const details = [];
    if (config.sheet && config.row) {
      details.push(makeSourceDetail(config.sheet, config.row, configColumn, '配置明细'));
    }
    if (laborSheet && laborAddress) {
      const laborMatch = laborAddress.match(/^([A-Z]+)(\d+)$/);
      if (laborMatch) {
        details.push(makeSourceDetail(laborSheet, Number(laborMatch[2]), columnLabelToIndex(laborMatch[1]), '工时费率'));
      }
    }
    if (laborSheet && extraAddress) {
      const extraMatch = extraAddress.match(/^([A-Z]+)(\d+)$/);
      if (extraMatch) {
        details.push(makeSourceDetail(laborSheet, Number(extraMatch[2]), columnLabelToIndex(extraMatch[1]), '效率基准'));
      }
    }
    return details.filter(Boolean);
  }

  function columnLabelToIndex(label) {
    const text = toText(label, '').toUpperCase();
    let result = 0;
    for (let index = 0; index < text.length; index += 1) {
      result = (result * 26) + (text.charCodeAt(index) - 64);
    }
    return result;
  }

  function buildManufacturingSources(workbook, harness, rateAddress) {
    const config = configLookupRow(workbook, harness.harnessId);
    const laborSheet = sheetByIndex(workbook, 1);
    const details = [];
    if (config.sheet && config.row) {
      [12, 13, 14].forEach((column) => {
        details.push(makeSourceDetail(config.sheet, config.row, column, column === 12 ? '开线工时' : column === 13 ? '公共制程工时' : '总装工时'));
      });
    }
    if (laborSheet && rateAddress) {
      const match = rateAddress.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        details.push(makeSourceDetail(laborSheet, Number(match[2]), columnLabelToIndex(match[1]), '制造费率'));
      }
    }
    return details.filter(Boolean);
  }

  function buildResourceGroupDetails(workbook, harness, spec) {
    const sheet = sheetByIndex(workbook, spec.workbookIndex);
    if (!sheet) return [];
    const demandColumn = findHarnessColumnInSheet(sheet, harness.harnessId, spec.headerRow, spec.groups[0].demandColMin);
    if (!demandColumn) return [];
    return spec.groups.map((group) => {
      const rows = [];
      for (let row = group.startRow; row <= group.endRow; row += 1) {
        const itemName = toText(cellAt(sheet, row, group.itemCol)?.value, '');
        if (!itemName) continue;
        const specText = toText(cellAt(sheet, row, group.specCol)?.value, '');
        const demandQty = numberOr(cellAt(sheet, row, demandColumn)?.value, 0);
        const unitPrice = numberOr(cellAt(sheet, row, group.unitPriceCol)?.value, 0);
        const newAmount = demandQty * unitPrice;
        rows.push({
          itemName,
          spec: specText,
          demandQty,
          unitPrice,
          newAmount,
          templateOnly: !demandQty && !newAmount,
          sheetName: sheet.sheetName,
          demandAddress: `${indexToColumnLabel(demandColumn)}${row}`,
          unitPriceAddress: `${indexToColumnLabel(group.unitPriceCol)}${row}`,
          note: toText(cellAt(sheet, row, group.noteCol)?.value, ''),
        });
      }
      return {
        key: group.key,
        label: group.label,
        rows,
      };
    });
  }

  function buildPackagingBreakdown(workbook, harness) {
    const result = packagingLookupRow(workbook, harness.harnessId);
    if (!result.sheet || !result.row) return [];
    const labels = {
      5: '内包装',
      6: '外包装',
      7: '运费',
      8: '超额运费',
      9: '短驳 / 其他',
      10: '三方仓费用',
      11: '仓储费',
      12: '合计',
    };
    return Object.keys(labels).map((key) => {
      const column = Number(key);
      const cell = cellAt(result.sheet, result.row, column);
      return {
        label: labels[column],
        sheetName: result.sheet.sheetName,
        address: `${indexToColumnLabel(column)}${result.row}`,
        value: cell ? cell.value : null,
        displayText: formatWorkbookValue(cell ? cell.value : null, 'money_precise'),
      };
    });
  }

  function buildRowSourceDetails(workbook, summarySheet, rowDef, harness) {
    const currentColumn = harness.columnIndex;
    switch (rowDef.key) {
      case 'projectCost':
        return [15, 16, 20, 23, 31, 32].map((row) => makeSourceDetail(summarySheet, row, currentColumn, `项目评估汇总 ${indexToColumnLabel(currentColumn)}${row}`)).filter(Boolean);
      case 'materialCost': {
        const config = configLookupRow(workbook, harness.harnessId);
        return config.sheet && config.row ? [makeSourceDetail(config.sheet, config.row, 7, '配置明细材料成本')] : [];
      }
      case 'directLabor':
        return [17, 18, 19].map((row) => makeSourceDetail(summarySheet, row, currentColumn, `项目评估汇总 ${indexToColumnLabel(currentColumn)}${row}`)).filter(Boolean);
      case 'frontOpening':
        return buildConfigLaborSources(workbook, harness, 12, 'D6', 'M5');
      case 'frontShared':
        return buildConfigLaborSources(workbook, harness, 13, 'E8', 'M5');
      case 'rearAssembly':
        return buildConfigLaborSources(workbook, harness, 14, 'E8', 'M5');
      case 'equipmentTotal':
        return [21, 22].map((row) => makeSourceDetail(summarySheet, row, currentColumn, `项目评估汇总 ${indexToColumnLabel(currentColumn)}${row}`)).filter(Boolean);
      case 'equipmentShared': {
        const equipmentSheet = sheetByIndex(workbook, 2);
        const demandColumn = findHarnessColumnInSheet(equipmentSheet, harness.harnessId, 2, 17);
        return demandColumn ? [makeSourceDetail(equipmentSheet, 30, demandColumn, '设备投资明细单套值')] : [];
      }
      case 'equipmentDedicated': {
        const details = [];
        const equipmentSheet = sheetByIndex(workbook, 2);
        const toolingSheet = sheetByIndex(workbook, 3);
        const fixtureSheet = sheetByIndex(workbook, 4);
        const equipmentColumn = findHarnessColumnInSheet(equipmentSheet, harness.harnessId, 2, 17);
        const toolingColumn = findHarnessColumnInSheet(toolingSheet, harness.harnessId, 2, 15);
        const fixtureColumn = findHarnessColumnInSheet(fixtureSheet, harness.harnessId, 2, 15);
        if (equipmentColumn) details.push(makeSourceDetail(equipmentSheet, 40, equipmentColumn, '设备投资明细专用设备'));
        if (toolingColumn) details.push(makeSourceDetail(toolingSheet, 12, toolingColumn, '项目专用模具'));
        if (fixtureColumn) details.push(makeSourceDetail(fixtureSheet, 15, fixtureColumn, '项目工装投入'));
        return details.filter(Boolean);
      }
      case 'manufacturing':
        return [24, 25, 26, 27, 28, 29, 30].map((row) => makeSourceDetail(summarySheet, row, currentColumn, `项目评估汇总 ${indexToColumnLabel(currentColumn)}${row}`)).filter(Boolean);
      case 'indirectLabor':
        return buildManufacturingSources(workbook, harness, 'E10');
      case 'lowValueConsumables':
        return buildManufacturingSources(workbook, harness, 'E11');
      case 'mroConsumption':
        return buildManufacturingSources(workbook, harness, 'E12');
      case 'plantAllocation':
        return buildManufacturingSources(workbook, harness, 'E13');
      case 'warehouseAllocation':
        return buildManufacturingSources(workbook, harness, 'E14');
      case 'otherManufacturing':
        return buildManufacturingSources(workbook, harness, 'E15');
      case 'materialLoss':
        return [makeSourceDetail(summarySheet, 15, currentColumn, `项目评估汇总 ${indexToColumnLabel(currentColumn)}15`, { note: '材料成本 × 0.5%' })].filter(Boolean);
      case 'rndCost': {
        const rndSheet = sheetByIndex(workbook, 5);
        return [
          rndSheet ? makeSourceDetail(rndSheet, 21, 6, '研发费用基准') : null,
          makeSourceDetail(summarySheet, 4, currentColumn, '装车比'),
        ].filter(Boolean);
      }
      case 'packagingCost':
        return buildPackagingBreakdown(workbook, harness);
      default:
        return [];
    }
  }

  function buildRowMeta(summarySheet, rowDef) {
    return {
      key: rowDef.key,
      rowIndex: rowDef.rowIndex,
      group: rowDef.group,
      label: rowText(summarySheet, rowDef.rowIndex, [1, 2]) || rowDef.key,
      note: rowText(summarySheet, rowDef.rowIndex, [3, 4]),
      sourceSummary: rowDef.sourceSummary,
      format: rowDef.format,
    };
  }

  function buildQuoteWorkbookMatrix(runtime) {
    const quote = safeObject(safeObject(runtime && runtime.financialVersions).versions).quote;
    const seed = safeObject(quote && quote.assessmentWorkbookSeed);
    if (!safeArray(seed.sheets).length) return null;

    const workbook = buildWorkbookSeedRuntime(seed);
    const summarySheet = sheetByIndex(workbook, 0);
    if (!summarySheet) return null;

    const harnessColumns = findHarnessColumns(runtime, summarySheet);
    if (!harnessColumns.length) return null;

    const summaryRows = QUOTE_MATRIX_ROW_DEFS.map((rowDef) => buildRowMeta(summarySheet, rowDef));
    const rowMetaMap = summaryRows.reduce((acc, row) => {
      acc[row.key] = row;
      return acc;
    }, Object.create(null));

    const harnessCostMatrix = Object.create(null);
    const harnessSourceDetails = Object.create(null);

    summaryRows.forEach((row) => {
      harnessCostMatrix[row.key] = Object.create(null);
    });

    harnessColumns.forEach((harness) => {
      const detailRows = [];
      summaryRows.forEach((row) => {
        const workbookCell = cellAt(summarySheet, row.rowIndex, harness.columnIndex);
        const sourceDetails = buildRowSourceDetails(workbook, summarySheet, row, harness);
        const matrixCell = {
          value: workbookCell ? workbookCell.value : null,
          formula: toText(workbookCell && workbookCell.formula, ''),
          sourceRefs: summarizeDetailRefs(sourceDetails),
          displayText: formatWorkbookValue(workbookCell ? workbookCell.value : null, row.format),
          status: workbookCell ? (workbookCell.formula ? 'formula' : 'value') : 'missing',
        };
        harnessCostMatrix[row.key][harness.harnessId] = matrixCell;
        detailRows.push({
          rowKey: row.key,
          label: row.label,
          note: row.note,
          sourceSummary: row.sourceSummary,
          value: matrixCell.value,
          displayText: matrixCell.displayText,
          formula: matrixCell.formula,
          sourceRefs: matrixCell.sourceRefs,
          sources: sourceDetails,
          group: row.group,
        });
      });

      harnessSourceDetails[harness.harnessId] = {
        harnessId: harness.harnessId,
        harnessName: harness.harnessName,
        columnIndex: harness.columnIndex,
        columnLetter: harness.columnLetter,
        configQty: harness.configQty,
        loadRatio: harness.loadRatio,
        lifecycleVolume: harness.lifecycleVolume,
        targetAsp: harness.targetAsp,
        rows: detailRows,
        resources: {
          equipment: buildResourceGroupDetails(workbook, harness, QUOTE_RESOURCE_SPECS.equipment),
          tooling: buildResourceGroupDetails(workbook, harness, QUOTE_RESOURCE_SPECS.tooling),
          fixtures: buildResourceGroupDetails(workbook, harness, QUOTE_RESOURCE_SPECS.fixtures),
          packaging: buildPackagingBreakdown(workbook, harness),
        },
      };
    });

    const totalColumnIndex = 5;
    const projectSummary = {
      workbookName: workbook.workbookName,
      sheetName: toText(summarySheet.sheetName, ''),
      totalVolume: numberOr(cellAt(summarySheet, 5, totalColumnIndex)?.value, 0),
      totalRevenue: numberOr(cellAt(summarySheet, 9, totalColumnIndex)?.value, 0),
      totalProfit: numberOr(cellAt(summarySheet, 10, totalColumnIndex)?.value, 0),
      grossMargin: numberOr(cellAt(summarySheet, 11, totalColumnIndex)?.value, 0),
      totalCost: numberOr(cellAt(summarySheet, 14, totalColumnIndex)?.value, 0),
      material: numberOr(cellAt(summarySheet, 15, totalColumnIndex)?.value, 0),
      directLabor: numberOr(cellAt(summarySheet, 16, totalColumnIndex)?.value, 0),
      equipment: numberOr(cellAt(summarySheet, 20, totalColumnIndex)?.value, 0),
      manufacturing: numberOr(cellAt(summarySheet, 23, totalColumnIndex)?.value, 0),
      rnd: numberOr(cellAt(summarySheet, 31, totalColumnIndex)?.value, 0),
      packaging: numberOr(cellAt(summarySheet, 32, totalColumnIndex)?.value, 0),
    };

    return {
      workbookName: workbook.workbookName,
      summaryRows,
      harnessColumns,
      harnessCostMatrix,
      harnessSourceDetails,
      rowMetaMap,
      projectSummary,
      sheetOrder: workbook.sheetOrder,
    };
  }

  const api = {
    buildHarnessProfitBreakdown,
    buildQuoteWorkbookMatrix,
    detectBomVersionKey,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.G281HarnessProfit = api;
})(typeof window !== 'undefined' ? window : globalThis);
