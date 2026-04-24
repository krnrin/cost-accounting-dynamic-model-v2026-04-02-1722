import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Layout, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBell, IconFile, IconHome, IconUser } from '@douyinfe/semi-icons';

import Breadcrumb from '@/components/Breadcrumb';
import NotificationPanel from '@/components/NotificationPanel';
import { fetchAlertSummary } from '@/lib/alertEventApi';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { syncEngine } from '@/sync/syncEngine';

const { Content, Header, Sider } = Layout;
const { Text } = Typography;

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();
  const { currentProjectId, currentScenarioId } = useProjectStore();

  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeAlertCount, setActiveAlertCount] = useState(0);

  const isImmersive = location.pathname.includes('/workbook')
    || location.pathname.includes('/edit')
    || location.pathname.includes('/simulation');
  const showSider = !isImmersive && (!isMobile || !collapsed);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAlertBadge = async () => {
      try {
        const summary = await fetchAlertSummary(currentProjectId || undefined);
        if (!cancelled) {
          setActiveAlertCount(summary.active + summary.acknowledged);
        }
      } catch {
        if (!cancelled) {
          setActiveAlertCount(0);
        }
      }
    };

    void loadAlertBadge();
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, location.pathname]);

  const hasProject = Boolean(currentProjectId);
  const hasScenario = Boolean(currentScenarioId);

  const getSelectedKey = () => {
    const path = location.pathname;
    if (currentProjectId) {
      if (path.includes('/workbench')) return `/project/${currentProjectId}/workbench`;
      if (path.includes('/simulation')) return `/project/${currentProjectId}/simulation`;
      if (path.includes('/alloc')) return `/project/${currentProjectId}/alloc`;
      if (path.includes('/change-engine')) return `/project/${currentProjectId}/change-engine`;
      if (path.includes('/tracking')) return `/project/${currentProjectId}/tracking`;
      if (path.includes('/quote')) return `/project/${currentProjectId}/quote`;
      if (path.includes('/annual-drop')) return `/project/${currentProjectId}/annual-drop`;
      if (path.includes('/config')) return `/project/${currentProjectId}/config`;
      if (path.startsWith(`/project/${currentProjectId}`)) return `/project/${currentProjectId}`;
    }
    if (path.startsWith('/manager')) return '/manager';
    if (path.startsWith('/alerts') || path.includes('/alerts')) return '/alerts';
    if (path.startsWith('/profile')) return '/profile';
    if (path.startsWith('/settings')) return '/settings';
    return '/';
  };

  const selectedKey = getSelectedKey();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error: any) {
      Toast.error(error?.message || '退出登录失败');
    }
  };

  const navToProject = (sub: string) => {
    if (sub === 'alerts') {
      if (hasProject) {
        navigate(`/project/${currentProjectId}/alerts`);
      } else {
        navigate('/alerts');
      }
      return;
    }

    if (hasProject && hasScenario) {
      navigate(`/project/${currentProjectId}/s/${currentScenarioId}/${sub}`);
      return;
    }

    if (hasProject) {
      navigate(`/project/${currentProjectId}`);
    }
  };

  const sideNavItems = [
    { key: '/', label: '项目', icon: <IconHome style={{ fontSize: 24, color: 'var(--accent-hover)' }} />, onClick: () => navigate('/') },
    { key: '/manager', label: '报表', icon: <IconFile style={{ fontSize: 24, color: 'var(--accent-hover)' }} />, onClick: () => navigate('/manager') },
    {
      key: '/alerts',
      label: '预警',
      icon: (
        <Badge count={activeAlertCount} overflowCount={99}>
          <IconBell style={{ fontSize: 24, color: 'var(--accent-hover)' }} />
        </Badge>
      ),
      onClick: () => navigate(currentProjectId ? `/project/${currentProjectId}/alerts` : '/alerts'),
    },
    { key: '/profile', label: '我的', icon: <IconUser style={{ fontSize: 24, color: 'var(--accent-hover)' }} />, onClick: () => navigate('/profile') },
  ];

  const topNavItems = [
    { key: '/', label: '总览', onClick: () => navigate('/'), disabled: false },
    { key: '/manager', label: '分析', onClick: () => navigate('/manager'), disabled: false },
    { key: 'workbench', label: '工作台', onClick: () => navToProject('workbench'), disabled: !hasProject },
    { key: 'quote', label: '报价', onClick: () => navToProject('quote'), disabled: !hasProject },
    { key: 'annual-drop', label: '价格', onClick: () => navToProject('annual-drop'), disabled: !hasProject },
    { key: 'simulation', label: '模拟', onClick: () => navToProject('simulation'), disabled: !hasProject },
    { key: 'alloc', label: '分摊', onClick: () => navToProject('alloc'), disabled: !hasProject },
    { key: 'change-engine', label: '设变', onClick: () => navToProject('change-engine'), disabled: !hasProject },
    { key: 'tracking', label: '跟踪', onClick: () => navToProject('tracking'), disabled: !hasProject },
    { key: 'config', label: '配置', onClick: () => navToProject('config'), disabled: !hasProject },
    { key: '/settings', label: '设置', onClick: () => navigate('/settings'), disabled: false },
  ];

  return (
    <Layout className="blueprint-shell" style={{ height: '100vh', background: 'transparent', overflow: 'hidden', position: 'relative' }}>
      <div className="industrial-backdrop blueprint-grid" />

      {showSider && (
        <Sider
          style={{
            background: 'transparent',
            display: isMobile && collapsed ? 'none' : 'block',
            position: isMobile ? 'absolute' : 'relative',
            zIndex: 100,
            height: 'fit-content',
            alignSelf: 'center',
            margin: '0 0 0 24px',
            width: 84,
          }}
        >
          <div className="sidebar-capsule" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '32px 0' }}>
            {sideNavItems.map((item) => (
              <div
                key={item.key}
                style={{
                  cursor: 'pointer',
                  opacity: selectedKey === item.key ? 1 : 0.4,
                  transition: '0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={item.onClick}
              >
                {item.icon}
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </Sider>
      )}

      <Layout style={{ background: 'transparent' }}>
        <Header
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 80,
            background: 'transparent',
            position: 'relative',
            zIndex: 90,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="top-nav-capsule" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px' }}>
              {topNavItems.map((item) => {
                const isActive = item.key.startsWith('/')
                  ? selectedKey === item.key
                  : selectedKey.includes(`/${item.key}`);
                return (
                  <div
                    key={item.key}
                    className={isActive ? 'nav-active-pill' : ''}
                    style={{
                      padding: '8px 24px',
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      transition: '0.2s',
                      color: isActive ? 'var(--text-primary)' : item.disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                    }}
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick();
                      }
                    }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--panel-bg-strong)',
                backdropFilter: 'blur(16px)',
                boxShadow: 'var(--shadow-panel)',
              }}
            >
              <NotificationPanel />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                <Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                  {user?.name || '未登录用户'}
                </Text>
                <Text type="tertiary" style={{ fontSize: 11, color: 'var(--accent-hover)' }}>
                  {user?.role || 'GUEST'}
                </Text>
              </div>
              <Button theme="borderless" type="danger" size="small" onClick={handleLogout}>
                退出
              </Button>
            </div>
          </div>
        </Header>

        <Content
          style={{
            background: 'transparent',
            overflow: 'auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ padding: isImmersive ? 0 : 24, minHeight: '100%' }}>
            {!isImmersive && location.pathname !== '/' && <Breadcrumb />}
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
