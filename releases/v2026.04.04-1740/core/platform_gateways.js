/**
 * core/platform_gateways.js
 * 离线优先的网关抽象，后续可替换为飞书适配器。
 */
(function (global) {
  'use strict';

  function clonePlain(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function toText(value, fallback) {
    const text = String(value == null ? '' : value).trim();
    return text || (fallback == null ? '' : fallback);
  }

  const AuthGateway = {
    providerKey: 'offline-local',
    async getSession(options) {
      const roleKey = toText(options && options.roleKey, 'costing');
      return {
        status: 'ready',
        mode: 'local-mock',
        providerKey: this.providerKey,
        userId: 'local-user',
        displayName: '本地离线用户',
        roleKey,
        fieldScope: 'all',
      };
    },
    canAccessField() {
      return true;
    },
  };

  const ApprovalGateway = {
    providerKey: 'offline-local',
    async list(options) {
      const repo = options && options.repo;
      return {
        status: 'ready',
        mode: 'local-mock',
        providerKey: this.providerKey,
        records: repo && typeof repo.getApprovals === 'function' ? clonePlain(repo.getApprovals(), []) : [],
      };
    },
    async submit(payload) {
      const repo = payload && payload.repo;
      if (repo && typeof repo.createApprovalRecord === 'function' && typeof repo.saveApproval === 'function') {
        const versionRecord = payload && payload.versionRecord;
        const model = payload && payload.model;
        const title = toText(payload && payload.title, 'Offline approval');
        const record = repo.createApprovalRecord(model, versionRecord, title);
        const enriched = Object.assign({}, record, {
          comment: toText(payload && payload.comment, record.comment),
          meta: clonePlain(payload && payload.meta, {}),
        });
        repo.saveApproval(enriched);
        return {
          status: 'queued',
          mode: 'local-mock',
          providerKey: this.providerKey,
          approvalId: enriched.id,
          record: enriched,
        };
      }
      return {
        status: 'queued',
        mode: 'local-mock',
        providerKey: this.providerKey,
        approvalId: `LOCAL-${Date.now()}`,
        payload: clonePlain(payload, {}),
      };
    },
    async approve(payload) {
      const repo = payload && payload.repo;
      const approvalId = toText(payload && payload.approvalId, '');
      const approver = toText(payload && payload.approver, 'local-approver');
      if (repo && approvalId && typeof repo.getApprovals === 'function' && typeof repo.saveApproval === 'function') {
        const current = clonePlain(repo.getApprovals().find((record) => toText(record && record.id, '') === approvalId), null);
        if (!current) {
          return {
            status: 'missing',
            mode: 'local-mock',
            providerKey: this.providerKey,
            approvalId,
          };
        }
        const approvedRecord = Object.assign({}, current, {
          status: 'APPROVED',
          owner: approver,
          approvedAt: new Date().toISOString(),
          comment: toText(payload && payload.comment, current.comment),
        });
        repo.saveApproval(approvedRecord);
        return {
          status: 'approved',
          mode: 'local-mock',
          providerKey: this.providerKey,
          approvalId,
          record: approvedRecord,
        };
      }
      return {
        status: 'approved',
        mode: 'local-mock',
        providerKey: this.providerKey,
        approvalId: approvalId || `LOCAL-${Date.now()}`,
        payload: clonePlain(payload, {}),
      };
    },
  };

  const NotificationGateway = {
    providerKey: 'offline-local',
    async send(payload) {
      return {
        status: 'queued',
        mode: 'local-mock',
        providerKey: this.providerKey,
        notificationId: `LOCAL-NOTICE-${Date.now()}`,
        payload: clonePlain(payload, {}),
      };
    },
  };

  const api = {
    AuthGateway,
    ApprovalGateway,
    NotificationGateway,
  };

  global.G281PlatformGateways = api;
  global.AuthGateway = AuthGateway;
  global.ApprovalGateway = ApprovalGateway;
  global.NotificationGateway = NotificationGateway;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
