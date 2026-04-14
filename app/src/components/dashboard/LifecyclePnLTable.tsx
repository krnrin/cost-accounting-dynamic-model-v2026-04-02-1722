/**
 * LifecyclePnLTable — Project lifecycle profit & loss.
 */
import { Typography, Col } from '@douyinfe/semi-ui';
import type { LifecyclePnLData } from '@/hooks/useDashboardData';

const { Title, Text } = Typography;

interface Props {
  lifecyclePnL: LifecyclePnLData;
}

function fmtWan(v: number) {
  return '¥' + (v / 10000).toFixed(1) + '万';
}
function fmtWanInt(v: number) {
  return '¥' + (v / 10000).toFixed(0) + '万';
}

export default function LifecyclePnLTable({ lifecyclePnL }: Props) {
  const pnl = lifecyclePnL;
  return (
    <Col span={24}>
      <div className="glass-card db-chart-card">
        <div className="db-section-header">
          <Title heading={5} className="ink-heading">
            项目生命周期损益
          </Title>
          <div className="db-pnl-subheader">
            <Text className="db-alloc-footer-text">
              单车收入 ¥{pnl.unitRevenue.toFixed(2)} · 单车成本 ¥{pnl.unitCost.toFixed(2)}
              · 分摊 ¥{pnl.allocUnit.toFixed(4)}/车
            </Text>
          </div>
        </div>
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>项目</th>
                {pnl.rows.map((r) => (
                  <th key={r.year}>第{r.year}年</th>
                ))}
                <th>生命周期合计</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>产量 (台)</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{r.volume.toLocaleString()}</td>
                ))}
                <td>{pnl.total.volume.toLocaleString()}</td>
              </tr>
              <tr>
                <td>总收入</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{fmtWan(r.revenue)}</td>
                ))}
                <td>{fmtWan(pnl.total.revenue)}</td>
              </tr>
              <tr>
                <td>总成本 (内部实绩)</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{fmtWan(r.cost)}</td>
                ))}
                <td>{fmtWan(pnl.total.cost)}</td>
              </tr>
              <tr>
                <td>一次性费用分摊</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{fmtWan(r.allocRecovery)}</td>
                ))}
                <td>{fmtWan(pnl.total.allocRecovery)}</td>
              </tr>
              {pnl.hasRebate && (
                <tr className="db-row-highlight">
                  <td className="db-cell-rebate">{pnl.rebateLabel}</td>
                  {pnl.rows.map((r) => (
                    <td key={r.year} className="db-cell-rebate">
                      {r.rebateAmount > 0 ? fmtWanInt(r.rebateAmount) : '—'}
                    </td>
                  ))}
                  <td className="db-cell-rebate db-cell-bold">{fmtWanInt(pnl.total.rebateAmount)}</td>
                </tr>
              )}
              <tr>
                <td>毛利 (扣返点前)</td>
                {pnl.rows.map((r) => (
                  <td key={r.year} className={r.grossProfit >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                    {fmtWan(r.grossProfit)}
                  </td>
                ))}
                <td className={pnl.total.grossProfit >= 0 ? 'db-cell-positive db-cell-bold' : 'db-cell-negative db-cell-bold'}>
                  {fmtWan(pnl.total.grossProfit)}
                </td>
              </tr>
              <tr className="db-row-total">
                <td>净利润</td>
                {pnl.rows.map((r) => (
                  <td key={r.year} className={r.netProfit >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                    {fmtWan(r.netProfit)}
                  </td>
                ))}
                <td className={pnl.total.netProfit >= 0 ? 'db-cell-positive db-cell-bold' : 'db-cell-negative db-cell-bold'}>
                  {fmtWan(pnl.total.netProfit)}
                </td>
              </tr>
              <tr>
                <td>净利润率</td>
                {pnl.rows.map((r) => (
                  <td key={r.year} className={r.netMargin >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                    {r.netMargin.toFixed(1)}%
                  </td>
                ))}
                <td className={pnl.total.netMargin >= 0 ? 'db-cell-positive db-cell-bold' : 'db-cell-negative db-cell-bold'}>
                  {pnl.total.netMargin.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Col>
  );
}
