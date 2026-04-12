/**
 * D7: 工程师工作台
 * 集成BOM编辑、成本计算、仿真分层、设变向导的一站式工作台
 */
import { useState, useCallback } from 'react';
import { Layout, Nav, Typography, Button, Tabs, TabPane, Toast, Space, Tag } from '@douyinfe/semi-ui';
import { IconCode, IconSetting, IconLayers, IconEdit, IconSearch } from '@douyinfe/semi-icons';
import EngineSelector, { type EngineType } from '@/components/EngineSelector';
import HarnessCompareView from '@/components/HarnessCompareView';
import ChangeOrderWizard from '@/components/ChangeOrderWizard';
import type { HarnessResult } from '@/types/harness';
import type { ChangeOrder } from '@/engine/change_verification';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

export default function EngineerWorkbench() {
  const [engine, setEngine] = useState<EngineType>('customer');
  const [activeTab, setActiveTab] = useState('bom');
  const [changeOrderVisible, setChangeOrderVisible] = useState(false);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);

  // Placeholder data - will be connected to real store
  const [harnesses] = useState<Array<{ harnessId: string; harnessName: string; result: HarnessResult }>>([
    { harnessId: 'h1', harnessName: '主驾线束', result: {} as HarnessResult },
    { harnessId: 'h2', harnessName: '仪表线束', result: {} as HarnessResult },
  ]);

  const handleChangeOrderSubmit = useCallback((order: ChangeOrder) => {
    setChangeOrders(prev => [...prev, order]);
    Toast.success(`设变单 ${order.changeNo} 已创建`);
  }, []);

  return (
    <Layout style= height: '100vh' >
      <Sider style= width: 220, background: 'var(--semi-color-bg-1)' >
        <Nav
          style= height: '100%' 
          items={[
            { itemKey: 'bom', text: 'BOM编辑', icon: <IconEdit /> },
            { itemKey: 'calc', text: '成本计算', icon: <IconCode /> },
            { itemKey: 'sim', text: '仿真分层', icon: <IconLayers /> },
            { itemKey: 'compare', text: '线束对比', icon: <IconSearch /> },
            { itemKey: 'settings', text: '参数设置', icon: <IconSetting /> },
          ]}
          selectedKeys={[activeTab]}
          onSelect={({ itemKey }) => setActiveTab(itemKey as string)}
          footer= collapseButton: true 
        />
      </Sider>

      <Content style= padding: 24, overflow: 'auto' >
        <div style= display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 >
          <Title heading={3}>🔧 工程师工作台</Title>
          <Space>
            <EngineSelector value={engine} onChange={setEngine} />
            <Tag color={engine === 'internal' ? 'blue' : 'green'} size="large">
              {engine === 'internal' ? '内部实绩' : '客户报价'}
            </Tag>
          </Space>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="BOM编辑" itemKey="bom">
            <div style= padding: 16 >
              <Title heading={5}>BOM 数据编辑</Title>
              <Text type="tertiary">在此编辑线束BOM数据，支持智能粘贴导入</Text>
              <div style= marginTop: 16 >
                <Space>
                  <Button type="primary" theme="solid">📋 智能粘贴</Button>
                  <Button>📤 导出BOM</Button>
                  <Button type="warning" onClick={() => setChangeOrderVisible(true)}>🔧 创建设变单</Button>
                </Space>
              </div>
              {/* UniverSheet BOM editor placeholder - D8 */}
              <div style= marginTop: 16, height: 500, border: '1px dashed var(--semi-color-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' >
                <Text type="tertiary">UniverSheet BOM 编辑器 (D8 待集成)</Text>
              </div>
            </div>
          </TabPane>

          <TabPane tab="成本计算" itemKey="calc">
            <div style= padding: 16 >
              <Title heading={5}>成本计算结果</Title>
              <Text type="tertiary">基于当前BOM和参数的成本计算结果</Text>
            </div>
          </TabPane>

          <TabPane tab="仿真分层" itemKey="sim">
            <div style= padding: 16 >
              <Title heading={5}>仿真分层</Title>
              <Text type="tertiary">叠加多维度仿真层，分析成本敏感性</Text>
            </div>
          </TabPane>

          <TabPane tab="线束对比" itemKey="compare">
            <HarnessCompareView harnesses={harnesses} />
          </TabPane>

          <TabPane tab="参数设置" itemKey="settings">
            <div style= padding: 16 >
              <Title heading={5}>参数设置</Title>
              <Text type="tertiary">费率、金属价格、年降参数配置</Text>
            </div>
          </TabPane>
        </Tabs>

        <ChangeOrderWizard
          visible={changeOrderVisible}
          onClose={() => setChangeOrderVisible(false)}
          onSubmit={handleChangeOrderSubmit}
          availableParts={[]}
        />

        {changeOrders.length > 0 && (
          <div style= marginTop: 24 >
            <Title heading={5}>📋 设变单记录 ({changeOrders.length})</Title>
            {changeOrders.map(co => (
              <Tag key={co.id} color="orange" style= margin: 4 >
                {co.changeNo}: {co.reason || co.type}
              </Tag>
            ))}
          </div>
        )}
      </Content>
    </Layout>
  );
}
