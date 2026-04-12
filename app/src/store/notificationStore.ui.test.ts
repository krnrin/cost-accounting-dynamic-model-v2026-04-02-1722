import { describe, it, expect } from 'vitest';
import { useNotificationStore } from './notificationStore';
import { act } from '@testing-library/react';

describe('notificationStore', () => {
  beforeEach(() => {
    act(() => useNotificationStore.getState().clearAll());
  });

  it('starts with empty notifications', () => {
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it('adds a notification', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'metal_alert',
        title: '铜价预警',
        message: '铜价超过阈值',
      });
    });
    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('铜价预警');
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].id).toBeTruthy();
    expect(notifications[0].timestamp).toBeTruthy();
  });

  it('marks a notification as read', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'import_complete',
        title: 'BOM导入完成',
        message: '已导入 50 行',
      });
    });
    const id = useNotificationStore.getState().notifications[0].id;
    act(() => useNotificationStore.getState().markRead(id));
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('marks all as read', () => {
    act(() => {
      const store = useNotificationStore.getState();
      store.addNotification({ type: 'metal_alert', title: 'A', message: 'a' });
      store.addNotification({ type: 'metal_alert', title: 'B', message: 'b' });
    });
    act(() => useNotificationStore.getState().markAllRead());
    const all = useNotificationStore.getState().notifications;
    expect(all.every(n => n.read)).toBe(true);
  });

  it('clears all notifications', () => {
    act(() => {
      useNotificationStore.getState().addNotification({
        type: 'version_status',
        title: 'X',
        message: 'x',
      });
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    act(() => useNotificationStore.getState().clearAll());
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('unreadCount returns correct count', () => {
    act(() => {
      const store = useNotificationStore.getState();
      store.addNotification({ type: 'metal_alert', title: 'A', message: 'a' });
      store.addNotification({ type: 'metal_alert', title: 'B', message: 'b' });
    });
    expect(useNotificationStore.getState().unreadCount()).toBe(2);
    const id = useNotificationStore.getState().notifications[0].id;
    act(() => useNotificationStore.getState().markRead(id));
    expect(useNotificationStore.getState().unreadCount()).toBe(1);
  });

  it('newest notification is first', () => {
    act(() => {
      const store = useNotificationStore.getState();
      store.addNotification({ type: 'metal_alert', title: 'First', message: '' });
      store.addNotification({ type: 'metal_alert', title: 'Second', message: '' });
    });
    const titles = useNotificationStore.getState().notifications.map(n => n.title);
    expect(titles).toEqual(['Second', 'First']);
  });
});
