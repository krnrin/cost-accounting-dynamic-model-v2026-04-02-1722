import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  IconDelete,
  IconDownload,
  IconEdit,
  IconPlus,
  IconSearch,
  IconUpload,
} from '@douyinfe/semi-icons';
import { db, type ProjectRecord } from '../data/db';
import { validateProjectPackage } from '@/engine/project_io';
import { RoleGuard } from '@/components/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import { exportProjectExcel, exportProjectPdf } from '@/lib/exportApi';
import type { ProjectConfig } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

interface ApiProject {
  id: string;
  projectCode: string;
  projectName: string;
  customer: string;
  platform?: string | null;
  status: 'active' | 'draft' | 'quoted' | 'awarded' | 'production' | 'eol';
  createdAt: string;
  updatedAt: string;
  costRates?: ProjectConfig['costRates'];
  metalPrices?: ProjectConfig['metalPrices'];
  volumes?: ProjectConfig['volumes'];
}

interface ProjectMetrics {
  harnessCount: number;
  scenarioCount: number;
}

interface ProjectFormValues {
  projectCode: string;
  projectName: string;
  customer: string;
  platform?: string;
  status: 'draft' | 'quoted' | 'awarded' | 'production' | 'eol';
}

type ProjectRow = ProjectRecord & {
  projectCode: string;
  projectName: string;
  customer: string;
  status: ProjectFormValues['status'];
  updatedAt: string;
  harnessCount: number;
  scenarioCount: number;
};

const statusMap: Record<ProjectFormValues['status'] | 'active', string> = {
  active: '进行中',
  draft: '草稿',
  quoted: '已报价',
  awarded: '已定点',
  production: '量产中',
  eol: '已归档',
};

const statusColorMap: Record<ProjectFormValues['status'] | 'active', TagColor> = {
  active: 'blue',
  draft: 'grey',
  quoted: 'blue',
  awarded: 'green',
  production: 'cyan',
  eol: 'red',
};

const statusFilterMap: Record<string, ApiProject['status'][]> = {
  all: ['active', 'draft', 'quoted', 'awarded', 'production', 'eol'],
  ongoing: ['active', 'draft', 'quoted'],
  completed: ['awarded', 'production'],
  archived: ['eol'],
};

const defaultProjectFormValues: ProjectFormValues = {
  projectCode: '',
  projectName: '',
  customer: '',
  platform: '',
  status: 'draft',
};

function normalizeProjectStatus(status: ApiProject['status']): ProjectFormValues['status'] {
  return status === 'active' ? 'draft' : status;
}

function mapApiProjectToRecord(project: ApiProject): ProjectRecord {
  return {
    id: project.id,
    meta: {
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      customer: project.customer,
      platform: project.platform ?? undefined,
      status: normalizeProjectStatus(project.status),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    // config is deprecated — lives on ScenarioRecord since v7
    // Only kept as minimal fallback for legacy code paths
    config: undefined,
  };
}

async function syncProjectsToDexie(projects: ProjectRecord[]) {
  const incomingIds = new Set(projects.map((project) => project.id));
  await db.transaction('rw', db.projects, async () => {
    await Promise.all(projects.map((project) => db.projects.put(project)));
    const existingIds = await db.projects.toCollection().primaryKeys();
    await Promise.all(
      existingIds
        .filter((id): id is string => typeof id === 'string' && !incomingIds.has(id))
        .map((id) => db.projects.delete(id))
    );
  });
}

/* Extracted styles to avoid double-brace JSX interception */
const S: Record<string, CSSProperties> = {
  loadingWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerTitle: { marginBottom: 4 },
  filterBar: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const },
  searchInput: { width: 280 },
  projectNameMain: { fontWeight: 500 },
  modalForm: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  formLabel: { display: 'block', marginBottom: 4, fontWeight: 500 },
  pagination: { pageSize: 20 } as any,
};

