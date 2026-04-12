/**
 * B14: 通知中心完善 — 扩展通知类型、分组过滤
 * 
 * 替换原 notificationStore.ts，新增:
 * - change_event: 设变通知
 * - scenario_publish: 场景发布通知
 * - alert_escalation: 预警升级通知
 * - param_snapshot: 参数快照通知
 * - quote_ready: 报价完成通知
 * 
 * 支持:
 * - 按类型分组
 * - 已读/未读过滤
 * - 批量标记已读
 * - 通知持久化
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type NotificationType =
  | 'metal_alert'
  | 'version_status'
  | 'import_complete'
  | 'change_event'
  | 'scenario_publish'
  | 'alert_escalation'
  | 'param_snapshot'
  | 'quote_ready'
  | 'bom_validation'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  /** 关联实体 */
  context?: {
    projectId?: string;
    scenarioId?: string;
    harnessId?: string;
    alertId?: string;
    snapshotId?: string;
  };
  /** 操作按钮 */
  actions?: Array<{
    label: string;
    action: string;
    params?: Record<string, unknown>;
  }>;
}

export interface NotificationFilters {
  type?: NotificationType;
  priority?: NotificationPriority;
  readStatus?: 'read' | 'unread' | 'all';
}

interface NotificationState {
  notifications: NotificationItem[];
  filters: NotificationFilters;
  maxItems: number;

  // Actions
  addNotification: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  markReadByType: (type: NotificationType) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setFilters: (filters: NotificationFilters) => void;

  // Computed
  getFilteredNotifications: () => NotificationItem[];
  getUnreadCount: () => number;
  getUnreadCountByType: (type: NotificationType) => number;
  getGroupedByType: () => Record<NotificationType, NotificationItem[]>;
}

export const useNotificationStoreV2 = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [],
        filters: { readStatus: 'all' },
        maxItems: 500,

        addNotification: (n) => {
          const item: NotificationItem = {
            ...n,
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date().toISOString(),
            read: false,
          };
          set((state) => ({
            notifications: [item, ...state.notifications].slice(0, state.maxItems),
          }));
        },

        markRead: (id) => {
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          }));
        },

        markAllRead: () => {
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
          }));
        },

        markReadByType: (type) => {
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.type === type ? { ...n, read: true } : n
            ),
          }));
        },

        removeNotification: (id) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        },

        clearAll: () => set({ notifications: [] }),

        setFilters: (filters) => set({ filters }),

        getFilteredNotifications: () => {
          const { notifications, filters } = get();
          return notifications.filter((n) => {
            if (filters.type && n.type !== filters.type) return false;
            if (filters.priority && n.priority !== filters.priority) return false;
            if (filters.readStatus === 'read' && !n.read) return false;
            if (filters.readStatus === 'unread' && n.read) return false;
            return true;
          });
        },

        getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

        getUnreadCountByType: (type) =>
          get().notifications.filter((n) => !n.read && n.type === type).length,

        getGroupedByType: () => {
          const groups: Record<string, NotificationItem[]> = {};
          for (const n of get().notifications) {
            if (!groups[n.type]) groups[n.type] = [];
            groups[n.type].push(n);
          }
          return groups as Record<NotificationType, NotificationItem[]>;
        },
      }),
      { name: 'notification-store-v2' }
    ),
    { name: 'notification-store-v2' }
  )
);

/** 通知类型中文名 */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  metal_alert: '金属价格预警',
  version_status: '版本状态变更',
  import_complete: '导入完成',
  change_event: '设变通知',
  scenario_publish: '场景发布',
  alert_escalation: '预警升级',
  param_snapshot: '参数快照',
  quote_ready: '报价完成',
  bom_validation: 'BOM校验',
  system: '系统通知',
};

/** 优先级中文名 */
export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};
