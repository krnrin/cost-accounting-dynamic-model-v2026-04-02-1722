import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Avatar,
  Tag,
  Table,
  Button,
  Radio,
  RadioGroup,
  Row,
  Col,
  Modal,
  Toast,
  Form,
} from '@douyinfe/semi-ui';
import { IconUser, IconExit } from '@douyinfe/semi-icons';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchProfilePermissions, fetchUsers, updateProfile, type ProfilePermissionRow, type UserSummary } from '@/lib/profileApi';

const { Title, Text } = Typography;

type UserRole = 'ADMIN' | 'MANAGER' | 'ENGINEER' | 'VIEWER';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '系统管理员',
  MANAGER: '项目经理',
  ENGINEER: '工程师',
  VIEWER: '只读用户',
};

const PERMISSION_LABELS: Record<string, string> = {
  profit: '利润查看',
  profitRate: '利润率查看',
  mgmtFee: '管理费查看',
  mgmtRate: '管理费率查看',
  costRates: '成本费率配置',
  metalPrice: '金属价格管理',
  internalCost: '内部核算查看',
  bomEdit: 'BOM 编辑',
  quoteExport: '报价导出',
  simulation: '模拟参数调整',
  changeExport: '设变导出',
  versionLock: '版本锁定',
  auditLog: '审计日志查看',
  auditPublish: '审计发布',
  deleteProject: '删除项目',
  deleteHarness: '删除线束',
};

