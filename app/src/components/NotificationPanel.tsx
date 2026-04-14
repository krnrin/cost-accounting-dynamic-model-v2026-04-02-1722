import { Popover, Badge, Button, List, Typography, Empty } from '@douyinfe/semi-ui';
import { IconBell, IconDelete } from '@douyinfe/semi-icons';
import { useNotificationStore } from '@/store/notificationStore';

const { Text } = Typography;

export default function NotificationPanel() {
  const { notifications, markRead, markAllRead, clearAll } = useNotificationStore();
  const unreadCount = notifications.filter(n => !n.read).length;

  const content = (
    <div style={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--semi-color-border)' }}>
        <Text strong>通知</Text>
        <div>
          {unreadCount > 0 && (
            <Button type="tertiary" size="small" onClick={markAllRead} style={{ marginRight: 4 }}>
              全部已读
            </Button>
          )}
          <Button type="tertiary" size="small" icon={<IconDelete />} onClick={clearAll} />
        </div>
      </div>
      {notifications.length === 0 ? (
        <Empty description="暂无通知" style={{ padding: 24 }} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              onClick={() => markRead(item.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: item.read ? 'transparent' : 'rgba(108,126,225,0.08)',
              }}
            >
              <div>
                <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                <br />
                <Text type="tertiary" style={{ fontSize: 12 }}>{item.message}</Text>
                <br />
                <Text type="quaternary" style={{ fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover content={content} position="bottomRight" trigger="click" showArrow>
      <Badge count={unreadCount} overflowCount={99}>
        <Button
          icon={<IconBell />}
          type="tertiary"
          theme="borderless"
          style={{ marginRight: 8 }}
        />
      </Badge>
    </Popover>
  );
}
