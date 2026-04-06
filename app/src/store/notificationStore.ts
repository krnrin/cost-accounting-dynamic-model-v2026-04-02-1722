import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface Notification {
  id: string;
  type: 'metal_alert' | 'version_status' | 'import_complete';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [],
        addNotification: (notif) => {
          const newNotif: Notification = {
            ...notif,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            read: false,
          };
          set((state) => ({
            notifications: [newNotif, ...state.notifications],
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
        clearAll: () => {
          set({ notifications: [] });
        },
        unreadCount: () => {
          return get().notifications.filter((n) => !n.read).length;
        },
      }),
      {
        name: 'notification-storage',
      }
    ),
    { name: 'notification-store' }
  )
);
