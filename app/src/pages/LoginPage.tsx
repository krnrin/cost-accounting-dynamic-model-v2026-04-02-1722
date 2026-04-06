import { useState, useEffect } from 'react';
import { Card, Form, Button, Typography, Toast, Tabs, TabPane, Divider, Spin } from '@douyinfe/semi-ui';
import { IconGridView, IconLink } from '@douyinfe/semi-icons';
import { useAuthStore } from '@/store/authStore';
import { isFeishuEnv, isFeishuConfigured, redirectToFeishuOAuth } from '@/lib/feishuAuth';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login, register, feishuAutoLogin } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const inFeishu = isFeishuEnv();
  const feishuReady = isFeishuConfigured();

  // Auto-login in Feishu environment
  useEffect(() => {
    if (autoLoginAttempted) return;
    setAutoLoginAttempted(true);

    if (feishuReady) {
      setFeishuLoading(true);
      feishuAutoLogin()
        .then((success) => {
          if (success) {
            Toast.success('飞书登录成功');
          }
        })
        .catch((err) => {
          console.error('飞书自动登录失败:', err);
          Toast.error(`飞书登录失败: ${err?.message || '未知错误'}`);
        })
        .finally(() => {
          setFeishuLoading(false);
        });
    }
  }, [feishuReady, autoLoginAttempted, feishuAutoLogin]);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      Toast.success('登录成功');
    } catch (err: any) {
      Toast.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      Toast.error('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      await register(values.email, values.password, values.name, 'ENGINEER');
      Toast.success('注册成功');
    } catch (err: any) {
      Toast.error(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFeishuLogin = async () => {
    if (!feishuReady) {
      Toast.warning('飞书应用未配置，请联系管理员');
      return;
    }

    if (inFeishu) {
      // In Feishu client: use in-app login
      setFeishuLoading(true);
      try {
        const success = await feishuAutoLogin();
        if (success) {
          Toast.success('飞书登录成功');
        } else {
          Toast.error('飞书登录失败，请重试');
        }
      } catch (err: any) {
        Toast.error(err.message || '飞书登录失败');
      } finally {
        setFeishuLoading(false);
      }
    } else {
      // In browser: redirect to Feishu OAuth
      redirectToFeishuOAuth();
    }
  };

  // Show a loading screen while auto-login is in progress
  if (feishuLoading && inFeishu) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--semi-color-bg-0)',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <Text type="tertiary">正在通过飞书免登...</Text>
      </div>
    );
  }

  return (
    <>
      <div className="animated-bg" />

      <div className="login-container">
        <Card
          className="glass-panel"
          style={{
            width: 420,
            padding: '16px 8px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.45)', // Lighter for light mode
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', padding: 12, borderRadius: 16, background: 'rgba(59, 130, 246, 0.1)', marginBottom: 16 }}>
              <IconGridView style={{ fontSize: 42, color: '#3b82f6', filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' }} />
            </div>
            <Title heading={3} style={{ margin: '0 0 8px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              COST ENGINE <span style={{ color: '#3b82f6' }}>PRO</span>
            </Title>
            <Text type="tertiary" style={{ fontSize: 14 }}>高压线束精算与决策引擎</Text>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} className="glass-tabs">
            <TabPane tab="系统登录" itemKey="login">
              <Form onSubmit={handleLogin} style={{ marginTop: 24 }}>
                <Form.Input
                  field="email"
                  label="工作邮箱"
                  className="glass-input"
                  placeholder="admin@harness.dev"
                  rules={[{ required: true, message: '请输入邮箱' }]}
                />
                <Form.Input
                  field="password"
                  label="访问密码"
                  mode="password"
                  className="glass-input"
                  placeholder="••••••••"
                  rules={[{ required: true, message: '请输入密码' }]}
                />
                <Button
                  htmlType="submit"
                  type="primary"
                  className="btn-gradient"
                  block
                  size="large"
                  loading={loading}
                  style={{ marginTop: 24 }}
                >
                  验证身份并进入
                </Button>
              </Form>
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Text type="tertiary" size="small" style={{ opacity: 0.8 }}>
                  默认账号: admin@harness.dev / admin123
                </Text>
                <Divider style={{ margin: '24px 0 16px', opacity: 0.5 }}>
                  <Text type="tertiary" size="small">或使用企业网关</Text>
                </Divider>
                <Button
                  icon={<IconLink />}
                  block
                  size="large"
                  loading={feishuLoading}
                  disabled={!feishuReady}
                  onClick={handleFeishuLogin}
                  style={{ marginBottom: 8, borderRadius: 8, background: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(255, 255, 255, 0.8)', color: '#1e293b' }}
                >
                  {inFeishu ? '飞书环境免登' : '飞书 OAuth 授权登录'}
                </Button>
                {!feishuReady && (
                  <Text type="tertiary" size="small" style={{ color: 'var(--semi-color-danger)' }}>
                    未检测到 VITE_FEISHU_APP_ID 环境变量
                  </Text>
                )}
              </div>
            </TabPane>

            <TabPane tab="申请权限" itemKey="register">
              <Form onSubmit={handleRegister} style={{ marginTop: 24 }}>
                <Form.Input
                  field="name"
                  label="真实姓名"
                  className="glass-input"
                  placeholder="如：张三"
                  rules={[{ required: true, message: '请输入姓名' }]}
                />
                <Form.Input
                  field="email"
                  label="企业邮箱"
                  className="glass-input"
                  placeholder="zhangsan@company.com"
                  rules={[{ required: true, message: '请输入邮箱' }]}
                />
                <Form.Input
                  field="password"
                  label="设置密码"
                  mode="password"
                  className="glass-input"
                  placeholder="至少6位数字或字母"
                  rules={[{ required: true, message: '请输入密码' }]}
                />
                <Form.Input
                  field="confirmPassword"
                  label="确认密码"
                  mode="password"
                  className="glass-input"
                  placeholder="再次输入密码"
                  rules={[{ required: true, message: '请确认密码' }]}
                />
                <Button
                  htmlType="submit"
                  type="primary"
                  className="btn-gradient"
                  block
                  size="large"
                  loading={loading}
                  style={{ marginTop: 24 }}
                >
                  提交开通申请
                </Button>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </>
  );
}
