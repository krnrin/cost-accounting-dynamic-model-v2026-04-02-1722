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
            Toast.success('\飞\书\登\录\成\功');
          }
        })
        .catch((err) => {
          console.error('\飞\书\自\动\登\录\失\败:', err);
          Toast.error(`\飞\书\登\录\失\败: ${err?.message || '\未\知\错\误'}`);
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
      Toast.success('\登\录\成\功');
    } catch (err: any) {
      Toast.error(err.message || '\登\录\失\败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      Toast.error('\两\次\密\码\不\一\致');
      return;
    }
    setLoading(true);
    try {
      await register(values.email, values.password, values.name, 'ENGINEER');
      Toast.success('\注\册\成\功');
    } catch (err: any) {
      Toast.error(err.message || '\注\册\失\败');
    } finally {
      setLoading(false);
    }
  };

  const handleFeishuLogin = async () => {
    if (!feishuReady) {
      Toast.warning('\飞\书\应\用\未\配\置\，\请\联\系\管\理\员');
      return;
    }

    if (inFeishu) {
      setFeishuLoading(true);
      try {
        const success = await feishuAutoLogin();
        if (success) {
          Toast.success('\飞\书\登\录\成\功');
        } else {
          Toast.error('\飞\书\登\录\失\败\，\请\重\试');
        }
      } catch (err: any) {
        Toast.error(err.message || '\飞\书\登\录\失\败');
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
        <Text type="tertiary">\正\在\通\过\飞\书\免\登...</Text>
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
            <Text type="tertiary" style={subtitleStyle}>\高\压\线\束\精\算\与\决\策\引\擎</Text>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} className="glass-tabs">
            <TabPane tab="\系\统\登\录" itemKey="login">
              <Form
                onSubmit={handleLogin}
                style={mt16Style}
                {...(IS_DEV ? { initValues: { email: 'admin@harness.dev', password: 'admin123' } } : {})}
              >
                <Form.Input
                  field="email"
                  label="\工\作\邮\箱"
                  className="glass-input"
                  placeholder="your@company.com"
                  rules={[{ required: true, message: '\请\输\入\邮\箱' }]}
                />
                <Form.Input
                  field="password"
                  label="\访\问\密\码"
                  mode="password"
                  className="glass-input"
                  placeholder="\•\•\•\•\•\•\•\•"
                  rules={[{ required: true, message: '\请\输\入\密\码' }]}
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
                  \验\证\身\份\并\进\入
                </Button>
              </Form>
              <div style={mt24Style}>
                {IS_DEV && (
                  <Text type="tertiary" size="small" style={devHintStyle}>
                    \开\发\模\式 \— \无\后\端\时\自\动\离\线\登\录
                  </Text>
                )}
                <Divider style={dividerStyle}>
                  <Text type="tertiary" size="small">\或\使\用\企\业\网\关</Text>
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
                  {inFeishu ? '\飞\书\环\境\免\登' : '\飞\书 OAuth \授\权\登\录'}
                </Button>
                {!feishuReady && (
                  <Text type="tertiary" size="small" style={feishuHintStyle}>
                    \未\检\测\到 VITE_FEISHU_APP_ID \环\境\变\量
                  </Text>
                )}
              </div>
            </TabPane>

            <TabPane tab="\申\请\权\限" itemKey="register">
              <Form onSubmit={handleRegister} style={mt16Style}>
                <Form.Input
                  field="name"
                  label="\真\实\姓\名"
                  className="glass-input"
                  placeholder="\如\：\张\三"
                  rules={[{ required: true, message: '\请\输\入\姓\名' }]}
                />
                <Form.Input
                  field="email"
                  label="\企\业\邮\箱"
                  className="glass-input"
                  placeholder="zhangsan@company.com"
                  rules={[{ required: true, message: '\请\输\入\邮\箱' }]}
                />
                <Form.Input
                  field="password"
                  label="\设\置\密\码"
                  mode="password"
                  className="glass-input"
                  placeholder="\至\少6\位\数\字\或\字\母"
                  rules={[{ required: true, message: '\请\输\入\密\码' }]}
                />
                <Form.Input
                  field="confirmPassword"
                  label="\确\认\密\码"
                  mode="password"
                  className="glass-input"
                  placeholder="\再\次\输\入\密\码"
                  rules={[{ required: true, message: '\请\确\认\密\码' }]}
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
                  \提\交\开\通\申\请
                </Button>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </>
  );
}
