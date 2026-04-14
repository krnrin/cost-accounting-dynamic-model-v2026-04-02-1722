/**
 * ChartGrid — 4 ECharts panels arranged in a 2×2 grid.
 */
import { useMemo } from 'react';
import { Typography, Col } from '@douyinfe/semi-ui';
import ReactECharts from 'echarts-for-react/lib/core';
import echarts from '@/lib/echarts';
import type { ProjectHarnessResult, InternalHarnessResult, InternalProjectResult } from '@/types/harness';
import type { ScenarioRecord } from '@/data/db';
import type { EffectiveHarnessItem } from '@/hooks/useDashboardData';
import {
  buildWaterfallChart,
  buildProfitCompareChart,
  buildCostBreakdownChart,
  buildMetalSensitivityChart,
} from './chartConfigs';

const { Title } = Typography;

interface Props {
  summary: ProjectHarnessResult | null;
  scenario: ScenarioRecord | null;
  effectiveCustomerHarnesses: EffectiveHarnessItem[];
  internalSummary: InternalProjectResult | null;
  internalHarnesses: InternalHarnessResult[];
}

export default function ChartGrid(props: Props) {
  const { summary, scenario, effectiveCustomerHarnesses, internalSummary, internalHarnesses } = props;

  const waterfallChart = useMemo(() => buildWaterfallChart(summary), [summary]);
  const profitCompareChart = useMemo(
    () => buildProfitCompareChart(effectiveCustomerHarnesses, internalSummary, internalHarnesses),
    [effectiveCustomerHarnesses, internalSummary, internalHarnesses],
  );
  const costBreakdownChart = useMemo(() => buildCostBreakdownChart(summary), [summary]);
  const metalSensitivityChart = useMemo(
    () => buildMetalSensitivityChart(summary, scenario),
    [summary, scenario],
  );

  return (
    <>
      <Col span={12}>
        <div className="glass-card db-chart-card">
          <Title heading={5} className="ink-heading db-chart-title">
            成本桥 (单车加权)
          </Title>
          <div className="db-chart-body">
            <ReactECharts echarts={echarts} option={waterfallChart} className="db-chart" />
          </div>
        </div>
      </Col>

      <Col span={12}>
        <div className="glass-card db-chart-card">
          <Title heading={5} className="ink-heading db-chart-title">
            线束利润对比 (客户报价 vs 内部实绩)
          </Title>
          <div className="db-chart-body">
            <ReactECharts echarts={echarts} option={profitCompareChart} className="db-chart" />
          </div>
        </div>
      </Col>

      <Col span={14}>
        <div className="glass-card db-chart-card">
          <Title heading={5} className="ink-heading db-chart-title">
            线束成本构成分析
          </Title>
          <div className="db-chart-body">
            <ReactECharts echarts={echarts} option={costBreakdownChart} className="db-chart" />
          </div>
        </div>
      </Col>

      <Col span={10}>
        <div className="glass-card db-chart-card">
          <Title heading={5} className="ink-heading db-chart-title">
            金属价格敏感性 (单车变动)
          </Title>
          <div className="db-chart-body">
            <ReactECharts echarts={echarts} option={metalSensitivityChart} className="db-chart" />
          </div>
        </div>
      </Col>
    </>
  );
}
