(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    history: 'g281.history.extra',
    approvals: 'g281.approvals.extra',
  };

  const memoryStorage = {
    history: [],
    approvals: [],
  };

  const hasLocalStorage = (() => {
    try {
      return typeof global.localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  })();

  const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const readExtras = (kind) => {
    if (hasLocalStorage) {
      return safeParse(global.localStorage.getItem(STORAGE_KEYS[kind]), []);
    }
    return memoryStorage[kind].slice();
  };

  const writeExtras = (kind, records) => {
    const payload = JSON.stringify(records);
    if (hasLocalStorage) {
      global.localStorage.setItem(STORAGE_KEYS[kind], payload);
    } else {
      memoryStorage[kind] = records.slice();
    }
  };

  const timeOf = (record) => {
    const raw = record.createdAt || record.submittedAt || record.approvedAt || '';
    const time = new Date(raw).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const mergeById = (seed, extra) => {
    const map = new Map();
    (seed || []).forEach((record) => map.set(record.id, record));
    (extra || []).forEach((record) => map.set(record.id, record));
    return [...map.values()].sort((a, b) => timeOf(b) - timeOf(a));
  };

  const uniqueId = (prefix, currentSize) => {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    return `${prefix}-${stamp}-${String(currentSize + 1).padStart(2, '0')}`;
  };

  const downloadJson = (filename, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  function init(runtime) {
    const seeds = {
      history: Array.isArray(runtime.historySeed) ? runtime.historySeed : [],
      approvals: Array.isArray(runtime.approvalSeed) ? runtime.approvalSeed : [],
    };
    let historyExtras = readExtras('history');
    let approvalExtras = readExtras('approvals');

    const getHistory = () => mergeById(seeds.history, historyExtras);
    const getApprovals = () => mergeById(seeds.approvals, approvalExtras);

    const saveHistory = (record) => {
      historyExtras = [record, ...historyExtras.filter((item) => item.id !== record.id)];
      writeExtras('history', historyExtras);
      return getHistory();
    };

    const saveApproval = (record) => {
      approvalExtras = [record, ...approvalExtras.filter((item) => item.id !== record.id)];
      writeExtras('approvals', approvalExtras);
      return getApprovals();
    };

    const createHistoryRecord = (model) => {
      const now = new Date();
      const timestamp = now.toISOString();
      return {
        id: uniqueId('H', getHistory().length + historyExtras.length),
        name: model.d.scenarioName,
        scenarioName: model.d.scenarioName,
        state: { ...model.stateSnapshot },
        draft: { ...model.d },
        createdAt: timestamp,
        author: 'user',
        note: '从看板保存的版本快照。',
        summary: {
          revenue: model.totalRevenue,
          cost: model.totalCost,
          profit: model.totalProfit,
          margin: model.margin,
          paybackYears: model.paybackYears,
          capitalTotal: model.capitalTotal,
        },
      };
    };

    const createApprovalRecord = (model, versionRecord, title) => {
      const now = new Date();
      const timestamp = now.toISOString();
      return {
        id: uniqueId('A', getApprovals().length + approvalExtras.length),
        title: title || `${model.d.scenarioName} 审批`,
        relatedVersionId: versionRecord ? versionRecord.id : '',
        status: 'PENDING',
        owner: '项目经理',
        submittedAt: timestamp,
        approvedAt: '',
        comment: '从看板提交的审批记录。',
        summary: {
          revenue: model.totalRevenue,
          cost: model.totalCost,
          profit: model.totalProfit,
          margin: model.margin,
        },
      };
    };

    const exportSnapshot = (filename, payload) => {
      downloadJson(filename, payload);
    };

    return {
      getHistory,
      getApprovals,
      saveHistory,
      saveApproval,
      createHistoryRecord,
      createApprovalRecord,
      exportSnapshot,
      runtime,
      seeds,
    };
  }

  global.G281Repo = { init };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281Repo;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
