/**
 * CascadeImpactIntegration — ChangeEnginePage 的级联影响集成面板
 *
 * 独立组件，避免修改 ChangeEnginePage.tsx（58KB）。
 * 在 ChangeEnginePage 中嵌入此组件即可获得级联影响计算能力。
 *
 * 用法：
 *   import CascadeImpactIntegration from '@/components/CascadeImpactIntegration';
 *   <CascadeImpactIntegration
 *     bomChanges={bomChanges}
 *     semanticChanges={semanticChanges}
 *     sheetData= assemblyRows, secondaryRows, kskRows 
 *     onImpactComputed={(result) => handleImpact(result)}
 *   />
 *
 * Issue: #96
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Collapsible, Descriptions, Empty, Space, Spin, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconRefresh, IconChevronDown, IconChevronRight } from '@douyinfe/semi-icons';
import { useCascadeImpact, type CascadeImpactResult } from '@/hooks/useCascadeImpact';

const { Text, Title } = Typography;

export interface CascadeImpactIntegrationProps {
  /** BOM 行级变更数据 */
  bomChanges: any;
  /** 语义分类结果（来自 change_pattern_classifier） */
  semanticChanges: any;
  /** 各 sheet 行数据 */
  sheetData: {
    assemblyRows?: any;
    secondaryRows?: any;
    kskRows?: any;
  };
  /** 计算完成回调 */
  onImpactComputed?: (result: CascadeImpactResult) => void;
  /** 是否自动计算（当依赖数据变化时） */
  autoCompute?: boolean;
}

/** 影响操作类型标签颜色 */
function actionTypeColor(type: string): string {
  switch (type) {
    case 'add': return 'green';
    case 'update': return 'blue';
    case 'delete': return 'red';
    case 'replace': return 'orange';
    default: return 'grey';
  }
}

function ActionTable({ actions, title }: { actions: any[] | null; title: string }) {
  const [expanded, setExpanded] = useState(true);

  if (!actions || actions.length === 0) {
    return null;
  }

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => <Tag color={actionTypeColor(value)}>{value}</Tag>,
    },
    {
      title: '目标行',
      dataIndex: 'targetRow',
      width: 120,
      render: (value: any) => <Text>{value?.partNo || value?.id || '-'}</Text>,
    },
    {
      title: '字段',
      dataIndex: 'field',
      width: 120,
    },
    {
      title: '旧值',
      dataIndex: 'oldValue',
      width: 120,
      render: (value: any) => <Text type="tertiary">{value != null ? String(value) : '-'}</Text>,
    },
    {
      title: '新值',
      dataIndex: 'newValue',
      width: 120,
      render: (value: any) => <Text type="success">{value != null ? String(value) : '-'}</Text>,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      render: (value: string) => <Text type="tertiary">{value || '-'}</Text>,
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <IconChevronDown /> : <IconChevronRight />}
        <Text strong>{title}</Text>
        <Tag size="small" color="blue">{actions.length} 条操作</Tag>
      </div>
      <Collapsible isOpen={expanded}>
        <Table
          columns={columns}
          dataSource={actions}
          rowKey={(_, idx) => String(idx)}
          pagination={false}
          size="small"
        />
      </Collapsible>
    </div>
  );
}

export default function CascadeImpactIntegration({
  bomChanges,
  semanticChanges,
  sheetData,
  onImpactComputed,
  autoCompute = false,
}: CascadeImpactIntegrationProps) {
  const cascade = useCascadeImpact();

  const handleCompute = useCallback(async () => {
    try {
      const result = await cascade.computeAll(bomChanges, semanticChanges, sheetData);
      onImpactComputed?.(result);
      if (result.hasImpact) {
        Toast.info(`级联影响分析完成：${result.totalActions} 条操作`);
      } else {
        Toast.info('未检测到级联影响');
      }
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '级联影响计算失败');
    }
  }, [bomChanges, semanticChanges, sheetData, cascade, onImpactComputed]);

  // Auto-compute when deps change
  useEffect(() => {
    if (autoCompute && bomChanges && semanticChanges) {
      void handleCompute();
    }
  }, [autoCompute, bomChanges, semanticChanges]);

  const result = cascade.result;

  return (
    <Card
      className="glass-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Title heading={6} style={{ margin: 0 }}>级联影响分析</Title>
          <Button
            icon={<IconRefresh />}
            loading={cascade.computing}
            onClick={handleCompute}
            size="small"
            theme="light"
          >
            {result ? '重新计算' : '计算影响'}
          </Button>
        </div>
      }
    >
      {cascade.computing ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="正在计算级联影响..." />
        </div>
      ) : result ? (
        <div>
          <Descriptions
            data={[
              { key: '总操作数', value: <Tag color={result.hasImpact ? 'orange' : 'green'}>{result.totalActions}</Tag> },
              { key: '装配件表', value: result.assembly ? `${(result.assembly as any).actions?.length ?? 0} 条` : '未计算' },
              { key: '辅材表', value: result.secondary ? `${(result.secondary as any).actions?.length ?? 0} 条` : '未计算' },
              { key: 'KSK 表', value: result.ksk ? `${(result.ksk as any).actions?.length ?? 0} 条` : '未计算' },
              { key: '计算时间', value: new Date(result.computedAt).toLocaleString('zh-CN') },
            ]}
            style={{ marginBottom: 16 }}
          />

          {result.assembly && (result.assembly as any).actions?.length > 0 && (
            <ActionTable actions={(result.assembly as any).actions} title="装配件表级联影响" />
          )}
          {result.secondary && (result.secondary as any).actions?.length > 0 && (
            <ActionTable actions={(result.secondary as any).actions} title="辅材表级联影响" />
          )}
          {result.ksk && (result.ksk as any).actions?.length > 0 && (
            <ActionTable actions={(result.ksk as any).actions} title="KSK 表级联影响" />
          )}

          {!result.hasImpact && (
            <Empty description="未检测到级联影响" style={{ padding: 32 }} />
          )}
        </div>
      ) : (
        <Empty
          description={'点击“计算影响”分析 BOM 变更的级联效应'}
          style={{ padding: 32 }}
        />
      )}
    </Card>
  );
}
