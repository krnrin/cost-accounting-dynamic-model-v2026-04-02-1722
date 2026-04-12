/**
 * D10: BOM 成本预览卡片
 * 展示单条线束的成本汇总信息
 */
import { Typography, Descriptions, Tag } from '@douyinfe/semi-ui';
import { tField } from '@/lib/i18n';
import type { HarnessResult } from '@/types/harness';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

interface BomCostPreviewProps {
  harnessName: string;
  result: HarnessResult;
  showDetail?: boolean;
}

const S: Record<string, CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ml4: { marginLeft: 4 },
  ml16: { marginLeft: 16 },
  noMargin: { margin: 0 },
  footer: { marginTop: 12 },
  up: { color: '#d32f2f' },
  down: { color: '#0070f3' },
};

function formatCNY(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return `\u00a5${value.toFixed(2)}`;
}

export default function BomCostPreview({ harnessName, result, showDetail = true }: BomCostPreviewProps) {
  const r = result || ({} as HarnessResult);

  const mainItems = [
    { key: tField('materialCost'), value: formatCNY(r.materialCost) },
    { key: tField('wasteCost'), value: formatCNY(r.wasteCost) },
    { key: tField('laborPlusMfg'), value: formatCNY(r.laborPlusMfg) },
    { key: tField('mgmtFee'), value: formatCNY(r.mgmtFee) },
    { key: tField('profit'), value: formatCNY(r.profit) },
    { key: tField('exFactoryPrice'), value: formatCNY(r.exFactoryPrice) },
    { key: tField('packTotal'), value: formatCNY(r.packTotal) },
  ];

  return (
    <div>
      <div style={S.header}>
        <Title heading={6} style={S.noMargin}>
          {harnessName}
          <Text type="tertiary" size="small" style={S.ml4}>成本概览</Text>
        </Title>
        <Tag color="blue" size="large">
          到厂价: {formatCNY(r.deliveredPrice)}
        </Tag>
      </div>

      {showDetail && (
        <Descriptions data={mainItems} />
      )}

      {r.copperWeight !== undefined && (
        <div style={S.footer}>
          <Text type="tertiary" size="small">
            铜重: {r.copperWeight?.toFixed(3)} kg
            <Text style={S.ml16}>铝重: {r.aluminumWeight?.toFixed(3)} kg</Text>
          </Text>
        </div>
      )}
    </div>
  );
}
