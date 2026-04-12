(function (global) {
  'use strict';

  const DEFAULT_PROJECT_CODE = 'default-project';

  // Issue #10: 委托给 G281Shared
  const _S = (typeof G281Shared !== 'undefined') ? G281Shared : {};
  const clonePlain = _S.clonePlain || ((value, fallback = null) => { try { return JSON.parse(JSON.stringify(value)); } catch (e) { return fallback; } });
  const toText = _S.toText || ((value, fallback = '') => { const t = String(value ?? '').trim(); return t || fallback; });
  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});
  const ensureArray = _S.safeArray || ((value) => (Array.isArray(value) ? value : []));

  const getDb = () => {
    if (!global.G281BomDb) {
      throw new Error('[G281FactorVersionRepo] window.G281BomDb is not initialized');
    }
    return global.G281BomDb;
  };

  const isUniverSnapshot = (value) => Boolean(value && Array.isArray(value.sheetOrder) && value.sheets && !Array.isArray(value.sheets));

  const createId = (prefix, suffix = '') => {
    const stamp = Date.now().toString(36);
    const tail = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${suffix ? `${suffix}-` : ''}${stamp}-${tail}`;
  };

  const normalizeCellValue = (cell) => {
    if (!cell || typeof cell !== 'object') return null;
    const raw = Object.prototype.hasOwnProperty.call(cell, 'v') ? cell.v : null;
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'object') {
      if (typeof raw.v === 'string' || typeof raw.v === 'number' || typeof raw.v === 'boolean') {
        return raw.v;
      }
      if (typeof raw.body?.dataStream === 'string') {
        return raw.body.dataStream;
      }
      return clonePlain(raw, null);
    }
    return String(raw);
  };

  const extractRowsFromSnapshot = (snapshot) => {
    if (!isUniverSnapshot(snapshot)) {
      return [];
    }

    const rows = [];
    ensureArray(snapshot.sheetOrder).forEach((sheetId) => {
      const sheet = ensureObject(snapshot.sheets?.[sheetId]);
      const cellData = ensureObject(sheet.cellData);
      Object.keys(cellData)
        .sort((left, right) => Number(left) - Number(right))
        .forEach((rowKey) => {
          const rowCells = ensureObject(cellData[rowKey]);
          const cells = Object.keys(rowCells)
            .sort((left, right) => Number(left) - Number(right))
            .map((columnKey) => {
              const cell = ensureObject(rowCells[columnKey]);
              const formula = toText(cell.f, '');
              const value = normalizeCellValue(cell);
              if (value === null && !formula) {
                return null;
              }
              return {
                columnNo: (Number(columnKey) || 0) + 1,
                value,
                formula: formula || null,
                style: clonePlain(cell.s, null),
              };
            })
            .filter(Boolean);

          if (!cells.length) {
            return;
          }

          rows.push({
            sheetId,
            sheetName: toText(sheet.name, sheetId),
            rowNo: (Number(rowKey) || 0) + 1,
            cellCount: cells.length,
            cells,
          });
        });
    });

    return rows;
  };

  function create(options = {}) {
    const projectCode = toText(options.projectCode, DEFAULT_PROJECT_CODE);

    const init = async () => {
      await getDb().init(options.db || {});
      return { projectCode };
    };

    const getVersion = async (versionId) => {
      if (!versionId) return null;
      await init();
      return getDb().getRecord('factorVersions', versionId);
    };

    const getSnapshotByVersionId = async (versionId, factorType = '') => {
      const version = await getVersion(versionId);
      if (!version) return null;
      if (factorType && version.factorType !== factorType) return null;
      const snapshotRecord = await getDb().getRecord('workbookSnapshots', version.snapshotId);
      return clonePlain(snapshotRecord?.snapshotPayload, null);
    };

    const getFactorRows = async (versionId) => {
      if (!versionId) return [];
      await init();
      return getDb().getAllByIndex('factorRows', 'versionId', versionId);
    };

    const listFactorVersions = async (filter = {}) => {
      await init();
      const factorType = toText(filter.factorType, '');
      const scopeProject = toText(filter.projectCode, projectCode);
      const records = await getDb().getAllRecords('factorVersions');
      return records
        .filter((record) => (!factorType || record.factorType === factorType) && (!scopeProject || record.projectCode === scopeProject))
        .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    };

    const saveFactorVersionFromSnapshot = async (payload = {}) => {
      const factorType = toText(payload.factorType, 'unknown');
      const versionId = toText(payload.versionId, createId('factor', factorType));
      const versionLabel = toText(payload.versionLabel, versionId);
      const snapshot = clonePlain(payload.workbookSnapshot, null);
      if (!isUniverSnapshot(snapshot)) {
        throw new Error('[G281FactorVersionRepo] workbookSnapshot must be a Univer workbook snapshot');
      }

      await init();
      const existing = await getVersion(versionId);
      const now = new Date().toISOString();
      const snapshotId = toText(payload.snapshotId, existing?.snapshotId || `${versionId}::snapshot`);
      const workbookName = toText(payload.workbookName, toText(snapshot.name, versionLabel));
      const rows = extractRowsFromSnapshot(snapshot).map((row, index) => ({
        rowId: `${versionId}::row::${String(index + 1).padStart(5, '0')}`,
        versionId,
        factorType,
        sheetName: row.sheetName,
        rowNo: row.rowNo,
        dataKey: `${row.sheetName}#${row.rowNo}`,
        payload: row,
      }));

      const snapshotRecord = {
        snapshotId,
        factorType,
        versionId,
        projectCode: toText(payload.projectCode, projectCode),
        workbookName,
        sheetOrder: ensureArray(snapshot.sheetOrder),
        snapshotPayload: snapshot,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      const versionRecord = {
        versionId,
        factorType,
        versionLabel,
        projectCode: toText(payload.projectCode, projectCode),
        sourceType: toText(payload.sourceType, 'template'),
        snapshotId,
        status: toText(payload.status, 'active'),
        workbookName,
        meta: clonePlain(payload.meta, {}),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await getDb().putRecord('workbookSnapshots', snapshotRecord);
      await getDb().putRecord('factorVersions', versionRecord);
      await getDb().deleteByIndex('factorRows', 'versionId', versionId);
      if (rows.length) {
        await getDb().putMany('factorRows', rows);
      }

      return {
        ...versionRecord,
        snapshotId,
        rowCount: rows.length,
      };
    };

    return {
      init,
      getVersion,
      getSnapshotByVersionId,
      getFactorRows,
      listFactorVersions,
      saveFactorVersionFromSnapshot,
    };
  }

  global.G281FactorVersionRepo = {
    create,
    extractRowsFromSnapshot,
  };
})(window);
