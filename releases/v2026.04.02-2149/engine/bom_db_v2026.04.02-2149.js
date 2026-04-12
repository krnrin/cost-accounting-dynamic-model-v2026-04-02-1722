(function (global) {
  'use strict';

  const DEFAULT_DB_NAME = 'g281-bom-store';
  const DEFAULT_STORE_NAME = 'bomVersions';
  const DEFAULT_DB_VERSION = 3;

  const STORE_DEFINITIONS = {
    bomVersions: {
      keyPath: 'versionId',
      indexes: [
        { name: 'projectId', keyPath: 'projectId' },
        { name: 'projectId_updatedAt', keyPath: ['projectId', 'updatedAt'] },
        { name: 'sourceType', keyPath: 'sourceType' },
      ],
    },
    workbookSnapshots: {
      keyPath: 'snapshotId',
      indexes: [
        { name: 'versionId', keyPath: 'versionId' },
        { name: 'factorType', keyPath: 'factorType' },
        { name: 'factorType_projectCode', keyPath: ['factorType', 'projectCode'] },
        { name: 'updatedAt', keyPath: 'updatedAt' },
      ],
    },
    factorVersions: {
      keyPath: 'versionId',
      indexes: [
        { name: 'factorType', keyPath: 'factorType' },
        { name: 'projectCode', keyPath: 'projectCode' },
        { name: 'factorType_projectCode', keyPath: ['factorType', 'projectCode'] },
        { name: 'projectCode_updatedAt', keyPath: ['projectCode', 'updatedAt'] },
      ],
    },
    factorRows: {
      keyPath: 'rowId',
      indexes: [
        { name: 'versionId', keyPath: 'versionId' },
        { name: 'factorType_versionId', keyPath: ['factorType', 'versionId'] },
      ],
    },
    bomReleaseBatches: {
      keyPath: 'releaseId',
      indexes: [
        { name: 'projectCode_createdAt', keyPath: ['projectCode', 'createdAt'] },
        { name: 'baseReleaseId', keyPath: 'baseReleaseId' },
      ],
    },
    bomHeaders: {
      keyPath: 'headerId',
      indexes: [
        { name: 'releaseId', keyPath: 'releaseId' },
        { name: 'releaseId_harnessNo', keyPath: ['releaseId', 'harnessNo'] },
      ],
    },
    bomItems: {
      keyPath: 'itemId',
      indexes: [
        { name: 'releaseId', keyPath: 'releaseId' },
        { name: 'headerId', keyPath: 'headerId' },
        { name: 'releaseId_alignKey', keyPath: ['releaseId', 'alignKey'] },
        { name: 'releaseId_itemCategory', keyPath: ['releaseId', 'itemCategory'] },
      ],
    },
    bomEffectivities: {
      keyPath: 'effectId',
      indexes: [
        { name: 'itemId', keyPath: 'itemId' },
        { name: 'releaseId_configCode', keyPath: ['releaseId', 'configCode'] },
      ],
    },
    bomAlignmentRules: {
      keyPath: 'ruleId',
      indexes: [
        { name: 'releasePairKey', keyPath: 'releasePairKey' },
        { name: 'manualPinned', keyPath: 'manualPinned' },
      ],
    },
    bomChangeEvents: {
      keyPath: 'changeId',
      indexes: [
        { name: 'releaseId', keyPath: 'releaseId' },
        { name: 'targetId', keyPath: 'targetId' },
      ],
    },
    bomDiffResults: {
      keyPath: 'diffId',
      indexes: [
        { name: 'releasePairKey', keyPath: 'releasePairKey' },
        { name: 'generatedAt', keyPath: 'generatedAt' },
      ],
    },
    scenarios: {
      keyPath: 'scenarioId',
      indexes: [
        { name: 'projectCode', keyPath: 'projectCode' },
        { name: 'projectCode_updatedAt', keyPath: ['projectCode', 'updatedAt'] },
      ],
    },
    scenarioBindings: {
      keyPath: 'bindingId',
      indexes: [
        { name: 'scenarioId', keyPath: 'scenarioId' },
        { name: 'scenarioId_factorType', keyPath: ['scenarioId', 'factorType'] },
      ],
    },
  };

  let config = {
    dbName: DEFAULT_DB_NAME,
    storeName: DEFAULT_STORE_NAME,
    dbVersion: DEFAULT_DB_VERSION,
  };
  let dbPromise = null;
  let dbInstance = null;
  let memoryFallback = new Map();
  let memoryOnly = false;

  const getSchema = () => global.G281BomSchema || null;
  const hasIndexedDB = typeof global.indexedDB !== 'undefined' && global.indexedDB;

  const clonePlain = (value, fallback = null) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };

  const requestToPromise = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });

  const transactionComplete = (transaction) =>
    new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });

  const getStoreDefinition = (storeName) => STORE_DEFINITIONS[storeName] || { keyPath: 'id', indexes: [] };

  const getMemoryStore = (storeName) => {
    if (!memoryFallback.has(storeName)) {
      memoryFallback.set(storeName, new Map());
    }
    return memoryFallback.get(storeName);
  };

  const readKeyPathValue = (record, keyPath) => {
    if (!record || !keyPath) return undefined;
    if (Array.isArray(keyPath)) {
      return keyPath.map((item) => readKeyPathValue(record, item));
    }
    return String(keyPath)
      .split('.')
      .reduce((acc, segment) => (acc === null || acc === undefined ? undefined : acc[segment]), record);
  };

  const valuesEqual = (left, right) => {
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }
      return left.every((value, index) => valuesEqual(value, right[index]));
    }
    return left === right;
  };

  const buildKeyRange = (value) => {
    if (value === undefined || value === null || !global.IDBKeyRange?.only) {
      return null;
    }
    try {
      return global.IDBKeyRange.only(value);
    } catch (error) {
      return null;
    }
  };

  const ensureRecordKey = (storeName, payload) => {
    const definition = getStoreDefinition(storeName);
    const record = clonePlain(payload, {}) || {};
    const keyPath = definition.keyPath;
    if (Array.isArray(keyPath)) {
      return record;
    }
    if (!record[keyPath]) {
      record[keyPath] = `${storeName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return record;
  };

  const createObjectStoreIfNeeded = (db, transaction, storeName) => {
    const definition = getStoreDefinition(storeName);
    const store = db.objectStoreNames.contains(storeName)
      ? transaction.objectStore(storeName)
      : db.createObjectStore(storeName, { keyPath: definition.keyPath });
    definition.indexes.forEach((index) => {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, { unique: Boolean(index.unique) });
      }
    });
  };

  const openDatabase = () => {
    if (!hasIndexedDB) {
      memoryOnly = true;
      return Promise.resolve(null);
    }

    if (dbInstance) {
      return Promise.resolve(dbInstance);
    }

    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(config.dbName, config.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        Object.keys(STORE_DEFINITIONS).forEach((storeName) => {
          createObjectStoreIfNeeded(db, transaction, storeName);
        });
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };

      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
      request.onblocked = () => {
        console.warn('[G281BomDb] IndexedDB open blocked. Falling back to in-memory store.');
      };
    }).catch((error) => {
      memoryOnly = true;
      dbPromise = null;
      console.warn('[G281BomDb] IndexedDB unavailable, using memory fallback.', error);
      return null;
    });

    return dbPromise;
  };

  const ensureDbReady = async () => {
    if (memoryOnly) {
      return null;
    }
    return openDatabase();
  };

  const putRecord = async (storeName, payload) => {
    if (!storeName) {
      throw new Error('[G281BomDb] putRecord storeName is required');
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('[G281BomDb] putRecord payload must be an object');
    }

    const record = ensureRecordKey(storeName, payload);
    const key = readKeyPathValue(record, getStoreDefinition(storeName).keyPath);

    if (memoryOnly || !hasIndexedDB) {
      getMemoryStore(storeName).set(clonePlain(key), clonePlain(record, record));
      return record;
    }

    const db = await ensureDbReady();
    if (!db) {
      getMemoryStore(storeName).set(clonePlain(key), clonePlain(record, record));
      return record;
    }

    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(record);
    await requestToPromise(request);
    await transactionComplete(transaction);
    return record;
  };

  const putMany = async (storeName, records = []) => {
    if (!Array.isArray(records) || !records.length) {
      return [];
    }
    const normalized = records.map((record) => ensureRecordKey(storeName, record));

    if (memoryOnly || !hasIndexedDB) {
      const store = getMemoryStore(storeName);
      normalized.forEach((record) => {
        const key = readKeyPathValue(record, getStoreDefinition(storeName).keyPath);
        store.set(clonePlain(key), clonePlain(record, record));
      });
      return normalized;
    }

    const db = await ensureDbReady();
    if (!db) {
      const store = getMemoryStore(storeName);
      normalized.forEach((record) => {
        const key = readKeyPathValue(record, getStoreDefinition(storeName).keyPath);
        store.set(clonePlain(key), clonePlain(record, record));
      });
      return normalized;
    }

    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    await Promise.all(normalized.map((record) => requestToPromise(store.put(record))));
    await transactionComplete(transaction);
    return normalized;
  };

  const getRecord = async (storeName, key) => {
    if (!storeName || key === undefined || key === null) {
      return null;
    }

    if (memoryOnly || !hasIndexedDB) {
      return clonePlain(getMemoryStore(storeName).get(key), null);
    }

    const db = await ensureDbReady();
    if (!db) {
      return null;
    }

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    const result = await requestToPromise(request);
    await transactionComplete(transaction);
    return result || null;
  };

  const getAllRecords = async (storeName) => {
    if (!storeName) {
      return [];
    }

    if (memoryOnly || !hasIndexedDB) {
      return Array.from(getMemoryStore(storeName).values()).map((record) => clonePlain(record, record));
    }

    const db = await ensureDbReady();
    if (!db) {
      return [];
    }

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    const results = await requestToPromise(request);
    await transactionComplete(transaction);
    return Array.isArray(results) ? results : [];
  };

  const getAllByIndex = async (storeName, indexName, value) => {
    if (!storeName || !indexName) {
      return [];
    }

    if (memoryOnly || !hasIndexedDB) {
      const definition = getStoreDefinition(storeName);
      const index = definition.indexes.find((item) => item.name === indexName);
      if (!index) return [];
      return Array.from(getMemoryStore(storeName).values())
        .filter((record) => valuesEqual(readKeyPathValue(record, index.keyPath), value))
        .map((record) => clonePlain(record, record));
    }

    const db = await ensureDbReady();
    if (!db) {
      return [];
    }

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const keyRange = buildKeyRange(value);
    const request = keyRange ? index.getAll(keyRange) : index.getAll();
    const results = await requestToPromise(request);
    await transactionComplete(transaction);
    if (keyRange) {
      return Array.isArray(results) ? results : [];
    }
    return (Array.isArray(results) ? results : []).filter((record) => {
      const definition = getStoreDefinition(storeName);
      const indexDefinition = definition.indexes.find((item) => item.name === indexName);
      return indexDefinition ? valuesEqual(readKeyPathValue(record, indexDefinition.keyPath), value) : false;
    });
  };

  const deleteRecord = async (storeName, key) => {
    if (!storeName || key === undefined || key === null) {
      return false;
    }

    if (memoryOnly || !hasIndexedDB) {
      return getMemoryStore(storeName).delete(key);
    }

    const db = await ensureDbReady();
    if (!db) {
      return false;
    }

    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    await requestToPromise(request);
    await transactionComplete(transaction);
    return true;
  };

  const deleteByIndex = async (storeName, indexName, value) => {
    const records = await getAllByIndex(storeName, indexName, value);
    if (!records.length) {
      return 0;
    }
    const keyPath = getStoreDefinition(storeName).keyPath;
    await Promise.all(records.map((record) => deleteRecord(storeName, readKeyPathValue(record, keyPath))));
    return records.length;
  };

  const listVersions = async (projectId) => {
    const records = await getAllRecords(config.storeName);
    const filtered = projectId ? records.filter((record) => record.projectId === projectId) : records;
    return filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  };

  const getVersion = async (versionId) => getRecord(config.storeName, versionId);

  const saveVersion = async (payload) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('[G281BomDb] saveVersion payload must be an object');
    }

    const schemaInstance = getSchema();
    const normalized = schemaInstance
      ? schemaInstance.createVersionRecord(payload)
      : { ...(payload || {}) };
    if (!normalized.versionId) {
      normalized.versionId = `version-${Date.now()}`;
    }
    if (!normalized.projectId) {
      normalized.projectId = 'default-bom';
    }
    if (!normalized.versionLabel) {
      normalized.versionLabel = normalized.versionId;
    }
    const timestamp = new Date().toISOString();
    const existing = await getVersion(normalized.versionId);
    normalized.createdAt = existing?.createdAt || normalized.createdAt || timestamp;
    normalized.updatedAt = timestamp;

    return putRecord(config.storeName, normalized);
  };

  const init = async (options = {}) => {
    config.dbName = options.dbName || DEFAULT_DB_NAME;
    config.storeName = options.storeName || DEFAULT_STORE_NAME;
    config.dbVersion = Number.isFinite(options.dbVersion) ? options.dbVersion : DEFAULT_DB_VERSION;
    dbPromise = null;
    dbInstance = null;
    memoryOnly = false;

    await ensureDbReady();
    return {
      config: { ...config },
      storageType: memoryOnly ? 'memory' : 'indexeddb',
      stores: Object.keys(STORE_DEFINITIONS),
    };
  };

  global.G281BomDb = {
    init,
    listVersions,
    saveVersion,
    getVersion,
    putRecord,
    putMany,
    getRecord,
    getAllRecords,
    getAllByIndex,
    deleteRecord,
    deleteByIndex,
    stores: clonePlain(STORE_DEFINITIONS, {}),
    __internal: {
      config,
      memoryFallback,
    },
  };
})(window);
