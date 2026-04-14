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
            Toast.success('\u98DE\u4E66\u767B\u5F55\u6210\u529F');
          }
        })
        .catch((err) => {
          console.error('\u98DE\u4E66\u81EA\u52A8\u767B\u5F55\u5931\u8D25:', err);
          Toast.error(`\u98DE\u4E66\u767B\u5F55\u5931\u8D25: ${err?.message || '\u672A\u77E5\u9519\u8BEF'}`);
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
      Toast.success('\u767B\u5F55\u6210\u529F');
    } catch (err: any) {
      Toast.error(err.message || '\u767B\u5F55\u5931\u8D25');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      Toast.error('\u4E24\u6B21\u5BC6\u7801\u4E0D\u4E00\u81F4');
      return;
    }
    setLoading(true);
    try {
      await register(values.email, values.password, values.name, 'ENGINEER');
      Toast.success('\u6CE8\u518C\u6210\u529F');
    } catch (err: any) {
      Toast.error(err.message || '\u6CE8\u518C\u5931\u8D25');
    } finally {
      setLoading(false);
    }
  };

  const handleFeishuLogin = async () => {
    if (!feishuReady) {
      Toast.warning('\u98DE\u4E66\u5E94\u7528\u672A\u914D\u7F6E\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458');
      return;
    }

    if (inFeishu) {
      setFeishuLoading(true);
      try {
        const success = await feishuAutoLogin();
        if (success) {
          Toast.success('\u98DE\u4E66\u767B\u5F55\u6210\u529F');
        } else {
          Toast.error('\u98DE\u4E66\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5');
        }
      } catch (err: any) {
        Toast.error(err.message || '\u98DE\u4E66\u767B\u5F55\u5931\u8D25');
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
        <Text type="tertiary">\u6B63\u5728\u901A\u8FC7\u98DE\u4E66\u514D\u767B...</Text>
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
            <Text type="tertiary" style={subtitleStyle}>\u9AD8\u538B\u7EBF\u675F\u7CBE\u7B97\u4E0E\u51B3\u7B56\u5F15\u64CE</Text>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} className="glass-tabs">
            <TabPane tab="\u7CFB\u7EDF\u767B\u5F55" itemKey="login">
              <Form
                onSubmit={handleLogin}
                style={mt16Style}
                {...(IS_DEV ? { initValues: { email: 'admin@harness.dev', password: 'admin123' } } : {})}
              >
                <Form.Input
                  field="email"
                  label="\u5DE5\u4F5C\u90AE\u7BB1"
                  className="glass-input"
                  placeholder="your@company.com"
                  rules={[{ required: true, message: '\u8BF7\u8F93\u5165\u90AE\u7BB1' }]}
                />
                <Form.Input
                  field="password"
                  label="\u8BBF\u95EE\u5BC6\u7801"
                  mode="password"
                  className="glass-input"
                  placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  rules={[{ required: true, message: '\u8BF7\u8F93\u5165\u5BC6\u7801' }]}
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
                  \u9A8C\u8BC1\u8EAB\u4EFD\u5E76\u8FDB\u5165
                </Button>
              </Form>
              <div style={mt24Style}>
                {IS_DEV && (
                  <Text type="tertiary" size="small" style={devHintStyle}>
                    \u5F00\u53D1\u6A21\u5F0F \u2014 \u65E0\u540E\u7AEF\u65F6\u81EA\u52A8\u79BB\u7EBF\u767B\u5F55
                  </Text>
                )}
                <Divider style={dividerStyle}>
                  <Text type="tertiary" size="small">\u6216\u4F7F\u7528\u4F01\u4E1A\u7F51\u5173</Text>
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
                  {inFeishu ? '\u98DE\u4E66\u73AF\u5883\u514D\u767B' : '\u98DE\u4E66 OAuth \u6388\u6743\u767B\u5F55'}
                </Button>
                {!feishuReady && (
                  <Text type="tertiary" size="small" style={feishuHintStyle}>
                    \u672A\u68C0\u6D4B\u5230 VITE_FEISHU_APP_ID \u73AF\u5883\u53D8\u91CF
                  </Text>
                )}
              </div>
            </TabPane>

            <TabPane tab="\u7533\u8BF7\u6743\u9650" itemKey="register">
              <Form onSubmit={handleRegister} style={mt16Style}>
                <Form.Input
                  field="name"
                  label="\u771F\u5B9E\u59D3\u540D"
                  className="glass-input"
                  placeholder="\u5982\uFF1A\u5F20\u4E09"
                  rules={[{ required: true, message: '\u8BF7\u8F93\u5165\u59D3\u540D' }]}
                />
                <Form.Input
                  field="email"
                  label="\u4F01\u4E1A\u90AE\u7BB1"
                  className="glass-input"
                  placeholder="zhangsan@company.com"
                  rules={[{ required: true, message: '\u8BF7\u8F93\u5165\u90AE\u7BB1' }]}
                />
                <Form.Input
                  field="password"
                  label="\u8BBE\u7F6E\u5BC6\u7801"
                  mode="password"
                  className="glass-input"
                  placeholder="\u81F3\u5C116\u4F4D\u6570\u5B57\u6216\u5B57\u6BCD"
                  rules={[{ required: true, message: '\u8BF7\u8F93\u5165\u5BC6\u7801' }]}
                />
                <Form.Input
                  field="confirmPassword"
                  label="\u786E\u8BA4\u5BC6\u7801"
                  mode="password"
                  className="glass-input"
                  placeholder="\u518D\u6B21\u8F93\u5165\u5BC6\u7801"
                  rules={[{ required: true, message: '\u8BF7\u786E\u8BA4\u5BC6\u7801' }]}
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
                  \u63D0\u4EA4\u5F00\u901A\u7533\u8BF7
                </Button>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </>
  );
}
