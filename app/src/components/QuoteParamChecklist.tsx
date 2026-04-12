/**
 * D4: 报价参数检查清单
 * 报价前检查关键参数是否已配置
 */
import { Typography, Tag, Space } from '@douyinfe/semi-ui';
import { IconTickCircle, IconAlertTriangle } from '@douyinfe/semi-icons';
import type { CSSProperties } from 'react';

const { Text } = Typography;

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckItem {
  label: string;
  status: CheckStatus;
  detail?: string;
}

interface QuoteParamChecklistProps {
  items: CheckItem[];
}

const S: Record<string, CSSProperties> = {
  pass: { color: '#0b7a3e' },
  warn: { color: '#d97706' },
  fail: { color: '#dc2626' },
  detail: { marginLeft: 8 },
};

const STATUS_CONFIG = {
  pass: { icon: <IconTickCircle style={S.pass} />, color: 'green' as const, label: '通过' },
  warn: { icon: <IconAlertTriangle style={S.warn} />, color: 'orange' as const, label: '警告' },
  fail: { icon: <span style={S.fail}>✗</span>, color: 'red' as const, label: '失败' },
};

export default function QuoteParamChecklist({ items }: QuoteParamChecklistProps) {
  return (
    <div>
      {items.map((item, i) => {
        const cfg = STATUS_CONFIG[item.status];
        return (
          <div key={i}>
            <Space>
              {cfg.icon}
              <Tag color={cfg.color} size="small">{cfg.label}</Tag>
              <Text strong>{item.label}</Text>
              {item.detail && <Text type="tertiary" style={S.detail}>{item.detail}</Text>}
            </Space>
          </div>
        );
      })}
    </div>
  );
}
