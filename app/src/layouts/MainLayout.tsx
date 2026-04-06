import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Nav, Button, Typography, Dropdown, Avatar } from '@douyinfe/semi-ui';
import {
  IconHome, IconSetting, IconPlus, IconGridView, IconCalendarClock, IconActivity, IconPieChart2Stroked, IconMenu, IconExit,
  IconSend
} from '@douyinfe/semi-icons';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import NotificationPanel from '@/components/NotificationPanel';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { syncEngine } from '@/sync/syncEngine';
import Breadcrumb from '@/components/Breadcrumb';

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;

export default function MainLayout() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const location = useLocation();
  const { projectName, currentProjectId } = useProjectStore();
  const { user, logout } = useAuthStore();

  // ── 沉浸式布局判断 (Issue #37/44) ──
  const isImmersive = location.pathname.includes('/workbook') || 
                      location.pathname.includes('/edit') ||
                      location.pathname.includes('/simulation');
  
  const headerHeight = isImmersive ? 48 : 52;
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

  const navItems = [
    { itemKey: '/', text: '项目列表', icon: <IconHome /> },
    { itemKey: '/manager', text: '管理仪表盘', icon: <IconPieChart2Stroked /> },
    ...(currentProjectId ? [
      { itemKey: 'project-group', text: '当前项目', icon: <IconGridView />, items: [
        { itemKey: `/project/${currentProjectId}`, text: '项目仪表盘', icon: <IconHome /> },
        { itemKey: `/project/${currentProjectId}/simulation`, text: '预演', icon: <IconActivity /> },
        { itemKey: `/project/${currentProjectId}/quote`, text: '核价', icon: <IconSend /> },
        { itemKey: `/project/${currentProjectId}/annual-drop`, text: '跟踪', icon: <IconCalendarClock /> },
      ]} as any,
    ] : []),
    { itemKey: '/settings', text: '设置', icon: <IconSetting /> },
  ];

  // Correct sidebar active state highlighting
  const getSelectedKey = () => {
    const path = location.pathname;
    if (currentProjectId) {
      if (path.includes('/simulation')) return `/project/${currentProjectId}/simulation`;
      if (path.includes('/quote')) return `/project/${currentProjectId}/quote`;
      if (path.includes('/annual-drop')) return `/project/${currentProjectId}/annual-drop`;
      // Project dashboard or harness detail pages
      if (path.startsWith(`/project/${currentProjectId}`)) return `/project/${currentProjectId}`;
    }
    if (path.startsWith('/manager')) return '/manager';
    if (path.startsWith('/settings')) return '/settings';
    if (path.startsWith('/project/')) return '/';
    return '/';
  };

  const selectedKey = getSelectedKey();

  useEffect(() => {
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);

  return (
    <Layout style={{ height: '100vh', background: 'transparent' }}>
      {/* Global Animated Background */}
      <div className="animated-bg" />

      {showSider && (
        <Sider
          className="green-glass-panel"
          style={{ 
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            display: isMobile && collapsed ? 'none' : 'block',
            position: isMobile ? 'absolute' : 'relative',
            zIndex: 100,
            height: '100%',
            width: isMobile ? 240 : 200,
            boxShadow: '4px 0 30px rgba(0, 0, 0, 0.5)'
          }}
        >
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconGridView style={{ fontSize: 20, color: 'var(--semi-color-primary)' }} />
          {(!collapsed || isMobile) && (
            <Title heading={5} style={{ margin: 0, color: 'var(--semi-color-text-0)' }} className="glow-text">
              COST ENGINE
            </Title>
          )}
        </div>

        <div style={{ padding: '8px 12px' }}>
          <Button
            className="btn-gradient"
            type="primary"
            block
            icon={<IconPlus />}
            onClick={() => navigate('/wizard')}
          >
            {(!collapsed || isMobile) && '新建项目'}
          </Button>
        </div>

        <Nav
          selectedKeys={[selectedKey]}
          style={{ background: 'transparent' }}
          items={navItems}
          onSelect={({ itemKey }) => {
            navigate(itemKey as string);
            if (isMobile) setCollapsed(true);
          }}
          isCollapsed={!isMobile && collapsed}
          onCollapseChange={(val) => { setCollapsed(val); toggleSidebar(); }}
          footer={{ collapseButton: !isMobile }}
        />
      </Sider>
      )}

      <Layout style={{ background: 'transparent' }}>
        <Header
          className="green-glass-panel"
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: headerHeight,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
            color: '#fff',
            position: 'relative',
            zIndex: 90
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <Button
                icon={<IconMenu />}
                aria-label="菜单"
                theme="borderless"
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
            <Text style={{ color: 'var(--semi-color-text-2)', fontSize: 14 }} className={isImmersive ? "glow-text" : ""}>
              {projectName || '高压线束精算引擎 PRO'}
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SyncStatusIndicator />
            <NotificationPanel />
            <Dropdown
              render={
                <Dropdown.Menu>
                  <Dropdown.Item disabled>
                    {user?.name || user?.email} ({user?.role})
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item icon={<IconExit />} onClick={logout}>
                    退出登录
                  </Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <Avatar size="small" style={{ cursor: 'pointer', background: 'var(--semi-color-primary)' }}>
                {user?.name?.charAt(0) || 'U'}
              </Avatar>
            </Dropdown>
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
            onClick={() => {
              if (isMobile && !collapsed) setCollapsed(true);
            }}
          >
            {!isImmersive && location.pathname !== '/' && <Breadcrumb />}
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
