import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Table, Tag, Toast, Space, Card, Modal, Input, Select } from '@douyinfe/semi-ui';
import { IconPlus, IconArrowLeft } from '@douyinfe/semi-icons';
import { apiClient } from '@/lib/apiClient';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioType as LocalScenarioType } from '@/data/db';
import { useProjectStore } from '@/store/projectStore';
import { fetchSettingsHistory } from '@/lib/settingsApi';

interface ScenarioItem {
  id: string;
  projectId: string;
  type: ScenarioType;
  name: string;
  status: string;
  lifecycleYears: number;
  volume: number;
  installRatio: number;
  rateSnapshot: Record<string, unknown>;
  rateSnapshotVersion?: string | null;
  bomVersionRef?: string | null;
  quoteParamSnapshot: Record<string, unknown>;
  sourceScenarioId?: string | null;
  compareBaselineId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

type ScenarioType = 'initial_quote' | 'fixed_point' | 'change' | 'annual_drop';

interface ScenarioFormState {
  type: ScenarioType;
  name: string;
  lifecycleYears: number;
  volume: number;
  installRatio: number;
  rateSnapshotVersion: string;
  bomVersionRef: string;
  notes: string;
  sourceScenarioId?: string;
  compareBaselineId?: string;
}

const defaultScenarioForm = (): ScenarioFormState => ({
  type: 'initial_quote',
  name: '',
  lifecycleYears: 5,
  volume: 0,
  installRatio: 1,
  rateSnapshotVersion: 'latest',
  bomVersionRef: '',
  notes: '',
  sourceScenarioId: undefined,
  compareBaselineId: undefined,
});

const SCENARIO_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  frozen: '已冻结',
  released: '已发布',
};

const STATUS_COLORS: Record<string, 'blue' | 'green' | 'red' | 'cyan' | 'grey' | 'orange'> = {
  draft: 'grey',
  frozen: 'orange',
  released: 'green',
};

const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  initial_quote: '初始报价',
  fixed_point: '定点',
  change: '设变',
  annual_drop: '年降',
};

