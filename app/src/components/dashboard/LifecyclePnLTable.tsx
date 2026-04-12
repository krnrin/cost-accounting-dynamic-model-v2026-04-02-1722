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
  return '\u00A5' + (v / 10000).toFixed(1) + '\u4e07';
}
function fmtWanInt(v: number) {
  return '\u00A5' + (v / 10000).toFixed(0) + '\u4e07';
}

export default function LifecyclePnLTable({ lifecyclePnL }: Props) {
  const pnl = lifecyclePnL;
  return (
    <Col span={24}>
      <div className="glass-card db-chart-card">
        <div className="db-section-header">
          <Title heading={5} className="ink-heading">
            \u9879\u76ee\u751f\u547d\u5468\u671f\u635f\u76ca
          </Title>
          <div className="db-pnl-subheader">
            <Text className="db-alloc-footer-text">
              \u5355\u8f66\u6536\u5165 \u00A5{pnl.unitRevenue.toFixed(2)} \u00B7 \u5355\u8f66\u6210\u672c \u00A5{pnl.unitCost.toFixed(2)}
              \u00B7 \u5206\u644a \u00A5{pnl.allocUnit.toFixed(4)}/\u8f66
            </Text>
          </div>
        </div>
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>\u9879\u76ee</th>
                {pnl.rows.map((r) => (
                  <th key={r.year}>\u7b2c{r.year}\u5e74</th>
                ))}
                <th>\u751f\u547d\u5468\u671f\u5408\u8ba1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>\u4ea7\u91cf (\u53f0)</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{r.volume.toLocaleString()}</td>
                ))}
                <td>{pnl.total.volume.toLocaleString()}</td>
              </tr>
              <tr>
                <td>\u603b\u6536\u5165</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{fmtWan(r.revenue)}</td>
                ))}
                <td>{fmtWan(pnl.total.revenue)}</td>
              </tr>
              <tr>
                <td>\u603b\u6210\u672c (\u5185\u90e8\u5b9e\u7ee9)</td>
                {pnl.rows.map((r) => (
                  <td key={r.year}>{fmtWan(r.cost)}</td>
                ))}
                <td>{fmtWan(pnl.total.cost)}</td>
              </tr>
              <tr>
                <td>\u4e00\u6b21\u6027\u8d39\u7528\u5206\u644a</td>
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
                      {r.rebateAmount > 0 ? fmtWanInt(r.rebateAmount) : '\u2014'}
                    </td>
                  ))}
                  <td className="db-cell-rebate db-cell-bold">{fmtWanInt(pnl.total.rebateAmount)}</td>
                </tr>
              )}
              <tr>
                <td>\u6bdb\u5229 (\u6263\u8fd4\u70b9\u524d)</td>
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
                <td>\u51c0\u5229\u6da6</td>
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
                <td>\u51c0\u5229\u6da6\u7387</td>
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
