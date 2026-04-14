import { useState, useEffect } from 'react';
import { Card, Form, Button, Typography, Toast, Tabs, TabPane, Divider, Spin } from '@douyinfe/semi-ui';
import { IconGridView, IconLink } from '@douyinfe/semi-icons';
import { useAuthStore } from '@/store/authStore';
import { isFeishuEnv, isFeishuConfigured, redirectToFeishuOAuth } from '@/lib/feishuAuth';

const { Title, Text } = Typography;

const IS_DEV = import.meta.env.DEV;

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
        style=
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 16,
        
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
          style=
            width: 420,
            padding: '40px 32px',
            borderRadius: 20,
          
        >
          <div style= textAlign: 'center', marginBottom: 32 >
            <div style= marginBottom: 12 >
              <IconGridView style= fontSize: 40, color: 'var(--semi-color-primary)'  />
            </div>
            <Title heading={3} style= marginBottom: 4 >
              COST ENGINE <span style= color: 'var(--semi-color-primary)' >PRO</span>
            </Title>
            <Text type="tertiary" style= fontSize: 13 >高压线束精算与决策引擎</Text>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} className="glass-tabs">
            <TabPane tab="系统登录" itemKey="login">
              <Form
                onSubmit={handleLogin}
                style= marginTop: 16 
                {...(IS_DEV ? { initValues: { email: 'admin@harness.dev', password: 'admin123' } } : {})}
              >
                <Form.Input
                  field="email"
                  label="工作邮箱"
                  className="glass-input"
                  placeholder="your@company.com"
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
                  style= marginTop: 16 
                >
                  验证身份并进入
                </Button>
              </Form>
              <div style= marginTop: 24 >
                {IS_DEV && (
                  <Text type="tertiary" size="small" style= display: 'block', textAlign: 'center', marginBottom: 8 >
                    开发模式 — 无后端时自动离线登录
                  </Text>
                )}
                <Divider style= margin: '12px 0' >
                  <Text type="tertiary" size="small">或使用企业网关</Text>
                </Divider>
                <Button
                  icon={<IconLink />}
                  block
                  size="large"
                  loading={feishuLoading}
                  disabled={!feishuReady}
                  onClick={handleFeishuLogin}
                  style= marginTop: 8 
                >
                  {inFeishu ? '飞书环境免登' : '飞书 OAuth 授权登录'}
                </Button>
                {!feishuReady && (
                  <Text type="tertiary" size="small" style= display: 'block', textAlign: 'center', marginTop: 8 >
                    未检测到 VITE_FEISHU_APP_ID 环境变量
                  </Text>
                )}
              </div>
            </TabPane>

            <TabPane tab="申请权限" itemKey="register">
              <Form onSubmit={handleRegister} style= marginTop: 16 >
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
                  style= marginTop: 16 
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
