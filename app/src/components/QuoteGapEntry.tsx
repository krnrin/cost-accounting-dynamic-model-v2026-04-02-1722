/**
 * QuoteGapEntry — QuotePage 的 Gap 分析入口组件
 *
 * 独立组件，避免修改 QuotePage.tsx（31KB）。
 * 在 QuotePage 中嵌入此组件即可提供 Gap 分析入口。
 *
 * 用法：
 *   import QuoteGapEntry from '@/components/QuoteGapEntry';
 *   <QuoteGapEntry projectId={projectId} scenarioId={scenarioId} />
 *
 * Issue: #59 (Gap Analysis)
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Tag, Toast, Typography, Space, Descriptions } from '@douyinfe/semi-ui';
import { IconExternalOpen, IconRefresh } from '@douyinfe/semi-icons';
import { useGapAnalysis } from '@/hooks/useGapAnalysis';

const { Text, Title } = Typography;

export interface QuoteGapEntryProps {
  projectId: string;
  scenarioId: string;
  /** 可选：内联模式（不显示卡片包装） */
  inline?: boolean;
}

function formatPercent(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '-';
  return `¥${value.toFixed(2)}`;
}

function gapColor(gapPercent: number | undefined | null): string {
  if (gapPercent == null) return 'grey';
  const abs = Math.abs(gapPercent);
  if (abs <= 0.02) return 'green';
  if (abs <= 0.05) return 'orange';
  return 'red';
}

export default function QuoteGapEntry({
  projectId,
  scenarioId,
  inline = false,
}: QuoteGapEntryProps) {
  const navigate = useNavigate();
  const gap = useGapAnalysis();
  const [quickResult, setQuickResult] = useState<any>(null);

  const handleQuickGap = useCallback(async () => {
    try {
      // Quick gap check using the hook
      const result = await gap.computeGap({
        projectId,
        scenarioId,
        layers: ['customer_vs_internal'],
      });
      setQuickResult(result);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : 'Gap 快速检查失败');
    }
  }, [projectId, scenarioId, gap]);

  const handleNavigateToGap = useCallback(() => {
    navigate(`/project/${projectId}/s/${scenarioId}/gap`);
  }, [navigate, projectId, scenarioId]);

  const content = (
    <div>
      <div style= display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 >
        <Space>
          <Title heading={6} style= margin: 0 >报价 vs 实绩 Gap</Title>
          {quickResult && quickResult.overallGapPercent != null && (
            <Tag color={gapColor(quickResult.overallGapPercent)} size="large">
              {formatPercent(quickResult.overallGapPercent)}
            </Tag>
          )}
        </Space>
        <Space>
          <Button
            icon={<IconRefresh />}
            size="small"
            theme="light"
            loading={gap.computing}
            onClick={handleQuickGap}
          >
            快速检查
          </Button>
          <Button
            icon={<IconExternalOpen />}
            size="small"
            theme="solid"
            onClick={handleNavigateToGap}
          >
            完整分析
          </Button>
        </Space>
      </div>

      {quickResult && (
        <Descriptions
          data={[
            { key: '报价总额', value: formatCurrency(quickResult.quoteTotal) },
            { key: '实绩总额', value: formatCurrency(quickResult.actualTotal) },
            { key: 'Gap 金额', value: formatCurrency(quickResult.gapAmount) },
            { key: 'Gap 比率', value: (
              <Tag color={gapColor(quickResult.overallGapPercent)}>
                {formatPercent(quickResult.overallGapPercent)}
              </Tag>
            )},
            { key: '计算时间', value: quickResult.computedAt
              ? new Date(quickResult.computedAt).toLocaleString('zh-CN')
              : '-' },
          ]}
          size="small"
        />
      )}

      {!quickResult && (
        <Text type="tertiary" size="small">
          点击"快速检查"查看报价与实绩的差异概览，或"完整分析"进入 Gap 分析页面。
        </Text>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <Card className="glass-card" style= marginTop: 16 >
      {content}
    </Card>
  );
}
