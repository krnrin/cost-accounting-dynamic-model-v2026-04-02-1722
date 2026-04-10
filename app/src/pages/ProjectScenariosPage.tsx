/**
 * 项目场景列表页 — 展示一个项目下的所有场景
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Table, Tag, Toast, Space, Card, Modal, Input, Select, Switch } from '@douyinfe/semi-ui';
import { IconPlus, IconArrowLeft, IconDelete } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord, ScenarioType } from '@/data/db';
import { useProjectStore } from '@/store/projectStore';
import { forkScenario, deleteScenario } from '@/data/scenarioFork';
import { apiClient } from '@/lib/apiClient';

const { Title, Text } = Typography;

const SCENARIO_TYPE_LABELS: Record<string, string> = {
  initial_quote: '初始报价',
  final_quote: '最终报价',
  customer_award: '客户定点',
  ecn: '设变',
  metal_escalation: '金属联动',
  annual_drop: '年降',
  volume_change: '销量变更',
  eop_change: 'EOP变更',
  custom: '自定义',
};

const SCENARIO_TYPE_OPTIONS: { value: ScenarioType; label: string }[] = [
  { value: 'initial_quote', label: '初始报价' },
  { value: 'final_quote', label: '最终报价' },
  { value: 'customer_award', label: '客户定点' },
  { value: 'ecn', label: '设变' },
  { value: 'metal_escalation', label: '金属联动' },
  { value: 'annual_drop', label: '年降' },
  { value: 'volume_change', label: '销量变更' },
  { value: 'eop_change', label: 'EOP变更' },
  { value: 'custom', label: '自定义' },
];

export default function ProjectScenariosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);

  // Fork modal state
  const [forkVisible, setForkVisible] = useState(false);
  const [forkParentId, setForkParentId] = useState<string | null>(null);
  const [forkName, setForkName] = useState('');
  const [forkType, setForkType] = useState<ScenarioType>('custom');
  const [forkInheritAlloc, setForkInheritAlloc] = useState(true);
  const [forkLoading, setForkLoading] = useState(false);

  const reload = async () => {
    if (!id) return;
    const s = await db.scenarios.where('projectId').equals(id).toArray();
    setScenarios(s.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      let p = await db.projects.get(id);
      if (!p) {
        try {
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
          p = {
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
          await db.projects.put(p);
        } catch {
          Toast.error('项目不存在');
          setLoading(false);
          return;
        }
      }
      setProject(p);
      setCurrentProject(p.id, p.meta.projectName);
      const s = await db.scenarios.where('projectId').equals(id).toArray();
      setScenarios(s.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setLoading(false);
    }
    load();
  }, [id]);

  const openForkModal = (parentId: string) => {
    setForkParentId(parentId);
    setForkName('');
    setForkType('custom');
    setForkInheritAlloc(true);
    setForkVisible(true);
  };

  const handleFork = async () => {
    if (!forkParentId || !forkName.trim()) { Toast.warning('请输入场景名称'); return; }
    setForkLoading(true);
    try {
      await forkScenario(forkParentId, {
        name: forkName.trim(),
        type: forkType,
        inheritAllocProgress: forkInheritAlloc,
      });
      Toast.success('场景创建成功');
      setForkVisible(false);
      await reload();
    } catch (err: any) {
      Toast.error(err.message || '创建失败');
    } finally {
      setForkLoading(false);
    }
  };

  const handleDelete = async (scenarioId: string) => {
    try {
      await deleteScenario(scenarioId);
      Toast.success('场景已删除');
      await reload();
    } catch (err: any) {
      Toast.error(err.message || '删除失败');
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleRename = async (scenarioId: string) => {
    const name = editingName.trim();
    if (!name) { setEditingId(null); return; }
    await db.scenarios.update(scenarioId, { scenarioName: name, updatedAt: new Date().toISOString() });
    setEditingId(null);
    await reload();
  };

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');

  const handleRenameNote = async (scenarioId: string) => {
    await db.scenarios.update(scenarioId, { note: editingNote.trim(), updatedAt: new Date().toISOString() });
    setEditingNoteId(null);
    await reload();
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!project) return <div>项目不存在</div>;

  const totalVolume = (s: ScenarioRecord) =>
    s.config?.volumes?.reduce((sum, v) => sum + v.volume, 0) ?? 0;

  const columns = [
    { title: '场景名称', dataIndex: 'scenarioName', render: (_: any, r: ScenarioRecord) => (
      editingId === r.id ? (
        <Input
          size="small"
          value={editingName}
          onChange={setEditingName}
          onBlur={() => handleRename(r.id)}
          onEnterPress={() => handleRename(r.id)}
          autoFocus
          style={{ width: 160 }}
        />
      ) : (
        <Space>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => { setEditingId(r.id); setEditingName(r.scenarioName); }}>
            {r.scenarioName}
          </Text>
          {r.isBaseline && <Tag color="blue" size="small">基准</Tag>}
        </Space>
      )
    )},
    { title: '类型', dataIndex: 'scenarioType', render: (_: any, r: ScenarioRecord) => SCENARIO_TYPE_LABELS[r.scenarioType] || r.scenarioType },
    { title: '生命周期', dataIndex: 'lifecycleYears', render: (_: any, r: ScenarioRecord) => `${r.lifecycleYears}年` },
    { title: '总销量', render: (_: any, r: ScenarioRecord) => totalVolume(r).toLocaleString() },
    { title: '备注', dataIndex: 'note', width: 200, render: (_: any, r: ScenarioRecord) => (
      editingNoteId === r.id ? (
        <Input
          size="small"
          value={editingNote}
          onChange={setEditingNote}
          onBlur={() => handleRenameNote(r.id)}
          onEnterPress={() => handleRenameNote(r.id)}
          autoFocus
          style={{ width: 180 }}
        />
      ) : (
        <Text style={{ cursor: 'pointer', color: r.note ? 'inherit' : 'var(--semi-color-text-3)' }} onClick={() => { setEditingNoteId(r.id); setEditingNote(r.note || ''); }}>
          {r.note || '点击添加备注'}
        </Text>
      )
    )},
    { title: '创建时间', dataIndex: 'createdAt', render: (_: any, r: ScenarioRecord) => r.createdAt.slice(0, 10) },
    { title: '操作', render: (_: any, r: ScenarioRecord) => (
      <Space>
        <Button size="small" theme="solid" onClick={() => navigate(`/project/${id}/s/${r.id}`)}>进入</Button>
        <Button size="small" onClick={() => openForkModal(r.id)}>派生</Button>
        <Button size="small" onClick={() => navigate(`/project/${id}/compare?ids=${r.id}`)}>对比</Button>
        {!r.isBaseline && (
          <Button size="small" type="danger" icon={<IconDelete />} onClick={() => handleDelete(r.id)} />
        )}
      </Space>
    )},
  ];

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
          <Button icon={<IconPlus />} theme="light" onClick={() => {
            const baseline = scenarios.find(s => s.isBaseline) ?? scenarios[0];
            if (baseline) openForkModal(baseline.id);
            else Toast.warning('没有可派生的场景');
          }}>新建场景</Button>
        </div>
        <Table
          columns={columns}
          dataSource={scenarios}
          rowKey="id"
          pagination={false}
        />
      </Card>

      {/* 场景谱系链 */}
      {scenarios.length > 1 && (
        <Card className="glass-card">
          <Title heading={6} style={{ margin: '0 0 12px' }}>场景谱系</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {scenarios.map((s, i) => (
              <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color={s.isBaseline ? 'blue' : 'grey'} size="large" style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${id}/s/${s.id}`)}>
                  {s.scenarioName}
                </Tag>
                {i < scenarios.length - 1 && <span style={{ color: 'var(--semi-color-text-3)' }}>→</span>}
              </span>
            ))}
          </div>
        </Card>
      )}
      {/* Fork Modal */}
      <Modal
        title="新建场景"
        visible={forkVisible}
        onOk={handleFork}
        onCancel={() => setForkVisible(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={forkLoading}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>场景名称</Text>
            <Input value={forkName} onChange={setForkName} placeholder="例如：客户定点、ECN-001 设变后" />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>场景类型</Text>
            <Select value={forkType} onChange={v => setForkType(v as ScenarioType)} style={{ width: '100%' }}>
              {SCENARIO_TYPE_OPTIONS.map(o => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={forkInheritAlloc} onChange={setForkInheritAlloc} />
            <Text>继承一次性费用回收进度</Text>
          </div>
          <Text type="tertiary" size="small">
            从「{scenarios.find(s => s.id === forkParentId)?.scenarioName ?? ''}」派生，深拷贝所有线束和费用数据
          </Text>
        </div>
      </Modal>
    </div>
  );
}
