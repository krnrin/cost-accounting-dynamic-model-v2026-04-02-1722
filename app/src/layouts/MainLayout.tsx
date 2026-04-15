import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Badge, Layout, Button, Toast, Typography } from '@douyinfe/semi-ui';
import {
  IconHome,
  IconFile, IconBell, IconUser
} from '@douyinfe/semi-icons';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { syncEngine } from '@/sync/syncEngine';
import Breadcrumb from '@/components/Breadcrumb';
import { fetchAlertSummary } from '@/lib/alertEventApi';
import { useAuthStore } from '@/store/authStore';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

export default function MainLayout() {
  const { sidebarCollapsed } = useUIStore();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProjectId, currentScenarioId } = useProjectStore();
  const [activeAlertCount, setActiveAlertCount] = useState(0);

  const isImmersive = location.pathname.includes('/workbook') ||
                      location.pathname.includes('/edit') ||
                      location.pathname.includes('/simulation');
  
  const showSider = !isImmersive && (!isMobile || !collapsed);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getSelectedKey = () => {
    const path = location.pathname;
    if (currentProjectId) {
      if (path.includes('/simulation')) return `/project/${currentProjectId}/simulation`;
      if (path.includes('/alloc')) return `/project/${currentProjectId}/alloc`;
      if (path.includes('/change-engine')) return `/project/${currentProjectId}/change-engine`;
      if (path.includes('/tracking')) return `/project/${currentProjectId}/tracking`;
      if (path.includes('/quote')) return `/project/${currentProjectId}/quote`;
      if (path.includes('/annual-drop')) return `/project/${currentProjectId}/annual-drop`;
      if (path.startsWith(`/project/${currentProjectId}`)) return `/project/${currentProjectId}`;
    }
    if (path.startsWith('/manager')) return '/manager';
    if (path.startsWith('/alerts') || path.includes('/alerts')) return '/alerts';
    if (path.startsWith('/profile')) return '/profile';
    if (path.startsWith('/settings')) return '/settings';
    return '/';
  };

  const selectedKey = getSelectedKey();

  useEffect(() => {
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAlertBadge = async () => {
      try {
        const summary = await fetchAlertSummary(currentProjectId || undefined);
        if (!cancelled) setActiveAlertCount(summary.active + summary.acknowledged);
      } catch {
        if (!cancelled) setActiveAlertCount(0);
      }
    };
    void loadAlertBadge();
  }, [currentProjectId, location.pathname]);

  const hasProject = !!currentProjectId;
  const hasScenario = !!currentScenarioId;

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
      if (hasProject) navigate(`/project/${currentProjectId}/alerts`);
      else navigate('/alerts');
      return;
    }
    if (hasProject && hasScenario) navigate(`/project/${currentProjectId}/s/${currentScenarioId}/${sub}`);
    else if (hasProject) navigate(`/project/${currentProjectId}`);
  };

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
            <div 
              style={{ cursor: 'pointer', opacity: selectedKey === '/' ? 1 : 0.4, transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              onClick={() => navigate('/')}
            >
              <IconHome style={{ fontSize: 24, color: 'var(--accent-hover)' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>项目</span>
            </div>
            <div 
              style={{ cursor: 'pointer', opacity: selectedKey === '/manager' ? 1 : 0.4, transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              onClick={() => navigate('/manager')}
            >
              <IconFile style={{ fontSize: 24, color: 'var(--accent-hover)' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>报表</span>
            </div>
            <div
              style={{ cursor: 'pointer', opacity: selectedKey === '/alerts' ? 1 : 0.4, transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              onClick={() => navigate(currentProjectId ? `/project/${currentProjectId}/alerts` : '/alerts')}
            >
              <Badge count={activeAlertCount} overflowCount={99}>
                <IconBell style={{ fontSize: 24, color: 'var(--accent-hover)' }} />
              </Badge>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>预警</span>
            </div>
            <div
              style={{ cursor: 'pointer', opacity: selectedKey === '/profile' ? 1 : 0.4, transition: '0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              onClick={() => navigate('/profile')}
            >
              <IconUser style={{ fontSize: 24, color: 'var(--accent-hover)' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>我的</span>
            </div>
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
            zIndex: 90
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="top-nav-capsule" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px' }}>
            <div 
              className={selectedKey === '/' ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: 'pointer', fontSize: 13, transition: '0.2s', color: selectedKey === '/' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              onClick={() => navigate('/')}
            >
              总览
            </div>
            <div
              className={selectedKey === '/manager' ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: 'pointer', fontSize: 13, transition: '0.2s', color: selectedKey === '/manager' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              onClick={() => navigate('/manager')}
            >
              分析
            </div>
            <div
              className={selectedKey.includes('/quote') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/quote') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('quote')}
            >
              报价
            </div>
            <div
              className={selectedKey.includes('/annual-drop') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/annual-drop') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('annual-drop')}
            >
              价格
            </div>
            <div
              className={selectedKey.includes('/simulation') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/simulation') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('simulation')}
            >
              模拟
            </div>
            <div
              className={selectedKey.includes('/alloc') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/alloc') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('alloc')}
            >
              分摊
            </div>
            <div
              className={selectedKey.includes('/change-engine') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/change-engine') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('change-engine')}
            >
              设变
            </div>
            <div
              className={selectedKey.includes('/tracking') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/tracking') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('tracking')}
            >
              跟踪
            </div>
            <div
              className={selectedKey.includes('/config') ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: hasProject ? 'pointer' : 'not-allowed', fontSize: 13, transition: '0.2s', color: selectedKey.includes('/config') ? 'var(--text-primary)' : hasProject ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => navToProject('config')}
            >
              配置
            </div>
            <div
              className={selectedKey === '/settings' ? 'nav-active-pill' : ''}
              style={{ padding: '8px 24px', cursor: 'pointer', fontSize: 13, transition: '0.2s', color: selectedKey === '/settings' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              onClick={() => navigate('/settings')}
            >
              设置
            </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                <Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{user?.name || '未登录用户'}</Text>
                <Text type="tertiary" style={{ fontSize: 11, color: 'var(--accent-hover)' }}>{user?.role || 'GUEST'}</Text>
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
            zIndex: 1
          }}
        >
          <div 
            style={{ padding: isImmersive ? 0 : 24, minHeight: '100%' }}
          >
            {!isImmersive && location.pathname !== '/' && <Breadcrumb />}
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