export default function ProjectListPage() {
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [extraInfo, setExtraInfo] = useState<Record<string, ProjectMetrics>>({});

  /* Edit modal state (create removed — now uses /project/new wizard) */
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [projectFormValues, setProjectFormValues] = useState<ProjectFormValues>(defaultProjectFormValues);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchTerm.trim()) {
        query.set('search', searchTerm.trim());
      }
      const data = await apiClient<ApiProject[]>(`/projects${query.toString() ? `?${query.toString()}` : ''}`);
      const mappedProjects = data.map(mapApiProjectToRecord);
      setProjects(mappedProjects);
      await syncProjectsToDexie(mappedProjects);
    } catch (error) {
      console.error(error);
      Toast.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const fetchExtra = async () => {
      const info: Record<string, ProjectMetrics> = {};
      for (const project of projects) {
        const harnessCount = await db.harnesses.where('projectId').equals(project.id).count();
        const scenarioCount = await db.scenarios.where('projectId').equals(project.id).count();
        info[project.id] = { harnessCount, scenarioCount };
      }
      setExtraInfo(info);
    };

    if (projects.length === 0) {
      setExtraInfo({});
      return;
    }

    void fetchExtra();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const allowedStatuses = new Set(statusFilterMap[statusFilter] || statusFilterMap.all);
    return projects.filter((project) => allowedStatuses.has(project.meta.status));
  }, [projects, statusFilter]);

  const tableData = useMemo<ProjectRow[]>(() => {
    return filteredProjects.map((project) => ({
      ...project,
      projectCode: project.meta.projectCode,
      projectName: project.meta.projectName,
      customer: project.meta.customer,
      status: project.meta.status,
      updatedAt: project.meta.updatedAt,
      harnessCount: extraInfo[project.id]?.harnessCount ?? 0,
      scenarioCount: extraInfo[project.id]?.scenarioCount ?? 0,
    }));
  }, [filteredProjects, extraInfo]);

  /* -- Edit modal handlers -- */

  const openEditModal = (project: ProjectRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingProject(project);
    setProjectFormValues({
      projectCode: project.meta.projectCode,
      projectName: project.meta.projectName,
      customer: project.meta.customer,
      platform: project.meta.platform || '',
      status: project.meta.status,
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingProject(null);
    setProjectFormValues(defaultProjectFormValues);
  };

  const handleOpenProject = (project: ProjectRecord) => {
    setCurrentProject(project.id, project.meta.projectName);
    navigate(`/project/${project.id}`);
  };

  const handleSubmitEdit = async () => {
    const values = projectFormValues;
    if (!values.projectCode.trim() || !values.projectName.trim() || !values.customer.trim()) {
      Toast.error('请完整填写项目编号、项目名称和客户');
      return;
    }
    if (!editingProject) return;

    try {
      setSubmitting(true);
      const payload = {
        projectCode: values.projectCode.trim(),
        projectName: values.projectName.trim(),
        customer: values.customer.trim(),
        platform: values.platform?.trim() || undefined,
        status: values.status,
      };
      await apiClient(`/projects/${editingProject.id}`, {
        method: 'PUT',
        body: payload,
      });
      Toast.success('项目已更新');
      closeEditModal();
      await fetchProjects();
    } catch (error) {
      if (error instanceof Error && error.message) {
        Toast.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await apiClient(`/projects/${projectId}`, { method: 'DELETE' });
      Toast.success('删除成功');
      await fetchProjects();
    } catch (error) {
      console.error(error);
      Toast.error('删除失败');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const validation = validateProjectPackage(data);
        if (!validation.valid) {
          Toast.error(`导入失败: ${validation.errors.join(', ')}`);
          return;
        }
        await apiClient('/projects/import', {
          method: 'POST',
          body: data,
        });
        Toast.success('导入成功');
        await fetchProjects();
      } catch (error) {
        console.error(error);
        Toast.error(error instanceof Error ? `导入失败: ${error.message}` : '导入失败: 文件格式错误');
      }
    };
    input.click();
  };

  const columns: ColumnProps<ProjectRow>[] = [
    {
      title: '项目编号',
      dataIndex: 'projectCode',
      width: 140,
      render: (_text, record) => <Text strong>{record.projectCode}</Text>,
    },
    {
      title: '项目名称',
      dataIndex: 'projectName',
      render: (_text, record) => (
        <div>
          <div style={S.projectNameMain}>{record.projectName}</div>
          <Text type="tertiary" size="small">{record.meta.platform || '-'}</Text>
        </div>
      ),
    },
    {
      title: '客户',
      dataIndex: 'customer',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_text, record) => <Tag color={statusColorMap[record.status]}>{statusMap[record.status]}</Tag>,
    },
    {
      title: '线束数',
      dataIndex: 'harnessCount',
      width: 100,
    },
    {
      title: '场景数',
      dataIndex: 'scenarioCount',
      width: 100,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
      render: (_text, record) => new Date(record.updatedAt).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      dataIndex: 'id',
      width: 260,
      render: (_text, record) => (
        <Space>
          <Button
            theme="solid"
            type="primary"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenProject(record);
            }}
          >
            进入项目
          </Button>
          <Button icon={<IconEdit />} theme="borderless" size="small" onClick={(event) => openEditModal(record, event)} />
          <Button
            icon={<IconDownload />}
            theme="borderless"
            size="small"
            onClick={async (event) => {
              event.stopPropagation();
              try {
                await exportProjectExcel(record.id);
                Toast.success('项目 Excel 已导出');
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : '项目 Excel 导出失败');
              }
            }}
          />
          <Button
            icon={<IconUpload />}
            theme="borderless"
            size="small"
            onClick={async (event) => {
              event.stopPropagation();
              try {
                await exportProjectPdf(record.id);
                Toast.success('项目 PDF 已导出');
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : '项目 PDF 导出失败');
              }
            }}
          />
          <RoleGuard field="deleteProject">
            <Popconfirm
              title="确定删除此项目吗？"
              content="删除后数据将不可恢复"
              position="bottomRight"
              onConfirm={(event) => handleDelete(record.id, event as unknown as React.MouseEvent)}
              onCancel={(event) => event?.stopPropagation()}
            >
              <Button
                icon={<IconDelete />}
                type="danger"
                theme="borderless"
                size="small"
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>
          </RoleGuard>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={S.header}>
        <div>
          <Title heading={4} style={S.headerTitle}>项目列表</Title>
          <Text type="tertiary">支持搜索、状态筛选、新建、删除并进入项目</Text>
        </div>
        <Space>
          <Button theme="light" icon={<IconUpload />} onClick={handleImport}>
            导入项目
          </Button>
          <Button data-testid="project-list-new-project" theme="solid" type="primary" icon={<IconPlus />} onClick={() => navigate('/project/new')}>
            新建项目
          </Button>
        </Space>
      </div>

      <div style={S.filterBar}>
        <Input
          prefix={<IconSearch />}
          placeholder="搜索项目名称、编号或客户"
          value={searchTerm}
          onChange={setSearchTerm}
          style={S.searchInput}
          showClear
          onEnterPress={() => {
            void fetchProjects();
          }}
        />
        <RadioGroup type="button" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <Radio value="all">全部</Radio>
          <Radio value="ongoing">进行中</Radio>
          <Radio value="completed">已完成</Radio>
          <Radio value="archived">已归档</Radio>
        </RadioGroup>
      </div>

      {tableData.length === 0 ? (
        <Empty title="暂无项目" description="请创建项目或调整筛选条件" />
      ) : (
        <Table
          columns={columns}
          dataSource={tableData}
          rowKey="id"
          pagination={S.pagination as any}
          onRow={(record) => ({
            onClick: () => handleOpenProject(record as ProjectRecord),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {/* Edit-only modal (create now uses /project/new wizard) */}
      <Modal
        title="编辑项目"
        visible={editModalVisible}
        onCancel={closeEditModal}
        onOk={handleSubmitEdit}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
      >
        <div style={S.modalForm}>
          <div>
            <Text style={S.formLabel}>项目编号</Text>
            <Input value={projectFormValues.projectCode} placeholder="如 E281" onChange={(value) => setProjectFormValues((prev) => ({ ...prev, projectCode: value }))} />
          </div>
          <div>
            <Text style={S.formLabel}>项目名称</Text>
            <Input value={projectFormValues.projectName} placeholder="请输入项目名称" onChange={(value) => setProjectFormValues((prev) => ({ ...prev, projectName: value }))} />
          </div>
          <div>
            <Text style={S.formLabel}>客户</Text>
            <Input value={projectFormValues.customer} placeholder="请输入客户名称" onChange={(value) => setProjectFormValues((prev) => ({ ...prev, customer: value }))} />
          </div>
          <div>
            <Text style={S.formLabel}>平台/车型</Text>
            <Input value={projectFormValues.platform || ''} placeholder="请输入平台或车型" onChange={(value) => setProjectFormValues((prev) => ({ ...prev, platform: value }))} />
          </div>
          <div>
            <Text style={S.formLabel}>状态</Text>
            <RadioGroup type="button" value={projectFormValues.status} onChange={(event) => setProjectFormValues((prev) => ({ ...prev, status: event.target.value }))}>
              <Radio value="draft">草稿</Radio>
              <Radio value="quoted">已报价</Radio>
              <Radio value="awarded">已定点</Radio>
              <Radio value="production">量产中</Radio>
              <Radio value="eol">已归档</Radio>
            </RadioGroup>
          </div>
        </div>
      </Modal>
    </div>
  );
}