export default function ProfilePage() {
  const { user, authSource, logout, refreshProfile, savePreferences } = useAuthStore();
  const { themeMode, setThemeMode } = useSettingsStore();
  const navigate = useNavigate();
  const [permissionRows, setPermissionRows] = useState<ProfilePermissionRow[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const permissions = await fetchProfilePermissions();
        if (!cancelled) {
          setPermissionRows(permissions.permissions);
        }
      } catch {
        if (!cancelled) setPermissionRows([]);
      }

      try {
        const userList = await fetchUsers();
        if (!cancelled) {
          setUsers(userList);
        }
      } catch {
        if (!cancelled) setUsers([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const permissionStats = useMemo(() => {
    const total = permissionRows.length;
    const allowed = permissionRows.filter(r => r.allowed).length;
    return { total, allowed, denied: total - allowed };
  }, [permissionRows]);

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '退出后需要重新登录，确定继续？',
      onOk: async () => {
        await logout();
        Toast.success('已退出登录');
        navigate('/');
      },
    });
  };

  const handleSaveProfile = async (values: { name: string; email: string }) => {
    setSavingProfile(true);
    try {
      await updateProfile(values);
      await refreshProfile();
      Toast.success('个人信息已更新');
    } catch (error: any) {
      Toast.error(error.message || '保存失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async (values: { notifications: { alerts: boolean; system: boolean; releases: boolean } }) => {
    setSavingPreferences(true);
    try {
      await savePreferences({
        themeMode,
        notifications: values.notifications,
      });
      Toast.success('个人偏好已保存');
    } catch (error: any) {
      Toast.error(error.message || '保存失败');
    } finally {
      setSavingPreferences(false);
    }
  };

  const notificationInitial = user?.preferences?.notifications || {
    alerts: true,
    system: true,
    releases: false,
  };

  return (
    <div className="page-container" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <Title heading={2} className="ink-heading" style={{ marginBottom: 28 }}>用户配置</Title>

      <div className="glass-card animate-fade-up" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'rgba(0,0,0,0.08)' }} />
        <div style={{ padding: '32px 40px 36px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 24 }}>
            <Avatar size="large" style={{ backgroundColor: '#d4d4d8', width: 72, height: 72, fontSize: 26, flexShrink: 0 }} src={user?.avatarUrl}>
              {user?.name?.[0] || <IconUser />}
            </Avatar>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <Title heading={3} className="ink-heading" style={{ margin: '0 0 4px' }}>{user?.name || '未知用户'}</Title>
              <Text type="tertiary" style={{ fontSize: 14 }}>{user?.email || 'offline@local'}</Text>
            </div>
            <Button type="danger" icon={<IconExit />} onClick={handleLogout} style={{ borderRadius: 10 }}>
              退出登录
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {user?.role ? ROLE_LABELS[user.role as UserRole] || user.role : '离线模式'}
              </span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {authSource === 'feishu' ? '飞书登录' : '本地登录'}
              </span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {permissionStats.allowed}/{permissionStats.total} 权限
              </span>
            </div>
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <div className="glass-card animate-fade-up" style={{ padding: 28, height: '100%' }}>
            <Title heading={5} className="ink-heading" style={{ marginTop: 0, marginBottom: 20 }}>个人信息</Title>
            <Form initValues={{ name: user?.name || '', email: user?.email || '' }} onSubmit={handleSaveProfile}>
              <Form.Input field="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]} />
              <Form.Input field="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }]} />
              <Button htmlType="submit" type="primary" loading={savingProfile}>保存个人信息</Button>
            </Form>
          </div>
        </Col>

        <Col span={12}>
          <div className="glass-card animate-fade-up" style={{ padding: 28, height: '100%' }}>
            <Title heading={5} className="ink-heading" style={{ marginTop: 0, marginBottom: 20 }}>个人偏好</Title>
            <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>主题模式</Text>
            <RadioGroup
              type="button"
              buttonSize="middle"
              value={themeMode}
              onChange={e => setThemeMode(e.target.value)}
              style={{ width: '100%', marginBottom: 24 }}
            >
              <Radio value="light" style={{ flex: 1, textAlign: 'center' }}>浅色</Radio>
              <Radio value="dark" style={{ flex: 1, textAlign: 'center' }}>深色</Radio>
              <Radio value="system" style={{ flex: 1, textAlign: 'center' }}>跟随系统</Radio>
            </RadioGroup>

            <Form initValues={{ notifications: notificationInitial }} onSubmit={handleSavePreferences}>
              <Form.Slot label={{ text: '通知设置' }}>
                <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                  <Form.Switch field="notifications.alerts" label="预警通知" />
                  <Form.Switch field="notifications.system" label="系统通知" />
                  <Form.Switch field="notifications.releases" label="版本发布通知" />
                </div>
              </Form.Slot>
              <Button htmlType="submit" type="primary" loading={savingPreferences}>保存偏好</Button>
            </Form>
          </div>
        </Col>

        <Col span={12}>
          <div className="glass-card animate-fade-up" style={{ padding: 28, height: '100%' }}>
            <Title heading={5} className="ink-heading" style={{ marginTop: 0, marginBottom: 20 }}>会话信息</Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: '用户 ID', value: user?.id || '-', mono: true },
                { label: '认证来源', value: authSource === 'feishu' ? '飞书 OAuth' : '本地密码', mono: false },
                ...(user?.feishuOpenId ? [{ label: '飞书 OpenID', value: user.feishuOpenId, mono: true }] : []),
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.02)' }}>
                  <Text style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</Text>
                  <Text className={item.mono ? 'consolas-font' : ''} style={{ fontSize: 13 }}>{item.value}</Text>
                </div>
              ))}
            </div>
          </div>
        </Col>

        <Col span={12}>
          <div className="glass-card animate-fade-up" style={{ padding: 28, height: '100%' }}>
            <Title heading={5} className="ink-heading" style={{ marginTop: 0, marginBottom: 20 }}>用户列表</Title>
            <Table
              columns={[
                { title: '姓名', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
                { title: '角色', dataIndex: 'role', width: 120, render: (v: string) => <Tag size="small">{ROLE_LABELS[v as UserRole] || v}</Tag> },
              ]}
              dataSource={users}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        </Col>

        <Col span={24}>
          <div className="glass-card animate-fade-up" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title heading={5} className="ink-heading" style={{ margin: 0 }}>权限概览</Title>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="consolas-font" style={{ fontSize: 22, fontWeight: 800, color: '#000' }}>{permissionStats.allowed}</div>
                  <Text style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>允许</Text>
                </div>
                <div style={{ width: 1, background: 'rgba(0,0,0,0.06)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div className="consolas-font" style={{ fontSize: 22, fontWeight: 800, color: '#71717a' }}>{permissionStats.denied}</div>
                  <Text style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>禁止</Text>
                </div>
              </div>
            </div>
            <Table
              columns={[
                {
                  title: '功能',
                  dataIndex: 'field',
                  width: 200,
                  render: (v: string) => <Text strong style={{ fontSize: 13 }}>{PERMISSION_LABELS[v] || v}</Text>,
                },
                {
                  title: '最低角色',
                  dataIndex: 'minRole',
                  width: 140,
                  render: (v: string) => <Tag size="small" style={{ borderRadius: 6 }}>{ROLE_LABELS[v as UserRole] || v}</Tag>,
                },
                {
                  title: '当前权限',
                  dataIndex: 'allowed',
                  width: 120,
                  align: 'center' as const,
                  render: (v: boolean) => (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, background: v ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.02)', border: `1px solid ${v ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.04)'}` }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: v ? '#000' : '#a1a1aa' }}>
                        {v ? '允许' : '禁止'}
                      </span>
                    </div>
                  ),
                },
              ]}
              dataSource={permissionRows}
              rowKey="field"
              pagination={false}
              size="small"
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
