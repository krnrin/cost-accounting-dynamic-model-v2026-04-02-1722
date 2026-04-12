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

    // --- Issue #2: 未匹配料号不分摊到产品成本，走呆滞提报 ---
    const stagnantPool = Math.max(residualMaterialPool, 0); // 记录但不分摊
    residualMaterialPool = 0; // 不再分摊到线束成本

    warnings.push(
      `残余材料池 ¥${stagnantPool.toFixed(2)} 为变更取消料号，不计入当前产品成本，请走呆滞提报流程。`
    );

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
        // --- Issue #2: 未匹配导线不分摊，标记为呆滞候选 ---
        const unmatchedMaterialCost = 0; // 不再分摊
        // 保留导线信息以防后续切换回来
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
          stagnantCandidate: !line.catalogMatched, // 呆滞候选标记
          preservedWireInfo: !line.catalogMatched ? {
            catalogCode: line.catalogCode,
            catalogName: line.catalogName,
            partNumber: line.partNumber,
            partName: line.partName,
          } : null,
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

  const api = {
    buildHarnessProfitBreakdown,
    detectBomVersionKey,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.G281HarnessProfit = api;
})(typeof window !== 'undefined' ? window : globalThis);
