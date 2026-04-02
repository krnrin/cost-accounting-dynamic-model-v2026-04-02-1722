(function (global) {
  'use strict';

  const DEFAULT_DB_NAME = 'g281-bom-store';
  const DEFAULT_STORE_NAME = 'bomVersions';
  const DEFAULT_DB_VERSION = 1;

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
        if (!db.objectStoreNames.contains(config.storeName)) {
          db.createObjectStore(config.storeName, { keyPath: 'versionId' });
        }
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

  const listVersions = async (projectId) => {
    if (!projectId) {
      projectId = null;
    }

    if (memoryOnly || !hasIndexedDB) {
      const records = Array.from(memoryFallback.values());
      const filtered = records.filter((record) => (projectId ? record.projectId === projectId : true));
      return filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }

    const db = await ensureDbReady();
    if (!db) {
      return [];
    }

    const transaction = db.transaction(config.storeName, 'readonly');
    const store = transaction.objectStore(config.storeName);
    const request = store.getAll();

    const results = await requestToPromise(request);
    await transactionComplete(transaction);
    const filtered = Array.isArray(results) ? results : [];
    const projectFiltered = projectId ? filtered.filter((record) => record.projectId === projectId) : filtered;

    return projectFiltered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  };

  const getVersion = async (versionId) => {
    if (!versionId) {
      return null;
    }

    if (memoryOnly || !hasIndexedDB) {
      return memoryFallback.get(versionId) || null;
    }

    const db = await ensureDbReady();
    if (!db) {
      return null;
    }

    const transaction = db.transaction(config.storeName, 'readonly');
    const store = transaction.objectStore(config.storeName);
    const request = store.get(versionId);
    const result = await requestToPromise(request);
    await transactionComplete(transaction);
    return result || null;
  };

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

    if (memoryOnly || !hasIndexedDB) {
      memoryFallback.set(normalized.versionId, normalized);
      return normalized;
    }

    const db = await ensureDbReady();
    if (!db) {
      memoryFallback.set(normalized.versionId, normalized);
      return normalized;
    }

    const transaction = db.transaction(config.storeName, 'readwrite');
    const store = transaction.objectStore(config.storeName);
    const request = store.put(normalized);
    await requestToPromise(request);
    await transactionComplete(transaction);

    return normalized;
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
    };
  };

  global.G281BomDb = {
    init,
    listVersions,
    saveVersion,
    getVersion,
    __internal: {
      config,
      memoryFallback,
    },
  };
})(window);
