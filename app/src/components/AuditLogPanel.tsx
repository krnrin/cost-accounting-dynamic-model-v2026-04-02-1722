import React, { useEffect, useState, useMemo } from 'react';
import { 
  Table, 
  DatePicker, 
  Select, 
  Spin, 
  Banner, 
  Card, 
  Typography, 
  Tooltip, 
  Tag, 
  Space, 
  Empty,
  Collapse
} from '@douyinfe/semi-ui';
import { apiClient } from '@/lib/apiClient';
import { AuditLog } from '@/types/audit';
import { useAuthStore } from '@/store/authStore';

const { Text } = Typography;

interface Props {
  projectId: string;
}

const ACTION_MAP = {
  CREATE: { label: '创建', color: 'green' },
  UPDATE: { label: '更新', color: 'blue' },
  DELETE: { label: '删除', color: 'red' },
  STATUS_CHANGE: { label: '状态变更', color: 'orange' },
} as const;

const ENTITY_MAP = {
  project: '项目',
  harness: '线束',
  quote: '报价',
  version: '版本',
} as const;

export const AuditLogPanel: React.FC<Props> = ({ projectId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  const [dateRange, setDateRange] = useState<Date[] | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient(`/projects/${projectId}/audit-logs`);
        setLogs(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Failed to fetch audit logs:', err);
        setError('审计日志需要连接后端服务器');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [projectId, isAuthenticated]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (entityFilter !== 'all' && log.entity !== entityFilter) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const logDate = new Date(log.createdAt);
        const start = new Date(dateRange[0]);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateRange[1]);
        end.setHours(23, 59, 59, 999);
        if (logDate < start || logDate > end) return false;
      }
      return true;
    });
  }, [logs, actionFilter, entityFilter, dateRange]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => {
        const date = new Date(text);
        return date.toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false 
        }).replace(/\//g, '-');
      },
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      render: (user: AuditLog['user']) => user?.name || user?.email || '-',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (action: keyof typeof ACTION_MAP) => {
        const config = ACTION_MAP[action] || { label: action, color: 'grey' };
        return <Tag color={config.color as any}>{config.label}</Tag>;
      },
    },
    {
      title: '实体',
      dataIndex: 'entity',
      key: 'entity',
      render: (entity: keyof typeof ENTITY_MAP) => ENTITY_MAP[entity] || entity,
    },
    {
      title: '实体ID',
      dataIndex: 'entityId',
      key: 'entityId',
      render: (id: string) => <Text copyable>{id?.substring(0, 8)}</Text>,
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      render: (details: string | null) => {
        if (!details) return '-';
        try {
          const parsed = JSON.parse(details);
          return (
            <Tooltip content={<pre style={{ maxWidth: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(parsed, null, 2)}</pre>}>
              <Text ellipsis={{ showTooltip: false }} style={{ width: 200 }}>
                {details}
              </Text>
            </Tooltip>
          );
        } catch {
          return details;
        }
      },
    },
  ];

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <Collapse>
        <Collapse.Panel header="操作日志" itemKey="audit-logs">
          <Card style={{ background: 'var(--semi-color-bg-2)', border: 'none' }} bodyStyle={{ padding: 0 }}>
            {error && <Banner type="danger" description={error} style={{ marginBottom: 16 }} />}
            
            <Space style={{ marginBottom: 16, marginTop: 16 }} wrap>
              <DatePicker 
                type="dateRange" 
                placeholder={['开始日期', '结束日期']}
                value={dateRange ?? undefined}
                onChange={(v) => setDateRange(v as Date[] | null)}
              />
              <Select 
                value={actionFilter} 
                onChange={(v) => setActionFilter(v as string)}
                style={{ width: 120 }}
                placeholder="操作类型"
              >
                <Select.Option value="all">所有操作</Select.Option>
                <Select.Option value="CREATE">创建</Select.Option>
                <Select.Option value="UPDATE">更新</Select.Option>
                <Select.Option value="DELETE">删除</Select.Option>
                <Select.Option value="STATUS_CHANGE">状态变更</Select.Option>
              </Select>
              <Select 
                value={entityFilter} 
                onChange={(v) => setEntityFilter(v as string)}
                style={{ width: 120 }}
                placeholder="实体类型"
              >
                <Select.Option value="all">所有实体</Select.Option>
                <Select.Option value="project">项目</Select.Option>
                <Select.Option value="harness">线束</Select.Option>
                <Select.Option value="quote">报价</Select.Option>
                <Select.Option value="version">版本</Select.Option>
              </Select>
            </Space>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : (
              <Table
                columns={columns}
                dataSource={filteredLogs}
                pagination={{ pageSize: 10 }}
                empty={<Empty title="暂无日志" description="符合条件的审计日志将在此显示" />}
                size="small"
                rowKey="id"
              />
            )}
          </Card>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};
