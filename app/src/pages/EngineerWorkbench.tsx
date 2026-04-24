import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Banner,
  Button,
  Card,
  Empty,
  List,
  Space,
  Spin,
  TabPane,
  Tabs,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconBranch, IconExternalOpen, IconHistory, IconSetting } from '@douyinfe/semi-icons';
import { db, type ChangeOrderRecord } from '@/data/db';
import { requireScenarioConfig } from '@/data/scenarioGuards';
import {
  INTERNAL_DEFAULTS,
  computeHarnessCost,
  computeInternalHarnessCost,
  computeInternalProjectFromHarnesses,
  computeProjectFromHarnesses,
} from '@/engine/harness_costing';
import { getRecentTraces, withTrace } from '@/engine/trace';
import { useHarnessSync } from '@/hooks/useHarnessSync';
import EngineSelector, { type EngineType } from '@/components/EngineSelector';
import HarnessCompareView from '@/components/HarnessCompareView';
import ChangeOrderWizard from '@/components/ChangeOrderWizard';
import ScenarioSelector from '@/components/ScenarioSelector';
import type { ChangeOrder } from '@/engine/change_verification';

const { Title, Text } = Typography;

export default function EngineerWorkbench() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const [engine, setEngine] = useState<EngineType>('customer');
  const [showChangeWizard, setShowChangeWizard] = useState(false);

  useHarnessSync(sid);

  const data = useLiveQuery(async () => {
    if (!id || !sid) return null;
    const project = await db.projects.get(id);
    const scenario = await db.scenarios.get(sid);
    if (!project || !scenario) return null;

    const harnesses = await db.harnesses
      .where('scenarioId')
      .equals(sid)
      .sortBy('harnessId');
    const changeOrders = await db.changeOrders
      .where('[projectId+scenarioId]')
      .equals([id, sid])
      .reverse()
      .sortBy('createdAt');

    return { project, scenario, harnesses, changeOrders };
  }, [id, sid]);

  const availableParts = useMemo(() => {
    const parts = new Map<string, string>();
    for (const harness of data?.harnesses ?? []) {
      for (const item of harness.input.bom ?? []) {
        if (!parts.has(item.partNo)) {
          parts.set(item.partNo, item.partName || item.partNo);
        }
      }
    }
    return Array.from(parts.entries())
      .map(([partNo, partName]) => ({ partNo, partName }))
      .sort((a, b) => a.partNo.localeCompare(b.partNo));
  }, [data?.harnesses]);

  const computed = useMemo(() => {
    if (!data?.scenario) return null;
    const config = requireScenarioConfig(data.scenario, 'EngineerWorkbench');
    const tracedCustomer = withTrace(computeHarnessCost, 'engineer-workbench-customer');
    const tracedInternal = withTrace(computeInternalHarnessCost, 'engineer-workbench-internal');
    const customerHarnesses = data.harnesses.map((record) =>
      tracedCustomer(record.input, config.costRates, config.metalPrices),
    );
    const internalHarnesses = data.harnesses.map((record) =>
      tracedInternal(
        record.input,
        config.internalRates || INTERNAL_DEFAULTS,
        config.metalPrices,
      ),
    );

    return {
      customerHarnesses,
      customerSummary: computeProjectFromHarnesses(customerHarnesses),
      internalHarnesses,
      internalSummary: computeInternalProjectFromHarnesses(internalHarnesses),
    };
  }, [data]);

  const traces = useMemo(
    () => getRecentTraces(8),
    [computed?.customerSummary.vehicleCost, computed?.internalSummary.vehicleCost],
  );

  const handleCreateChangeOrder = async (order: ChangeOrder) => {
    if (!id || !sid) return;
    const record: ChangeOrderRecord = {
      ...order,
      projectId: id,
      scenarioId: sid,
      updatedAt: order.createdAt,
    };
    await db.changeOrders.put(record);
  };

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!computed) {
    return <Empty description="场景数据缺失，无法加载工程师工作台" />;
  }

  const activeSummary = engine === 'customer' ? computed.customerSummary : computed.internalSummary;
  const compareHarnesses = computed.customerHarnesses.map((result) => ({
    harnessId: result.harnessId,
    harnessName: result.harnessName || result.harnessId,
    result,
  }));

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', paddingBottom: 48 }}>
      <ScenarioSelector />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title heading={3}>工程师工作台</Title>
          <Text type="tertiary">
            {data.project.meta.projectName || data.project.meta.projectCode} / {data.scenario.scenarioName}
          </Text>
        </div>
        <Space wrap>
          <EngineSelector value={engine} onChange={setEngine} />
          <Button icon={<IconExternalOpen />} onClick={() => navigate(`/project/${id}/s/${sid}/bom-workbook`)}>
            打开 BOM 工作簿
          </Button>
          <Button icon={<IconBranch />} type="primary" onClick={() => setShowChangeWizard(true)}>
            创建设变单
          </Button>
        </Space>
      </div>

      <Banner
        type="info"
        style={{ marginBottom: 16 }}
        description={`当前场景共 ${data.harnesses.length} 条线束，已创建 ${data.changeOrders.length} 张设变单。工作台优先使用 Univer 工作簿，不走智能粘贴链路。`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <Card headerLine={false} title="线束数">
          <Title heading={4}>{data.harnesses.length}</Title>
        </Card>
        <Card headerLine={false} title={engine === 'customer' ? '单车报价成本' : '单车内部成本'}>
          <Title heading={4}>¥{activeSummary.vehicleCost.toFixed(2)}</Title>
        </Card>
        <Card headerLine={false} title="加权材料成本">
          <Title heading={4}>
            ¥{(engine === 'customer' ? computed.customerSummary.weightedMaterial : computed.internalSummary.weightedMaterial).toFixed(2)}
          </Title>
        </Card>
        <Card headerLine={false} title="最近 traces">
          <Title heading={4}>{traces.length}</Title>
        </Card>
      </div>

      <Tabs type="line">
        <TabPane tab="工作台" itemKey="workspace">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            <Card title="快捷入口" headerLine={false}>
              <Space wrap>
                <Button icon={<IconExternalOpen />} onClick={() => navigate(`/project/${id}/s/${sid}/quote`)}>
                  报价页
                </Button>
                <Button icon={<IconExternalOpen />} onClick={() => navigate(`/project/${id}/s/${sid}/simulation`)}>
                  仿真页
                </Button>
                <Button icon={<IconExternalOpen />} onClick={() => navigate(`/project/${id}/s/${sid}/annual-drop`)}>
                  运行价页
                </Button>
                <Button icon={<IconHistory />} onClick={() => navigate(`/project/${id}/s/${sid}/versions`)}>
                  版本中心
                </Button>
                <Button icon={<IconSetting />} onClick={() => navigate('/settings')}>
                  参数设置
                </Button>
              </Space>
            </Card>

            <Card title="最近 traces" headerLine={false}>
              {traces.length === 0 ? (
                <Empty description="当前还没有 trace 记录" />
              ) : (
                <List
                  dataSource={traces}
                  renderItem={(item) => (
                    <List.Item>
                      <div>
                        <Text strong>{item.step}</Text>
                        <br />
                        <Text type="tertiary">{new Date(item.timestamp).toLocaleString('zh-CN')}</Text>
                        <br />
                        <Text type="tertiary">{item.duration.toFixed(1)} ms</Text>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </div>
        </TabPane>

        <TabPane tab="成本对比" itemKey="compare">
          {compareHarnesses.length === 0 ? (
            <Empty description="当前场景没有可对比线束" />
          ) : (
            <HarnessCompareView harnesses={compareHarnesses} />
          )}
        </TabPane>

        <TabPane tab="设变单" itemKey="change-orders">
          {data.changeOrders.length === 0 ? (
            <Empty description="当前场景还没有设变单" />
          ) : (
            <List
              dataSource={data.changeOrders}
              renderItem={(item) => (
                <List.Item
                  header={<Tag color={item.status === 'pending' ? 'orange' : 'green'}>{item.status}</Tag>}
                  main={
                    <div>
                      <Text strong>{item.changeNo}</Text>
                      <br />
                      <Text>{item.reason}</Text>
                      <br />
                      <Text type="tertiary">
                        影响零件：{item.affectedParts.join(', ') || '-'}
                      </Text>
                    </div>
                  }
                  extra={<Text type="tertiary">{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>}
                />
              )}
            />
          )}
        </TabPane>
      </Tabs>

      <ChangeOrderWizard
        visible={showChangeWizard}
        onClose={() => setShowChangeWizard(false)}
        onSubmit={handleCreateChangeOrder}
        availableParts={availableParts}
      />
    </div>
  );
}
