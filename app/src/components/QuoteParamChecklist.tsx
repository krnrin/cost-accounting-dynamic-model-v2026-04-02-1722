/**
 * D4: 报价参数检查清单
 * 报价前检查关键参数是否已配置
 */
import { Typography, Tag, Space } from '@douyinfe/semi-ui';
import { IconTickCircle, IconAlertTriangle, IconCrossCircle } from '@douyinfe/semi-icons';
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

const STATUS_CONFIG: Record<CheckStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pass: { icon: <IconTickCircle style={S.pass} />, color: 'green', label: '通过' },
  warn: { icon: <IconAlertTriangle style={S.warn} />, color: 'orange', label: '警告' },
  fail: { icon: <IconCrossCircle style={S.fail} />, color: 'red', label: '失败' },
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