const SCENARIO_TYPE_OPTIONS: { value: ScenarioType; label: string }[] = [
  { value: 'initial_quote', label: '初始报价' },
  { value: 'fixed_point', label: '定点' },
  { value: 'change', label: '设变' },
  { value: 'annual_drop', label: '年降' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

export function normalizeScenarioPayload(form: ScenarioFormState) {
  return {
    type: form.type,
    name: form.name.trim(),
    lifecycleYears: Number(form.lifecycleYears),
    volume: Number(form.volume),
    installRatio: Number(form.installRatio),
    rateSnapshot: {},
    rateSnapshotVersion: form.rateSnapshotVersion === 'latest' ? 'latest' : (form.rateSnapshotVersion || undefined),
    bomVersionRef: form.bomVersionRef.trim() || undefined,
    quoteParamSnapshot: {},
    sourceScenarioId: form.sourceScenarioId || undefined,
    compareBaselineId: form.compareBaselineId || undefined,
    notes: form.notes.trim() || undefined,
  };
}

export function canDeleteScenario(scenario: Pick<ScenarioItem, 'sourceScenarioId' | 'status'>) {
  return Boolean(scenario.sourceScenarioId) && scenario.status === 'draft';
}

function mapScenarioTypeToLocal(type: ScenarioType): LocalScenarioType {
  switch (type) {
    case 'fixed_point':
      return 'customer_award';
    case 'change':
      return 'ecn';
    default:
      return type;
  }
}

function toLocalScenarioRecord(item: ScenarioItem) {
  return {
    id: item.id,
    projectId: item.projectId,
    scenarioCode: item.id,
    scenarioName: item.name,
    scenarioType: mapScenarioTypeToLocal(item.type),
    parentScenarioId: item.sourceScenarioId ?? null,
    isBaseline: !item.sourceScenarioId,
    lifecycleYears: item.lifecycleYears,
    config: {
      costRates: {
        laborRate: 35,
        mfgRate: 46.69,
        wasteRate: 0.01,
        mgmtRate: 0.06,
        profitRate: 0.056627,
        ...(item.rateSnapshot ?? {}),
      },
      metalPrices: {
        copper: 0,
        aluminum: 0,
      },
      volumes: [{ year: 1, volume: item.volume }],
      annualDropRate: 0,
    },
    note: item.notes ?? '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function getScenarioDisplayVolume(item: ScenarioItem) {
  return Number(item.volume || 0).toLocaleString('zh-CN');
}

function getScenarioDisplaySource(item: ScenarioItem, scenarios: ScenarioItem[]) {
  if (!item.sourceScenarioId) {
    return '—';
  }
  return scenarios.find((scenario) => scenario.id === item.sourceScenarioId)?.name ?? item.sourceScenarioId;
}

/**
 * 项目场景列表页 — 展示一个项目下的所有场景
 */

const { Title, Text } = Typography;

export default function ProjectScenariosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [settingsVersions, setSettingsVersions] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [form, setForm] = useState<ScenarioFormState>(defaultScenarioForm());

  const loadProject = async () => {
    if (!id) return null;
    let localProject = await db.projects.get(id);
    if (localProject) {
      return localProject;
    }

    const remoteProject = await apiClient<{
      id: string;
      projectCode: string;
      projectName: string;
      customer: string;
      platform?: string | null;
      status: ProjectRecord['meta']['status'];
      createdAt: string;
      updatedAt: string;
    }>(`/projects/${id}`);

    localProject = {
      id: remoteProject.id,
      meta: {
        id: remoteProject.id,
        projectCode: remoteProject.projectCode,
        projectName: remoteProject.projectName,
        customer: remoteProject.customer,
        platform: remoteProject.platform ?? undefined,
        status: remoteProject.status,
        createdAt: remoteProject.createdAt,
        updatedAt: remoteProject.updatedAt,
      },
    } as ProjectRecord;

    await db.projects.put(localProject);
    return localProject;
  };

  const loadScenarios = async () => {
    if (!id) return;
    const data = await apiClient<ScenarioItem[]>(`/projects/${id}/scenarios`);
    setScenarios(data.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    await db.scenarios.bulkPut(data.map(toLocalScenarioRecord));
  };

  const loadSettingsVersions = async () => {
    const rows = await fetchSettingsHistory();
    setSettingsVersions(rows.map((row) => row.key).filter(Boolean));
  };

  const reload = async () => {
    await loadScenarios();
  };

  const executeScenarioAction = async (
    scenario: ScenarioItem,
    action: 'freeze' | 'release' | 'clone',
    successMessage: string,
  ) => {
    if (!id) return;
    try {
      await apiClient(`/projects/${id}/scenarios/${scenario.id}/${action}`, {
        method: 'POST',
      });
      Toast.success(successMessage);
      await reload();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '场景操作失败');
    }
  };

  const handleFreeze = (scenario: ScenarioItem) => {
    Modal.confirm({
      title: '冻结场景',
      content: `冻结后会生成版本快照，确认冻结“${scenario.name}”吗？`,
      onOk: () => executeScenarioAction(scenario, 'freeze', '场景已冻结'),
    });
  };

  const handleRelease = (scenario: ScenarioItem) => {
    Modal.confirm({
      title: '发布场景',
      content: `发布后会生成正式版本快照，确认发布“${scenario.name}”吗？`,
      onOk: () => executeScenarioAction(scenario, 'release', '场景已发布'),
    });
  };

  const handleClone = (scenario: ScenarioItem) => {
    Modal.confirm({
      title: '克隆场景',
      content: `将基于“${scenario.name}”创建一个新的草稿场景，是否继续？`,
      onOk: () => executeScenarioAction(scenario, 'clone', '场景已克隆'),
    });
  };

  const handleDelete = (scenario: ScenarioItem) => {
    Modal.confirm({
      title: 'Delete scenario',
      content: `Delete "${scenario.name}" and remove linked allocation/recovery data?`,
      onOk: async () => {
        try {
          await apiClient(`/scenarios/${scenario.id}`, {
            method: 'DELETE',
          });
          Toast.success('Scenario deleted');
          await reload();
        } catch (error) {
          Toast.error(error instanceof Error ? error.message : 'Failed to delete scenario');
        }
      },
    });
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        const loadedProject = await loadProject();
        if (!loadedProject) {
          Toast.error('项目不存在');
          return;
        }
        setProject(loadedProject);
        setCurrentProject(loadedProject.id, loadedProject.meta.projectName);
        await Promise.all([loadScenarios(), loadSettingsVersions()]);
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : '场景加载失败');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, setCurrentProject]);

  const openCreateModal = () => {
    setEditingScenarioId(null);
    setForm(defaultScenarioForm());
    setModalVisible(true);
  };

  const openEditModal = (scenario: ScenarioItem) => {
    setEditingScenarioId(scenario.id);
    setForm({
      type: scenario.type,
      name: scenario.name,
      lifecycleYears: scenario.lifecycleYears,
      volume: scenario.volume,
      installRatio: scenario.installRatio,
      rateSnapshotVersion: scenario.rateSnapshotVersion ?? 'latest',
      bomVersionRef: scenario.bomVersionRef ?? '',
      notes: scenario.notes ?? '',
      sourceScenarioId: scenario.sourceScenarioId ?? undefined,
      compareBaselineId: scenario.compareBaselineId ?? undefined,
    });
    setModalVisible(true);
  };

  const submitScenario = async () => {
    if (!id) return;
    if (!form.name.trim()) {
      Toast.warning('请输入场景名称');
      return;
    }

    setSubmitting(true);
    try {
      const payload = normalizeScenarioPayload(form);
      if (editingScenarioId) {
        await apiClient(`/scenarios/${editingScenarioId}`, {
          method: 'PUT',
          body: payload,
        });
        Toast.success('场景已更新');
      } else {
        await apiClient(`/projects/${id}/scenarios`, {
          method: 'POST',
          body: payload,
        });
        Toast.success('场景已创建');
      }
      setModalVisible(false);
      await reload();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '场景保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!project) return <div>项目不存在</div>;

  const columns = [
    {
      title: '场景名称',
      dataIndex: 'name',
      render: (_: unknown, record: ScenarioItem) => (
        <Space>
          <Text strong>{record.name}</Text>
          {!record.sourceScenarioId && <Tag color="blue" size="small">根场景</Tag>}
          {canDeleteScenario(record) && (
            <Button size="small" theme="borderless" type="danger" onClick={() => handleDelete(record)}>Delete</Button>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (_: unknown, record: ScenarioItem) => SCENARIO_TYPE_LABELS[record.type] ?? record.type,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_: unknown, record: ScenarioItem) => <Tag color={STATUS_COLORS[record.status] ?? 'grey'}>{SCENARIO_STATUS_LABELS[record.status] ?? record.status}</Tag>,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycleYears',
      render: (_: unknown, record: ScenarioItem) => `${record.lifecycleYears} 年`,
    },
    {
      title: '销量基线',
      dataIndex: 'volume',
      render: (_: unknown, record: ScenarioItem) => getScenarioDisplayVolume(record),
    },
    {
      title: '装车比',
      dataIndex: 'installRatio',
      render: (_: unknown, record: ScenarioItem) => record.installRatio,
    },
    {
      title: '来源场景',
      dataIndex: 'sourceScenarioId',
      render: (_: unknown, record: ScenarioItem) => getScenarioDisplaySource(record, scenarios),
    },
    {
      title: 'BOM版本',
      dataIndex: 'bomVersionRef',
      render: (_: unknown, record: ScenarioItem) => record.bomVersionRef || '—',
    },
    {
      title: '费率快照',
      dataIndex: 'rateSnapshotVersion',
      render: (_: unknown, record: ScenarioItem) => record.rateSnapshotVersion || 'latest',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      render: (_: unknown, record: ScenarioItem) => record.notes || '—',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (_: unknown, record: ScenarioItem) => formatDate(record.createdAt),
    },
    {
      title: '操作',
      render: (_: unknown, record: ScenarioItem) => (
        <Space>
          <Button size="small" theme="solid" onClick={() => navigate(`/project/${id}/s/${record.id}`)}>进入</Button>
          <Button size="small" onClick={() => openEditModal(record)}>编辑</Button>
          <Button size="small" onClick={() => navigate(`/project/${id}/compare?ids=${record.id}`)}>对比</Button>
          {record.status === 'draft' && (
            <Button size="small" theme="light" onClick={() => handleFreeze(record)}>冻结</Button>
          )}
          {record.status !== 'released' && (
            <Button size="small" theme="light" onClick={() => handleRelease(record)}>发布</Button>
          )}
          <Button size="small" theme="borderless" onClick={() => handleClone(record)}>克隆</Button>
        </Space>
      ),
    },
  ];

  const scenarioOptions = scenarios.map((scenario) => ({ label: scenario.name, value: scenario.id }));
  const modalTitle = editingScenarioId ? '编辑场景' : '新建场景';
  const submitText = editingScenarioId ? '保存' : '创建';

  const updateForm = <K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };


  const selectedCompareBaselineId = form.compareBaselineId ?? '';
  const selectedSourceScenarioId = form.sourceScenarioId ?? '';
  const selectedRateSnapshotVersion = form.rateSnapshotVersion || 'latest';

  const renderModal = (
    <Modal
      title={modalTitle}
      visible={modalVisible}
      onOk={submitScenario}
      onCancel={() => setModalVisible(false)}
      okText={submitText}
      cancelText="取消"
      confirmLoading={submitting}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text style={{ display: 'block', marginBottom: 6 }}>场景名称</Text>
          <Input value={form.name} onChange={(value) => updateForm('name', value)} placeholder="例如：客户定点 / ECN 设变" />
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 6 }}>场景类型</Text>
          <Select value={form.type} onChange={(value) => updateForm('type', value as ScenarioType)} style={{ width: '100%' }}>
            {SCENARIO_TYPE_OPTIONS.map((option) => (
              <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>生命周期（年）</Text>
            <Input type="number" value={String(form.lifecycleYears)} onChange={(value) => updateForm('lifecycleYears', Number(value || 0))} />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>销量基线</Text>
            <Input type="number" value={String(form.volume)} onChange={(value) => updateForm('volume', Number(value || 0))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>装车比</Text>
            <Input type="number" value={String(form.installRatio)} onChange={(value) => updateForm('installRatio', Number(value || 0))} />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>璐圭巼蹇収鐗堟湰</Text>
            <Select
              value={selectedRateSnapshotVersion}
              onChange={(value) => updateForm('rateSnapshotVersion', String(value) || 'latest')}
              style={{ width: '100%' }}
            >
              <Select.Option value="latest">latest</Select.Option>
              {settingsVersions.map((version) => (
                <Select.Option key={version} value={version}>{version}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>BOM 版本引用</Text>
            <Input value={form.bomVersionRef} onChange={(value) => updateForm('bomVersionRef', value)} placeholder="可选" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>来源场景</Text>
            <Select value={selectedSourceScenarioId} onChange={(value) => updateForm('sourceScenarioId', String(value) || undefined)} style={{ width: '100%' }}>
              <Select.Option value="">无</Select.Option>
              {scenarioOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>比较基线</Text>
            <Select value={selectedCompareBaselineId} onChange={(value) => updateForm('compareBaselineId', String(value) || undefined)} style={{ width: '100%' }}>
              <Select.Option value="">无</Select.Option>
              {scenarioOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 6 }}>备注</Text>
          <Input value={form.notes} onChange={(value) => updateForm('notes', value)} placeholder="说明场景目的、继承链或快照来源" />
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px 0' }}>
        <Button icon={<IconArrowLeft />} aria-label="返回" theme="borderless" onClick={() => navigate(`/project/${id}`)} />
        <div>
          <Title heading={4} style={{ margin: 0 }}>{project.meta.projectName}</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>{project.meta.projectCode} / {project.meta.customer}</Text>
        </div>
      </div>

      <Card className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title heading={5} style={{ margin: 0 }}>场景列表</Title>
          <Button icon={<IconPlus />} theme="light" onClick={openCreateModal}>新建场景</Button>
        </div>
        <Table columns={columns} dataSource={scenarios} rowKey="id" pagination={false} />
      </Card>

      {scenarios.length > 0 && (
        <Card className="glass-card">
          <Title heading={6} style={{ margin: '0 0 12px' }}>场景继承关系</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  padding: '10px 12px',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 10,
                }}
              >
                <Space>
                  <Tag color={scenario.sourceScenarioId ? 'grey' : 'blue'}>
                    {scenario.sourceScenarioId ? '继承场景' : '根场景'}
                  </Tag>
                  <Text>{scenario.name}</Text>
                </Space>
                <Text style={{ color: 'var(--semi-color-text-2)' }}>
                  来源：{getScenarioDisplaySource(scenario, scenarios)}
                  {scenario.compareBaselineId ? ` / 基线：${getScenarioDisplaySource({ ...scenario, sourceScenarioId: scenario.compareBaselineId }, scenarios)}` : ''}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      {renderModal}
    </div>
  );
}
