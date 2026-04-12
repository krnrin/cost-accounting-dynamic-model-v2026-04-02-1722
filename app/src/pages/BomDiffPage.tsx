import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Typography, Spin, Empty, Button, Table, Tag } from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function BomDiffPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!sid) return;
      const base = searchParams.get('base');
      if (!base) {
        setRows([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/scenarios/${sid}/bom/diff?base=${base}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      setRows(json.data || []);
      setLoading(false);
    }
    load();
  }, [sid, searchParams, token]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const columns = [
    { title: '变更类型', dataIndex: 'changeType', render: (v: string) => <Tag color={v === 'added' ? 'green' : v === 'cancelled' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '线束号', render: (_: any, r: any) => r.current?.harnessId || r.base?.harnessId },
    { title: '零件号', render: (_: any, r: any) => r.current?.partNo || r.base?.partNo },
    { title: '当前名称', render: (_: any, r: any) => r.current?.partName || '-' },
    { title: '基线名称', render: (_: any, r: any) => r.base?.partName || '-' },
    { title: '当前金额', render: (_: any, r: any) => r.current ? `¥${Number(r.current.amount || 0).toFixed(2)}` : '-' },
    { title: '基线金额', render: (_: any, r: any) => r.base ? `¥${Number(r.base.amount || 0).toFixed(2)}` : '-' },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px 0' }}>
        <Button icon={<IconArrowLeft />} aria-label="返回" theme="borderless" onClick={() => navigate(`/project/${id}`)} />
        <div>
          <Title heading={4} style={{ margin: 0 }}>BOM 差异比较</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>场景间 BOM 变更行对比</Text>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty description="暂无差异或未选择基线场景" />
      ) : (
        <Table rowKey={(r) => `${r.changeType}-${r.current?.id || r.base?.id || Math.random()}`} columns={columns} dataSource={rows} pagination={false} />
      )}
    </div>
  );
}
