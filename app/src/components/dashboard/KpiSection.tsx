/**
 * KpiSection — Project info card + 4 KPI cards.
 */
import { Typography, Tag, RadioGroup, Radio, Row, Col } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import type { ProjectRecord, ScenarioRecord } from '@/data/db';
import type { ProjectHarnessResult } from '@/types/harness';

const { Title, Text } = Typography;

interface Props {
  id: string | undefined;
  sid: string | undefined;
  project: ProjectRecord;
  scenario: ScenarioRecord | null;
  harnessCount: number;
  totalHours: number;
  mode: 'customer' | 'internal';
  setMode: (m: 'customer' | 'internal') => void;
  vehicleCost: number;
  snapshotCustomerVehicleCost: number;
  customerVehicleCost: number;
  internalVehicleCost: number;
  grossMargin: number;
  allocPerVehicle: number;
  allocSummary: any;
}

export default function KpiSection(props: Props) {
  const {
    id, sid, project, scenario, harnessCount, totalHours,
    mode, setMode, vehicleCost, snapshotCustomerVehicleCost,
    customerVehicleCost, internalVehicleCost, grossMargin,
    allocPerVehicle, allocSummary,
  } = props;
  const navigate = useNavigate();

  const navItems = [
    { label: 'BOM', path: '/project/' + id + '/s/' + sid + '/bom-workbook' },
    { label: '报价', path: '/project/' + id + '/s/' + sid + '/quote' },
    { label: '价格', path: '/project/' + id + '/s/' + sid + '/annual-drop' },
    { label: '分摊', path: '/project/' + id + '/s/' + sid + '/alloc' },
    { label: '变更', path: '/project/' + id + '/s/' + sid + '/change-engine' },
    { label: '模拟', path: '/project/' + id + '/s/' + sid + '/simulation' },
    { label: '连接器价', path: '/project/' + id + '/s/' + sid + '/pricing/connectors' },
    { label: '导线价', path: '/project/' + id + '/s/' + sid + '/pricing/wires' },
    { label: '开发件价', path: '/project/' + id + '/s/' + sid + '/pricing/devparts' },
    { label: '跟踪', path: '/project/' + id + '/s/' + sid + '/tracking' },
    { label: '预警', path: '/project/' + id + '/alerts' },
    { label: '治理', path: '/project/' + id },
  ];

  const fmtCurrency = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      {/* Project info */}
      <Col span={8}>
        <div className="glass-card db-project-card">
          <Title heading={3} className="ink-heading db-project-title">
            {project.meta?.projectName || project.id}
          </Title>
          <Text type="secondary" className="db-project-meta">
            {project.meta?.customer} · {project.meta?.platform} · {harnessCount} 件
          </Text>
          <div className="db-tag-row">
            <Tag color="blue">
              {project.meta?.status === 'quoted' ? '已报价' : project.meta?.status}
            </Tag>
            <Tag>生命周期 {scenario?.lifecycleYears || '-'} 年</Tag>
            <Tag color="green">总工时 {totalHours.toFixed(2)}h</Tag>
          </div>
          <div className="db-quick-nav">
            {navItems.map((btn) => (
              <div
                key={btn.path}
                onClick={() => navigate(btn.path)}
                className="db-quick-btn"
              >
                {btn.label} →
              </div>
            ))}
          </div>
        </div>
      </Col>

      {/* KPI: Vehicle Cost */}
      <Col span={4}>
        <div className="glass-card db-kpi-card">
          <div className="db-kpi-header">
            <Text className="db-kpi-label">
              {mode === 'internal' ? '内部单车成本' : '当前有效客户价'}
            </Text>
            <RadioGroup
              type="button"
              buttonSize="small"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <Radio value="customer">客户</Radio>
              <Radio value="internal">内部</Radio>
            </RadioGroup>
          </div>
          <div className="ledger-number db-kpi-number">
            ¥{fmtCurrency(vehicleCost)}
          </div>
          {mode === 'customer' && (
            <Text className="db-kpi-sub">
              定点快照 ¥{snapshotCustomerVehicleCost.toFixed(2)}
            </Text>
          )}
        </div>
      </Col>

      {/* KPI: Gross Margin */}
      <Col span={4}>
        <div className="glass-card db-kpi-card">
          <Text className="db-kpi-label">内部毛利率</Text>
          <div className="ledger-number db-kpi-number">
            {grossMargin.toFixed(1)}%
          </div>
          <Text className="db-kpi-sub">
            差额 ¥{(customerVehicleCost - internalVehicleCost).toFixed(2)}/车
          </Text>
          <Text className="db-kpi-hint">按当前有效客户价计算</Text>
        </div>
      </Col>

      {/* KPI: Snapshot Price */}
      <Col span={4}>
        <div className="glass-card db-kpi-card">
          <Text className="db-kpi-label">定点快照价</Text>
          <div className="ledger-number db-kpi-number-sm">
            ¥{fmtCurrency(snapshotCustomerVehicleCost)}
          </div>
          <Text className="db-kpi-sub">
            当前有效价较定点快照{' '}
            {customerVehicleCost >= snapshotCustomerVehicleCost ? '+' : ''}
            ¥{(customerVehicleCost - snapshotCustomerVehicleCost).toFixed(2)}/车
          </Text>
          <Text className="db-kpi-hint">
            当前生效分摊 ¥{allocPerVehicle.toFixed(2)}/车
          </Text>
        </div>
      </Col>

      {/* KPI: One-time Cost */}
      <Col span={4}>
        <div className="glass-card db-kpi-card">
          <Text className="db-kpi-label">一次性费用</Text>
          <div className="ledger-number db-kpi-number">
            ¥{(allocSummary?.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <Text className="db-kpi-sub">
            工装 {(allocSummary?.totalTooling || 0).toLocaleString()} · 试验{' '}
            {(allocSummary?.totalTesting || 0).toLocaleString()}
          </Text>
        </div>
      </Col>
    </>
  );
}
