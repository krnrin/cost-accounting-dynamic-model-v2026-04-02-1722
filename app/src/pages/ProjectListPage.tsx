import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Button, Empty, Spin, Popconfirm, Toast, Input, RadioGroup, Radio, Tag } from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconUpload, IconDownload, IconSearch } from '@douyinfe/semi-icons';
import { projectRepo } from '../data/repositories';
import { db, type ProjectRecord } from '../data/db';
import { downloadProjectPackage, importProjectPackage, validateProjectPackage } from '@/engine/project_io';
import { exportProjectZip } from '@/engine/zip_export';
import { 
  computeProjectFromHarnesses,
  computeInternalProjectDynamic 
} from '@/engine/harness_costing';
import { usePricingStore } from '@/store/pricingStore';
import { RoleGuard } from '@/components/RoleGuard';

const { Title, Text } = Typography;

const statusMap: Record<string, string> = {
  draft: '草稿',
  quoted: '已报价',
  awarded: '已定点',
  production: '量产中',
  eol: '已归档',
};

const statusFilterMap: Record<string, string[]> = {
  all: ['draft', 'quoted', 'awarded', 'production', 'eol'],
  ongoing: ['draft', 'quoted'],
  completed: ['awarded', 'production'],
  archived: ['eol'],
};

export default function ProjectListPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [extraInfo, setExtraInfo] = useState<Record<string, { harnessCount: number; unitCost?: number }>>({});
  const navigate = useNavigate();
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const validation = validateProjectPackage(data);
        if (!validation.valid) {
          Toast.error(`导入失败: ${validation.errors.join(', ')}`);
          return;
        }
        await importProjectPackage(data);
        Toast.success('操作成功');
        // Refresh project list
        const list = await projectRepo.list();
        setProjects(list);
      } catch (err) {
        console.error(err);
        Toast.error('导入失败: 文件格式错误');
      }
    };
    input.click();
  };

  useEffect(() => {
    projectRepo.list().then((list) => {
      setProjects(list);
      setLoading(false);
    });
  }, []);

  const pricingContext = usePricingStore(s => s.getPricingContext());

  useEffect(() => {
    const fetchExtra = async () => {
      const info: Record<string, { harnessCount: number; unitCost?: number; /* internalCost removed */ unitCost?: number }> = {};
      for (const p of projects) {
        const count = await db.harnesses.where('projectId').equals(p.id).count();
        // Latest Quote (Customer Quote)
        const latestQuote = await db.quotes.where('projectId').equals(p.id).reverse().sortBy('updatedAt').then(qs => qs[0]);
        const unitCost = latestQuote?.totals?.deliveredPrice;

        // Internal Actual Cost (Dynamic Simulation)
        let /* internalCost removed */ unitCost: number | undefined;
        if (pricingContext) {
          const harnesses = await db.harnesses.where('projectId').equals(p.id).toArray();
          if (harnesses.length > 0) {
            const projectResult = computeInternalProjectDynamic(
              harnesses.map(h => h.input),
              pricingContext,
              p.config?.factoryId || 'Chongqing'
            );
            /* internalCost removed */ unitCost = projectResult.vehicleCost;
          }
        }
        
        info[p.id] = { harnessCount: count, unitCost, /* internalCost removed */ unitCost };
      }
      setExtraInfo(info);
    };
    if (projects.length > 0) {
      fetchExtra();
    }
  }, [projects, pricingContext]);

  const filteredProjects = projects.filter(p => {
    if (!p.meta) return false;
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (p.meta.projectName || '').toLowerCase().includes(search) ||
      (p.meta.projectCode || '').toLowerCase().includes(search) ||
      (p.meta.customer || '').toLowerCase().includes(search);
    
    const allowedStatuses = statusFilterMap[statusFilter] || statusFilterMap['all'] || [];
    const matchesStatus = allowedStatuses.includes(p.meta.status);
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Empty title="还没有项目" description="点击下方按钮创建" />
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Button
            theme="light"
            icon={<IconUpload />}
            onClick={handleImport}
          >
            导入项目
          </Button>
          <Button
            theme="solid"
            type="primary"
            icon={<IconPlus />}
            onClick={() => navigate('/wizard')}
          >
            新建项目
          </Button>
        </div>
      </div>
    );
  }

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await projectRepo.remove(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      Toast.success('删除成功');
    } catch (err) {
      console.error(err);
      Toast.error('删除失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={4} style={{ color: 'var(--semi-color-text-0)', margin: 0 }}>项目列表</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            theme="light"
            icon={<IconUpload />}
            onClick={handleImport}
          >
            导入项目
          </Button>
          <Button
            theme="solid"
            type="primary"
            icon={<IconPlus />}
            onClick={() => navigate('/wizard')}
          >
            新建项目
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          prefix={<IconSearch />}
          placeholder="搜索项目名称、编号或客户..."
          value={searchTerm}
          onChange={setSearchTerm}
          style={{ width: 300 }}
          showClear
        />
        <RadioGroup
          type="button"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <Radio value="all">全部</Radio>
          <Radio value="ongoing">进行中</Radio>
          <Radio value="completed">已完成</Radio>
          <Radio value="archived">已归档</Radio>
        </RadioGroup>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {filteredProjects.map((p) => (
          <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{ cursor: 'pointer' }}>
          <Card className="elite-card animate-fade-up"
            style={{
              /* removed solid background */
              /* removed solid background */
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Title heading={5} style={{ color: 'var(--semi-color-text-0)', margin: 0 }}>
                  {p.meta.projectName}
                </Title>
                <Text style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>
                  {p.meta.projectCode} · {p.meta.customer}
                </Text>
              </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    icon={<IconDownload />}
                    type="primary"
                    theme="borderless"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadProjectPackage(p.id);
                    }}
                  />
                  <Button
                    icon={<IconDownload />}
                    theme="borderless"
                    size="small"
                    style={{ color: 'var(--semi-color-success)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      exportProjectZip(p.id);
                    }}
                    title="导出ZIP"
                  />
                  <RoleGuard field="deleteProject">
                    <Popconfirm title="确定删除此项目吗？" content="删除后数据将不可恢复" onConfirm={(e) => handleDelete(p.id, e as unknown as React.MouseEvent)}
                      onCancel={(e) => e?.stopPropagation()}
                      position="bottomRight"
                    >
                      <Button
                        icon={<IconDelete />}
                        type="danger"
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </RoleGuard>
                </div>
            </div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text type="tertiary" size="small">线束数量</Text>
                <Text strong>{extraInfo[p.id]?.harnessCount ?? 0}</Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text type="tertiary" size="small">报价金额</Text>
                <Text strong>
                  {extraInfo[p.id]?.unitCost 
                    ? `¥${extraInfo[p.id]?.unitCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                    : '-'}
                </Text>
              </div>
              <RoleGuard field="/* internalCost removed */ unitCost">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text type="tertiary" size="small">内部核算 (实绩)</Text>
                  <Text strong style={{ color: 'var(--semi-color-warning)' }}>
                    {extraInfo[p.id]?./* internalCost removed */ unitCost 
                      ? `¥${extraInfo[p.id]?./* internalCost removed */ unitCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : '-'}
                  </Text>
                </div>
              </RoleGuard>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text type="tertiary" size="small">当前状态</Text>
                <Text type="tertiary" size="small">当前状态</Text>
                <Tag color={
                  p.meta.status === 'draft' ? 'grey' :
                  p.meta.status === 'quoted' ? 'blue' :
                  p.meta.status === 'awarded' ? 'green' :
                  p.meta.status === 'production' ? 'cyan' : 'red'
                } size="small" style={{ width: 'fit-content' }}>
                  {statusMap[p.meta.status]}
                </Tag>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text type="tertiary" size="small">最后更新</Text>
                <Text size="small">{new Date(p.meta.updatedAt).toLocaleDateString('zh-CN')}</Text>
              </div>
            </div>
          </Card>
          </div>
        ))} 
      </div>
    </div>
  );
}