import React, { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Card,
  Collapse,
  DatePicker,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { apiClient } from '@/lib/apiClient';
import type { AuditLog } from '@/types/audit';
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

const ENTITY_MAP: Record<AuditLog['entity'], string> = {
  project: '项目',
  harness: '线束',
  bom: 'BOM',
  quote: '报价',
  version: '版本',
  scenario: '场景',
  change: '设变',
  tracking: '追踪',
  pricing: '价格',
  setting: '设置',
  alert: '预警',
};

function formatDateTime(value: string) {
  return new Date(value)
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/\//g, '-');
}

export const AuditLogPanel: React.FC<Props> = ({ projectId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<Date[] | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function fetchLogs() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient<AuditLog[]>(`/projects/${projectId}/audit-logs`);
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        setError('审计日志需要连接后端服务。');
      } finally {
        setLoading(false);
      }
    }

    void fetchLogs();
  }, [isAuthenticated, projectId]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }
      if (entityFilter !== 'all' && log.entity !== entityFilter) {
        return false;
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        const current = new Date(log.createdAt).getTime();
        const start = new Date(dateRange[0]).setHours(0, 0, 0, 0);
        const end = new Date(dateRange[1]).setHours(23, 59, 59, 999);
        if (current < start || current > end) {
          return false;
        }
      }
      return true;
    });
  }, [actionFilter, dateRange, entityFilter, logs]);

  if (!isAuthenticated) {
    return null;
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      render: (user: AuditLog['user']) => user?.name || user?.email || '-',
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      render: (action: AuditLog['action']) => {
        const config = ACTION_MAP[action] || { label: action, color: 'grey' };
        return <Tag color={config.color as any}>{config.label}</Tag>;
      },
    },
    {
      title: '实体',
      dataIndex: 'entity',
      key: 'entity',
      render: (entity: AuditLog['entity']) => ENTITY_MAP[entity] || entity,
    },
    {
      title: '实体 ID',
      dataIndex: 'entityId',
      key: 'entityId',
      render: (value: string) => <Text copyable>{value?.slice(0, 12) || '-'}</Text>,
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      render: (value: string | null) => {
        if (!value) {
          return '-';
        }
        try {
          const parsed = JSON.parse(value);
          return (
            <Tooltip
              content={(
                <pre style={{ maxWidth: 420, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              )}
            >
              <Text ellipsis={{ showTooltip: false }} style={{ width: 240 }}>
                {value}
              </Text>
            </Tooltip>
          );
        } catch {
          return value;
        }
      },
    },
  ];

  return (
    <div style={{ marginTop: 24 }}>
      <Collapse>
        <Collapse.Panel header="操作日志" itemKey="audit-logs">
          <Card style={{ background: 'var(--semi-color-bg-2)', border: 'none' }} bodyStyle={{ padding: 0 }}>
            {error && <Banner type="danger" description={error} style={{ marginBottom: 16 }} />}

            <Space style={{ marginTop: 16, marginBottom: 16 }} wrap>
              <DatePicker
                type="dateRange"
                placeholder={['开始日期', '结束日期']}
                value={dateRange ?? undefined}
                onChange={(value) => setDateRange(value as Date[] | null)}
              />
              <Select
                value={actionFilter}
                onChange={(value) => setActionFilter(value as string)}
                style={{ width: 140 }}
                placeholder="动作类型"
              >
                <Select.Option value="all">全部动作</Select.Option>
                <Select.Option value="CREATE">创建</Select.Option>
                <Select.Option value="UPDATE">更新</Select.Option>
                <Select.Option value="DELETE">删除</Select.Option>
                <Select.Option value="STATUS_CHANGE">状态变更</Select.Option>
              </Select>
              <Select
                value={entityFilter}
                onChange={(value) => setEntityFilter(value as string)}
                style={{ width: 140 }}
                placeholder="实体类型"
              >
                <Select.Option value="all">全部实体</Select.Option>
                <Select.Option value="project">项目</Select.Option>
                <Select.Option value="scenario">场景</Select.Option>
                <Select.Option value="harness">线束</Select.Option>
                <Select.Option value="bom">BOM</Select.Option>
                <Select.Option value="quote">报价</Select.Option>
                <Select.Option value="version">版本</Select.Option>
                <Select.Option value="change">设变</Select.Option>
                <Select.Option value="tracking">追踪</Select.Option>
                <Select.Option value="pricing">价格</Select.Option>
                <Select.Option value="setting">设置</Select.Option>
                <Select.Option value="alert">预警</Select.Option>
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
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10 }}
                empty={<Empty title="暂无日志" description="符合条件的审计日志会显示在这里。" />}
              />
            )}
          </Card>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};
