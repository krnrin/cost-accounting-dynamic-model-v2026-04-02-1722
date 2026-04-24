import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Banner,
  Button,
  Card,
  Empty,
  List,
  Space,
  Table,
  TabPane,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconHistory, IconRefresh } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import { requireScenarioConfig } from '@/data/scenarioGuards';
import SnapshotComparePanel from '@/components/SnapshotComparePanel';
import SnapshotRestoreDialog from '@/components/SnapshotRestoreDialog';
import VersionLockPanel from '@/components/VersionLockPanel';
import { useSnapshotIntegration } from '@/hooks/useSnapshotIntegration';
import { useVersionStore } from '@/store/versionStore';
import type { VersionRecord } from '@/types/version';

const { Title, Text } = Typography;

export default function VersionManager() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [restoreVisible, setRestoreVisible] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const { loadHistory, settingsHistory, quoteHistory } = useSnapshotIntegration();
  const {
    versions,
    loadVersions,
    createSnapshot,
    deleteVersion,
    lockVersion,
    unlockVersion,
    submitApproval,
    approveVersion,
    rejectVersion,
    restoreSnapshot,
  } = useVersionStore();

  const data = useLiveQuery(async () => {
    if (!id) return null;
    const project = await db.projects.get(id);
    if (!project) return null;
    const scenarios = await db.scenarios.where('projectId').equals(id).sortBy('scenarioCode');
    const scenario = sid ? await db.scenarios.get(sid) : null;
    return { project, scenario, scenarios };
  }, [id, sid]);

  useEffect(() => {
    if (!id) return;
    void loadVersions(id, sid ?? null);
  }, [id, sid, loadVersions]);

  useEffect(() => {
    if (!sid) return;
    void loadHistory(sid);
  }, [sid, loadHistory]);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersionId(null);
      return;
    }
    setSelectedVersionId((current) => (
      current && versions.some((version) => version.id === current) ? current : versions[0]!.id
    ));
  }, [versions]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  const runGovernanceAction = async (task: () => Promise<void>) => {
    setGovernanceLoading(true);
    try {
      await task();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setGovernanceLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!id || !sid) return;
    setCreating(true);
    try {
      const record = await createSnapshot({ projectId: id, scenarioId: sid });
      setSelectedVersionId(record.id);
      Toast.success(`已创建版本 ${record.label}`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteVersion = async (version: VersionRecord) => {
    await runGovernanceAction(async () => {
      await deleteVersion(version.id);
      Toast.success(`已删除版本 ${version.label}`);
    });
  };

  const handleRestoreVersion = async (version: VersionRecord) => {
    await runGovernanceAction(async () => {
      await restoreSnapshot(version.id);
      Toast.success(`已恢复到版本 ${version.label}`);
    });
  };

  if (!data) {
    return <Empty description="未找到项目" />;
  }

  if (!sid) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Title heading={3}>版本中心</Title>
        <Text type="tertiary">项目级入口不再展示全局混合快照，请先选择具体场景。</Text>
        <div style={{ marginTop: 16 }}>
          <List
            dataSource={data.scenarios}
            renderItem={(scenario) => (
              <List.Item
                main={
                  <div>
                    <Text strong>{scenario.scenarioName}</Text>
                    <br />
                    <Text type="tertiary">{scenario.scenarioCode}</Text>
                  </div>
                }
                extra={
                  <Button onClick={() => navigate(`/project/${id}/s/${scenario.id}/versions`)}>
                    进入版本中心
                  </Button>
                }
              />
            )}
          />
        </div>
      </div>
    );
  }

  const scenarioConfig = requireScenarioConfig(data.scenario, 'VersionManager');
  const currentSettings = {
    costRates: scenarioConfig.costRates,
    metalPrices: scenarioConfig.metalPrices,
    annualDropRate: scenarioConfig.annualDropRate,
  };

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title heading={3}>版本中心</Title>
          <Text type="tertiary">
            {data.project.meta.projectName || data.project.meta.projectCode} / {data.scenario?.scenarioName}
          </Text>
        </div>
        <Space>
          <Button icon={<IconHistory />} onClick={() => navigate(`/project/${id}/s/${sid}/workbench`)}>
            返回工作台
          </Button>
          <Button icon={<IconRefresh />} loading={creating} type="primary" onClick={handleCreateSnapshot}>
            创建版本快照
          </Button>
        </Space>
      </div>

      <Banner
        type="info"
        style={{ marginBottom: 16 }}
        description={`当前场景已有 ${versions.length} 个版本，${quoteHistory.length} 个报价快照，${settingsHistory.length} 个参数快照。`}
      />

      <Tabs type="line">
        <TabPane tab="版本治理" itemKey="versions">
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <Card title="版本列表" headerLine={false}>
              <Table
                rowKey="id"
                dataSource={versions}
                pagination={false}
                columns={[
                  {
                    title: '版本',
                    dataIndex: 'label',
                    render: (_value, record: VersionRecord) => (
                      <Button theme="borderless" onClick={() => setSelectedVersionId(record.id)}>
                        {record.label}
                      </Button>
                    ),
                  },
                  { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
                  {
                    title: '治理',
                    key: 'governance',
                    render: (_value, record: VersionRecord) => (
                      <Space wrap>
                        <Tag color={record.lockInfo?.locked ? 'red' : 'green'}>
                          {record.lockInfo?.locked ? '已锁定' : '可编辑'}
                        </Tag>
                        <Tag color={record.approvalInfo?.status === 'approved' ? 'green' : record.approvalInfo?.status === 'pending' ? 'orange' : 'grey'}>
                          {record.approvalInfo?.status ?? 'not_submitted'}
                        </Tag>
                      </Space>
                    ),
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'createdAt',
                    render: (value: string) => new Date(value).toLocaleString('zh-CN'),
                  },
                ]}
              />
            </Card>

            <Space vertical style={{ width: '100%' }}>
              <VersionLockPanel
                version={selectedVersion}
                loading={governanceLoading}
                onLock={(reason) => selectedVersion ? runGovernanceAction(async () => {
                  await lockVersion(selectedVersion.id, { reason });
                  Toast.success('版本已锁定');
                }) : undefined}
                onUnlock={() => selectedVersion ? runGovernanceAction(async () => {
                  await unlockVersion(selectedVersion.id);
                  Toast.success('版本已解锁');
                }) : undefined}
                onSubmitApproval={(comment) => selectedVersion ? runGovernanceAction(async () => {
                  await submitApproval(selectedVersion.id, { comment });
                  Toast.success('版本已提交审批');
                }) : undefined}
                onApprove={(comment) => selectedVersion ? runGovernanceAction(async () => {
                  await approveVersion(selectedVersion.id, { comment });
                  Toast.success('版本审批通过');
                }) : undefined}
                onReject={(comment) => selectedVersion ? runGovernanceAction(async () => {
                  await rejectVersion(selectedVersion.id, { comment });
                  Toast.success('版本已驳回');
                }) : undefined}
              />

              <Card title="版本操作" headerLine={false}>
                {!selectedVersion ? (
                  <Empty description="请选择一个版本" />
                ) : (
                  <Space vertical align="start">
                    <Text type="tertiary">
                      快照摘要: 单车成本 {selectedVersion.snapshot.summary.vehicleCost.toFixed(2)} / 线束数 {selectedVersion.snapshot.summary.harnessCount}
                    </Text>
                    <Space wrap>
                      <Button
                        icon={<IconRefresh />}
                        onClick={() => void handleRestoreVersion(selectedVersion)}
                        loading={governanceLoading}
                      >
                        恢复到此版本
                      </Button>
                      <Button
                        icon={<IconDelete />}
                        type="danger"
                        theme="borderless"
                        disabled={selectedVersion.status !== 'draft'}
                        onClick={() => void handleDeleteVersion(selectedVersion)}
                        loading={governanceLoading}
                      >
                        删除草稿版本
                      </Button>
                    </Space>
                    {selectedVersion.notes ? <Text>{selectedVersion.notes}</Text> : null}
                  </Space>
                )}
              </Card>
            </Space>
          </div>
        </TabPane>

        <TabPane tab="快照对比" itemKey="compare">
          <Card headerLine={false}>
            <SnapshotComparePanel scenarioId={sid} />
          </Card>
        </TabPane>

        <TabPane tab="快照恢复" itemKey="restore">
          <Card headerLine={false}>
            <Space vertical align="start">
              <Text>参数恢复按场景历史加载，不再使用项目级混合时间线。</Text>
              <Button type="primary" onClick={() => setRestoreVisible(true)}>
                打开恢复对话框
              </Button>
            </Space>
          </Card>
        </TabPane>
      </Tabs>

      <SnapshotRestoreDialog
        visible={restoreVisible}
        currentSettings={currentSettings}
        onCancel={() => setRestoreVisible(false)}
        onRestored={() => {
          setRestoreVisible(false);
          Toast.success('参数已恢复');
        }}
      />
    </div>
  );
}
