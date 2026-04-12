/**
 * C3: 双引擎 UI
 * 内部实绩引擎 vs 客户报价引擎 切换组件
 */
import { Select, Typography, Tag, Card } from '@douyinfe/semi-ui';
import type { CSSProperties } from 'react';

const { Text } = Typography;

export type EngineType = 'internal' | 'customer';

interface EngineSelectorProps {
  value?: EngineType;
  onChange?: (engine: EngineType) => void;
}

const ENGINE_INFO: Record<EngineType, { label: string; description: string; color: string }> = {
  internal: {
    label: '内部实绩引擎',
    description: '基于实际成本结构(间接人工、低值易耗品、厂房分摊等)计算内部实绩成本',
    color: 'blue',
  },
  customer: {
    label: '客户报价引擎',
    description: '基于对外报价模型(材料+废品+人工制造+管理费+利润+包装运输)计算到厂价',
    color: 'green',
  },
};

const S: Record<string, CSSProperties> = {
  card: { marginBottom: 16 },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  select: { width: 200 },
};

export default function EngineSelector({ value = 'customer', onChange }: EngineSelectorProps) {
  return (
    <Card style={S.card}>
      <div style={S.row}>
        <Text strong>计算引擎:</Text>
        <Select value={value} onChange={(v) => onChange?.(v as EngineType)} style={S.select}>
          <Select.Option value="internal">
            <Tag color="blue" size="small">内部</Tag> 内部实绩引擎
          </Select.Option>
          <Select.Option value="customer">
            <Tag color="green" size="small">客户</Tag> 客户报价引擎
          </Select.Option>
        </Select>
        <Text type="tertiary" size="small">{ENGINE_INFO[value].description}</Text>
      </div>
    </Card>
  );
}
