import { useState, useEffect } from 'react';
import { Card, Form, Button, Typography, Toast, Tabs, TabPane, Divider, Spin } from '@douyinfe/semi-ui';
import { IconGridView, IconLink } from '@douyinfe/semi-icons';
import { useAuthStore } from '@/store/authStore';
import { isFeishuEnv, isFeishuConfigured, redirectToFeishuOAuth } from '@/lib/feishuAuth';

const { Title, Text } = Typography;

const IS_DEV = import.meta.env.DEV;

/* ── extracted inline styles (avoids JSX double-brace push corruption) ── */
const loadingStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  gap: 16,
};
const cardStyle = { width: 420, padding: '40px 32px', borderRadius: 20 };
const headerStyle = { textAlign: 'center' as const, marginBottom: 32 };
const iconWrapStyle = { marginBottom: 12 };
const iconStyle = { fontSize: 40, color: 'var(--semi-color-primary)' };
const titleStyle = { marginBottom: 4 };
const proStyle = { color: 'var(--semi-color-primary)' };
const subtitleStyle = { fontSize: 13 };
const mt16Style = { marginTop: 16 };
const mt24Style = { marginTop: 24 };
const mt8Style = { marginTop: 8 };
const devHintStyle = { display: 'block' as const, textAlign: 'center' as const, marginBottom: 8 };
const dividerStyle = { margin: '12px 0' };
const feishuHintStyle = { display: 'block' as const, textAlign: 'center' as const, marginTop: 8 };

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
      redirectToFeishuOAuth();
    }
  };

  if (feishuLoading && inFeishu) {
    return (
      <div style={loadingStyle}>
        <Spin size="large" />
        <Text type="tertiary">正在通过飞书免登...</Text>
      </div>
    );
  }

  return (
    <>
      <div className="animated-bg" />

      <div className="login-container">
        <Card className="glass-panel" style={cardStyle}>
          <div style={headerStyle}>
            <div style={iconWrapStyle}>
              <IconGridView style={iconStyle} />
            </div>
            <Title heading={3} style={titleStyle}>
              COST ENGINE <span style={proStyle}>PRO</span>
            </Title>
            <Text type="tertiary" style={subtitleStyle}>高压线束精算与决策引擎</Text>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} className="glass-tabs">
            <TabPane tab="系统登录" itemKey="login">
              <Form
                onSubmit={handleLogin}
                style={mt16Style}
                {...(IS_DEV ? { initValues: { email: 'admin@harness.dev' } } : {})}
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
                  style={mt16Style}
                >
                  验证身份并进入
                </Button>
              </Form>
              <div style={mt24Style}>
                {IS_DEV && (
                  <Text type="tertiary" size="small" style={devHintStyle}>
                    开发模式 — 无后端时自动离线登录
                  </Text>
                )}
                <Divider style={dividerStyle}>
                  <Text type="tertiary" size="small">或使用企业网关</Text>
                </Divider>
                <Button
                  icon={<IconLink />}
                  block
                  size="large"
                  loading={feishuLoading}
                  disabled={!feishuReady}
                  onClick={handleFeishuLogin}
                  style={mt8Style}
                >
                  {inFeishu ? '飞书环境免登' : '飞书 OAuth 授权登录'}
                </Button>
                {!feishuReady && (
                  <Text type="tertiary" size="small" style={feishuHintStyle}>
                    未检测到 VITE_FEISHU_APP_ID 环境变量
                  </Text>
                )}
              </div>
            </TabPane>

            <TabPane tab="申请权限" itemKey="register">
              <Form onSubmit={handleRegister} style={mt16Style}>
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
                  style={mt16Style}
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
