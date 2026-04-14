/**
 * AllocationProgress — Recovery progress bars + KPI row.
 */
import { Typography, Row, Col, Progress, Empty, Tag } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface Props {
  id: string | undefined;
  sid: string | undefined;
  allocSummary: any;
  recoverySummary: any;
  allocRecoveryItems: any[];
  allocPerVehicle: number;
}

export default function AllocationProgress(props: Props) {
  const { id, sid, allocSummary, recoverySummary, allocRecoveryItems, allocPerVehicle } = props;
  const navigate = useNavigate();

  const overallPct = Math.round((recoverySummary?.overallRecoveryProgress ?? 0) * 100);
  const isComplete = (recoverySummary?.overallRecoveryProgress ?? 0) >= 1;

  return (
    <>
      {/* KPI row */}
      <Col span={24}>
        <Row gutter={16}>
          <Col span={6}>
            <div className="glass-card db-alloc-card">
              <Text className="db-kpi-label">分摊回收进度</Text>
              <div className="db-alloc-circle-row">
                <Progress
                  percent={overallPct}
                  type="circle"
                  width={56}
                  strokeWidth={6}
                  stroke={isComplete ? 'var(--success)' : 'var(--accent)'}
                />
                <div>
                  <div className="ledger-number db-kpi-number-sm">{overallPct.toFixed(1)}%</div>
                  <Text className="db-alloc-footer-text">
                    已回收 {recoverySummary?.fullyRecoveredCount ?? 0} /{' '}
                    {recoverySummary?.trackers?.filter((t: any) => t.totalOnetimeCost > 0).length ?? 0}
                  </Text>
                </div>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="glass-card db-alloc-card">
              <Text className="db-kpi-label">已回收金额</Text>
              <div className="ledger-number db-kpi-number">
                ¥{(recoverySummary?.totalRecovered ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="glass-card db-alloc-card">
              <Text className="db-kpi-label">待回收金额</Text>
              <div className="ledger-number db-kpi-number">
                ¥{(recoverySummary?.totalRemaining ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="glass-card db-alloc-card">
              <Text className="db-kpi-label">调价提醒</Text>
              <div className="ledger-number db-kpi-number">
                {recoverySummary?.priceAdjustmentAlerts?.length ?? 0} 条
              </div>
            </div>
          </Col>
        </Row>
      </Col>

      {/* Bar list */}
      <Col span={24}>
        <div className="glass-card db-chart-card">
          <div className="db-section-header">
            <Title heading={5} className="ink-heading">分摊回收进度</Title>
            <Text
              className="db-section-link"
              onClick={() => navigate('/project/' + id + '/s/' + sid + '/alloc')}
            >
              查看明细 →
            </Text>
          </div>
          {allocRecoveryItems.length === 0 ? (
            <Empty description="暂无分摊数据" />
          ) : (
            <div className="db-alloc-items">
              {allocRecoveryItems.map((alloc: any) => {
                const tracker = recoverySummary?.trackers?.find(
                  (t: any) => t.harnessId === alloc.harnessId,
                );
                const percent = tracker ? Math.round(tracker.recoveryProgress * 100) : 0;
                const strokeColor =
                  tracker?.status === 'overdue'
                    ? 'var(--danger)'
                    : percent >= 100
                      ? 'var(--success)'
                      : 'var(--accent)';
                return (
                  <div key={alloc.harnessId} className="db-alloc-bar-item">
                    <Text className="db-alloc-bar-label">
                      …{alloc.harnessId.slice(-4)}
                    </Text>
                    <div className="db-alloc-bar-progress">
                      <Progress percent={percent} size="small" stroke={strokeColor} />
                    </div>
                    {tracker?.status === 'overdue' && (
                      <Tag color="red" size="small">超期</Tag>
                    )}
                    <Text className="ledger-number db-alloc-bar-value">
                      ¥{alloc.totalPerUnit.toFixed(2)}
                    </Text>
                  </div>
                );
              })}
              <div className="db-alloc-footer">
                <Text className="db-alloc-footer-text">
                  参与 {allocSummary?.participatingCount || 0} / 不参与{' '}
                  {allocSummary?.nonParticipatingCount || 0}
                  　·　加权分摊 ¥{allocPerVehicle.toFixed(4)}/车
                </Text>
              </div>
            </div>
          )}
        </div>
      </Col>
    </>
  );
}
