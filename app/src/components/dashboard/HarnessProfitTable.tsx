/**
 * HarnessProfitTable — Harness-level profit detail with expandable MOH.
 */
import { Typography, Space, Col } from '@douyinfe/semi-ui';
import { IconUpload, IconDownload } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { exportInternalCostExcel } from '@/engine/excel_export';
import type { ProjectHarnessResult, InternalProjectResult } from '@/types/harness';
import type { ProjectRecord } from '@/data/db';
import type { HarnessTableRow } from '@/hooks/useDashboardData';

const { Title, Text } = Typography;

interface Props {
  id: string | undefined;
  sid: string | undefined;
  project: ProjectRecord;
  summary: ProjectHarnessResult | null;
  internalProject: InternalProjectResult | null;
  harnessTableData: HarnessTableRow[];
  showMohDetail: boolean;
  setShowMohDetail: (v: boolean) => void;
  setShowMultiImport: (v: boolean) => void;
  customerVehicleCost: number;
  internalVehicleCost: number;
  allocPerVehicle: number;
}

export default function HarnessProfitTable(props: Props) {
  const {
    id, sid, project, summary, internalProject,
    harnessTableData, showMohDetail, setShowMohDetail,
    setShowMultiImport, customerVehicleCost, internalVehicleCost, allocPerVehicle,
  } = props;
  const navigate = useNavigate();

  return (
    <Col span={24}>
      <div className="glass-card db-chart-card">
        <div className="db-section-header">
          <Title heading={5} className="ink-heading">
            线束利润明细 (内部实绩)
          </Title>
          <Space>
            <div className="db-action-btn" onClick={() => setShowMohDetail(!showMohDetail)}>
              {showMohDetail ? '收起制造费明细 ↑' : '展开制造费明细 ↓'}
            </div>
            <div className="db-action-btn" onClick={() => setShowMultiImport(true)}>
              <IconUpload className="db-action-icon" />批量导入
            </div>
            <div
              className="db-action-btn"
              onClick={() =>
                project &&
                summary &&
                exportInternalCostExcel(
                  summary.harnesses,
                  summary,
                  project.meta?.projectName || 'export',
                )
              }
            >
              <IconDownload className="db-action-icon" />导出 Excel
            </div>
          </Space>
        </div>
        <div className="db-table-wrap">
          <table className="db-harness-table">
            <thead>
              <tr>
                <th>零件号</th>
                <th>名称</th>
                <th>装车比</th>
                <th>到厂价</th>
                <th>材料</th>
                <th>直接人工</th>
                <th onClick={() => setShowMohDetail(!showMohDetail)} style={cursorPointer}>
                  制造费合计 {showMohDetail ? '↑' : '↓'}
                </th>
                {showMohDetail && (
                  <>
                    <th className="db-h-moh">间接人工</th>
                    <th className="db-h-moh">低值易耗</th>
                    <th className="db-h-moh">机物料</th>
                    <th className="db-h-moh">厂房分摊</th>
                    <th className="db-h-moh">自动化分摊</th>
                    <th className="db-h-moh">其他制费</th>
                  </>
                )}
                <th>损耗</th>
                <th>包装运输</th>
                <th>内部成本</th>
                <th>分摊</th>
                <th>净利润</th>
                <th>利润率</th>
                <th>单车贡献</th>
                <th>诊断</th>
              </tr>
            </thead>
            <tbody>
              {harnessTableData.map((row) => {
                const barTotal = row.material + row.directLabor + row.mfgTotal + row.packTotal;
                const matPct = barTotal > 0 ? (row.material / barTotal) * 100 : 0;
                const labPct = barTotal > 0 ? (row.directLabor / barTotal) * 100 : 0;
                const mfgPct = barTotal > 0 ? (row.mfgTotal / barTotal) * 100 : 0;
                const packPct = barTotal > 0 ? (row.packTotal / barTotal) * 100 : 0;
                return (
                  <tr key={row.key}>
                    <td>
                      <a
                        className="db-h-link"
                        onClick={() =>
                          navigate(
                            '/project/' + id + '/s/' + sid + '/harness/' + row.harnessId,
                          )
                        }
                      >
                        {row.harnessId}
                      </a>
                    </td>
                    <td className="db-h-name">{row.name}</td>
                    <td>{(row.ratio * 100).toFixed(1)}%</td>
                    <td>¥{row.delivered.toFixed(2)}</td>
                    <td>¥{row.material.toFixed(2)}</td>
                    <td>¥{row.directLabor.toFixed(2)}</td>
                    <td>¥{row.mfgTotal.toFixed(2)}</td>
                    {showMohDetail && (
                      <>
                        <td className="db-h-moh">¥{row.indirectLabor.toFixed(2)}</td>
                        <td className="db-h-moh">¥{row.lowValue.toFixed(2)}</td>
                        <td className="db-h-moh">¥{row.matConsumption.toFixed(2)}</td>
                        <td className="db-h-moh">¥{row.factoryAmort.toFixed(2)}</td>
                        <td className="db-h-moh">¥{row.autoAmort.toFixed(2)}</td>
                        <td className="db-h-moh">¥{row.otherOH.toFixed(2)}</td>
                      </>
                    )}
                    <td>¥{row.materialWaste.toFixed(2)}</td>
                    <td>¥{row.packTotal.toFixed(2)}</td>
                    <td>
                      <span className="db-cell-bold">¥{row.internalCost.toFixed(2)}</span>
                      <div className="db-cost-bar">
                        <div style={barSegment('#3b82f6', matPct)} />
                        <div style={barSegment('#f59e0b', labPct)} />
                        <div style={barSegment('#10b981', mfgPct)} />
                        <div style={barSegment('#6b7280', packPct)} />
                      </div>
                    </td>
                    <td>¥{row.allocPerUnit.toFixed(2)}</td>
                    <td className={row.netProfit >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                      ¥{row.netProfit.toFixed(2)}
                    </td>
                    <td className={row.margin >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                      {row.margin.toFixed(1)}%
                    </td>
                    <td>¥{row.vehicleContrib.toFixed(2)}</td>
                    <td>
                      <div>
                        {row.tags.map((t) => (
                          <span key={t} className="db-tag-chip">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Summary row */}
              <tr className="db-h-summary-row">
                <td colSpan={3}>单车合计</td>
                <td>¥{customerVehicleCost.toFixed(2)}</td>
                <td>¥{(internalProject?.weightedMaterial || 0).toFixed(2)}</td>
                <td>¥{(internalProject?.weightedDirectLabor || 0).toFixed(2)}</td>
                <td colSpan={showMohDetail ? 7 : 1} />
                <td />
                <td />
                <td className="db-cell-bold">¥{internalVehicleCost.toFixed(2)}</td>
                <td>¥{allocPerVehicle.toFixed(2)}</td>
                <td className={customerVehicleCost - internalVehicleCost - allocPerVehicle >= 0 ? 'db-cell-positive db-cell-bold' : 'db-cell-negative db-cell-bold'}>
                  ¥{(customerVehicleCost - internalVehicleCost - allocPerVehicle).toFixed(2)}
                </td>
                <td className={customerVehicleCost > 0 && (customerVehicleCost - internalVehicleCost - allocPerVehicle) / customerVehicleCost >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                  {(customerVehicleCost > 0
                    ? ((customerVehicleCost - internalVehicleCost - allocPerVehicle) / customerVehicleCost) * 100
                    : 0
                  ).toFixed(1)}%
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Col>
  );
}

/* Utility: build a width+background style object without double-brace JSX */
const cursorPointer = { cursor: 'pointer' } as const;
function barSegment(bg: string, pct: number): React.CSSProperties {
  return { width: pct + '%', background: bg };
}
