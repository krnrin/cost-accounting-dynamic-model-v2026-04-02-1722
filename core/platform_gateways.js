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
      return {
        status: 'queued',
        mode: 'local-mock',
        providerKey: this.providerKey,
        approvalId: `LOCAL-${Date.now()}`,
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
