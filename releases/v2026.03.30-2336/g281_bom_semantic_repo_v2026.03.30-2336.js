(function (global) {
  'use strict';

  const DEFAULT_PROJECT_CODE = 'default-project';

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

  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  const getDb = () => {
    if (!global.G281BomDb) {
      throw new Error('[G281BomSemanticRepo] window.G281BomDb is not initialized');
    }
    return global.G281BomDb;
  };

  const getParser = () => {
    if (!global.G281BomParser?.parseBomWorkbookSnapshot) {
      throw new Error('[G281BomSemanticRepo] window.G281BomParser is not initialized');
    }
    return global.G281BomParser;
  };

  function create(options = {}) {
    const projectCode = toText(options.projectCode, DEFAULT_PROJECT_CODE);

    const init = async () => {
      await getDb().init(options.db || {});
      return { projectCode };
    };

    const listBomReleases = async () => {
      await init();
      const records = await getDb().getAllRecords('bomReleaseBatches');
      return records
        .filter((record) => !projectCode || record.projectCode === projectCode)
        .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));
    };

    const getBomHeaders = async (releaseId) => {
      if (!releaseId) return [];
      await init();
      return getDb().getAllByIndex('bomHeaders', 'releaseId', releaseId);
    };

    const getBomItemsByRelease = async (releaseId) => {
      if (!releaseId) return [];
      await init();
      return getDb().getAllByIndex('bomItems', 'releaseId', releaseId);
    };

    const getBomEffectivitiesByRelease = async (releaseId) => {
      if (!releaseId) return [];
      await init();
      const records = await getDb().getAllRecords('bomEffectivities');
      return records.filter((record) => record.releaseId === releaseId);
    };

    const getBomReleaseGraph = async (releaseId) => {
      if (!releaseId) return null;
      await init();
      const release = await getDb().getRecord('bomReleaseBatches', releaseId);
      if (!release) return null;
      const headers = await getBomHeaders(releaseId);
      const items = await getBomItemsByRelease(releaseId);
      const effectivities = await getBomEffectivitiesByRelease(releaseId);
      return {
        release,
        headers,
        items,
        effectivities,
      };
    };

    const saveBomReleaseFromSnapshot = async (payload = {}) => {
      await init();
      const parser = getParser();
      const releaseId = toText(payload.releaseId, payload.versionId);
      const parsed = parser.parseBomWorkbookSnapshot(payload.workbookSnapshot, {
        releaseId,
        projectCode: toText(payload.projectCode, projectCode),
        releaseLabel: toText(payload.releaseLabel, payload.versionLabel || releaseId),
      });

      const now = new Date().toISOString();
      const existing = await getDb().getRecord('bomReleaseBatches', parsed.releaseMeta.releaseId);
      const releaseRecord = {
        releaseId: parsed.releaseMeta.releaseId,
        projectCode: parsed.releaseMeta.projectCode,
        releaseLabel: parsed.releaseMeta.releaseLabel,
        baseReleaseId: toText(payload.baseReleaseId, ''),
        snapshotId: toText(payload.snapshotId, ''),
        versionId: toText(payload.versionId, parsed.releaseMeta.releaseId),
        factorVersionId: toText(payload.versionId, parsed.releaseMeta.releaseId),
        workbookName: parsed.releaseMeta.workbookName,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        meta: {
          sheetCatalog: clonePlain(parsed.sheetCatalog, []),
          parseWarnings: clonePlain(parsed.parseWarnings, []),
          sheetCount: parsed.releaseMeta.sheetCount,
          harnessCount: parsed.releaseMeta.harnessCount,
          itemCount: parsed.releaseMeta.itemCount,
        },
      };

      await getDb().putRecord('bomReleaseBatches', releaseRecord);
      await Promise.all([
        getDb().deleteByIndex('bomHeaders', 'releaseId', releaseRecord.releaseId),
        getDb().deleteByIndex('bomItems', 'releaseId', releaseRecord.releaseId),
      ]);
      const existingEffectivities = await getBomEffectivitiesByRelease(releaseRecord.releaseId);
      if (existingEffectivities.length) {
        await Promise.all(existingEffectivities.map((record) => getDb().deleteRecord('bomEffectivities', record.effectId)));
      }

      if (parsed.headers.length) {
        await getDb().putMany('bomHeaders', parsed.headers);
      }
      if (parsed.items.length) {
        await getDb().putMany('bomItems', parsed.items);
      }
      if (parsed.effectivities.length) {
        await getDb().putMany('bomEffectivities', parsed.effectivities);
      }

      return {
        releaseId: releaseRecord.releaseId,
        summary: {
          sheetCount: parsed.releaseMeta.sheetCount,
          harnessCount: parsed.releaseMeta.harnessCount,
          itemCount: parsed.releaseMeta.itemCount,
          warningCount: ensureArray(parsed.parseWarnings).length,
        },
        release: releaseRecord,
      };
    };

    return {
      init,
      listBomReleases,
      getBomHeaders,
      getBomItemsByRelease,
      getBomEffectivitiesByRelease,
      getBomReleaseGraph,
      saveBomReleaseFromSnapshot,
    };
  }

  global.G281BomSemanticRepo = {
    create,
  };
})(window);
