/**
 * notificationStore.ts — Backward compatibility shim
 * [FIX P2-5] V1 已被 notificationStoreV2.ts 完全替代
 *
 * 保留此文件仅为向后兼容：已有代码中的
 *   import { useNotificationStore } from '@/store/notificationStore'
 * 无需修改即可使用 V2 的全部能力。
 *
 * 新代码请直接使用：
 *   import { useNotificationStoreV2 } from '@/store/notificationStoreV2'
 */

export {
  useNotificationStoreV2 as useNotificationStore,
  type NotificationItem as Notification,
  type NotificationType,
  type NotificationPriority,
  type NotificationFilters,
  NOTIFICATION_TYPE_LABELS,
  PRIORITY_LABELS,
} from './notificationStoreV2';
