/**
 * 用户配置页 — 个人信息 + 权限概览 + 主题偏好 + 会话管理
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Avatar, Tag, Table, Button, Radio, RadioGroup, Row, Col, Modal, Toast,
} from '@douyinfe/semi-ui';
import { IconUser, IconExit } from '@douyinfe/semi-icons';
import { useAuthStore } from '@/store/authStore';
import { usePermission, type PermissionField, type UserRole } from '@/hooks/usePermission';
import { useSettingsStore } from '@/store/settingsStore';

const { Title, Text } = Typography;

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '系统管理员',
  MANAGER: '项目经理',
  ENGINEER: '工程师',
  VIEWER: '只读用户',
};

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: '#000000',
  MANAGER: '#27272a',
  ENGINEER: '#3f3f46',
  VIEWER: '#71717a',
};

const PERMISSION_LABELS: Record<PermissionField, string> = {
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

const ROLE_MIN: Record<PermissionField, UserRole> = {
  profit: 'MANAGER', profitRate: 'MANAGER', mgmtFee: 'MANAGER', mgmtRate: 'MANAGER',
  costRates: 'ADMIN', metalPrice: 'ENGINEER', internalCost: 'MANAGER', bomEdit: 'ENGINEER',
  quoteExport: 'ENGINEER', simulation: 'ENGINEER', changeExport: 'ENGINEER',
  versionLock: 'MANAGER', auditLog: 'MANAGER', auditPublish: 'ADMIN',
  deleteProject: 'ADMIN', deleteHarness: 'MANAGER',
};

export default function ProfilePage() {
  const { user, authSource, logout } = useAuthStore();
  const { can, role } = usePermission();
  const { themeMode, setThemeMode } = useSettingsStore();
  const navigate = useNavigate();

  const permissionRows = useMemo(() => {
    return (Object.keys(PERMISSION_LABELS) as PermissionField[]).map(field => ({
      key: field,
      label: PERMISSION_LABELS[field],
      minRole: ROLE_LABELS[ROLE_MIN[field]] || ROLE_MIN[field],
      allowed: can(field),
    }));
  }, [can]);

  const permissionStats = useMemo(() => {
    const total = permissionRows.length;
    const allowed = permissionRows.filter(r => r.allowed).length;
    return { total, allowed, denied: total - allowed };
  }, [permissionRows]);

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '退出后需要重新登录，确定继续？',
      onOk: () => {
        logout();
        Toast.success('已退出登录');
        navigate('/');
      },
    });
  };

  return (
    <div className="page-container" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title heading={2} className="ink-heading" style={{ marginBottom: 28 }}>用户配置</Title>

      {/* Hero Profile Card */}
      <div className="glass-card animate-fade-up" style={{
        padding: 0,
        marginBottom: 20,
        overflow: 'hidden',
      }}>
        {/* Minimal top border accent */}
        <div style={{
          height: 3,
          background: 'rgba(0,0,0,0.08)',
        }} />

        <div style={{ padding: '32px 40px 36px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 24 }}>
            <Avatar size="large" style={{
              backgroundColor: '#d4d4d8',
              width: 72, height: 72, fontSize: 26,
              flexShrink: 0,
            }} src={user?.avatarUrl}>
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

          {/* Role + Auth badges — clean gray */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 10,
              background: 'rgba(0,0,0,0.05)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {role ? ROLE_LABELS[role] || role : '离线模式'}
              </span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 10,
              background: 'rgba(0,0,0,0.03)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {authSource === 'feishu' ? '飞书登录' : '本地登录'}
              </span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 10,
              background: 'rgba(0,0,0,0.03)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {permissionStats.allowed}/{permissionStats.total} 权限
              </span>
            </div>
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {/* Theme Settings */}
        <Col span={12}>
          <div className="glass-card animate-fade-up" style={{ padding: 28, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0 }}>外观设置</Title>
            </div>
            <Text style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>主题模式</Text>
            <RadioGroup
              type="button"
              buttonSize="middle"
              value={themeMode}
              onChange={e => setThemeMode(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio value="light" style={{ flex: 1, textAlign: 'center' }}>浅色</Radio>
              <Radio value="dark" style={{ flex: 1, textAlign: 'center' }}>深色</Radio>
              <Radio value="system" style={{ flex: 1, textAlign: 'center' }}>跟随系统</Radio>
            </RadioGroup>
          </div>
        </Col>

        {/* Session Info */}
        <Col span={12}>
          <div className="glass-card animate-fade-up" style={{ padding: 28, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Title heading={5} className="ink-heading" style={{ margin: 0 }}>会话信息</Title>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: '用户 ID', value: user?.id || '-', mono: true },
                { label: '认证来源', value: authSource === 'feishu' ? '飞书 OAuth' : '本地密码', mono: false },
                ...(user?.feishuOpenId ? [{ label: '飞书 OpenID', value: user.feishuOpenId, mono: true }] : []),
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(0,0,0,0.02)',
                }}>
                  <Text style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</Text>
                  <Text className={item.mono ? 'consolas-font' : ''} style={{ fontSize: 13 }}>{item.value}</Text>
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* Permission Matrix */}
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
                  dataIndex: 'label',
                  width: 200,
                  render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
                },
                {
                  title: '最低角色',
                  dataIndex: 'minRole',
                  width: 140,
                  render: (v: string) => <Tag size="small" style={{ borderRadius: 6 }}>{v}</Tag>,
                },
                {
                  title: '当前权限',
                  dataIndex: 'allowed',
                  width: 120,
                  align: 'center' as const,
                  render: (v: boolean) => (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 6,
                      background: v ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${v ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.04)'}`,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: v ? '#000' : '#a1a1aa' }}>
                        {v ? '允许' : '禁止'}
                      </span>
                    </div>
                  ),
                },
              ]}
              dataSource={permissionRows}
              rowKey="key"
              pagination={false}
              size="small"
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
