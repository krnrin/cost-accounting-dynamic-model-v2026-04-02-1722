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
            \u7ebf\u675f\u5229\u6da6\u660e\u7ec6 (\u5185\u90e8\u5b9e\u7ee9)
          </Title>
          <Space>
            <div className="db-action-btn" onClick={() => setShowMohDetail(!showMohDetail)}>
              {showMohDetail ? '\u6536\u8d77\u5236\u9020\u8d39\u660e\u7ec6 \u2191' : '\u5c55\u5f00\u5236\u9020\u8d39\u660e\u7ec6 \u2193'}
            </div>
            <div className="db-action-btn" onClick={() => setShowMultiImport(true)}>
              <IconUpload className="db-action-icon" />\u6279\u91cf\u5bfc\u5165
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
              <IconDownload className="db-action-icon" />\u5bfc\u51fa Excel
            </div>
          </Space>
        </div>
        <div className="db-table-wrap">
          <table className="db-harness-table">
            <thead>
              <tr>
                <th>\u96f6\u4ef6\u53f7</th>
                <th>\u540d\u79f0</th>
                <th>\u88c5\u8f66\u6bd4</th>
                <th>\u5230\u5382\u4ef7</th>
                <th>\u6750\u6599</th>
                <th>\u76f4\u63a5\u4eba\u5de5</th>
                <th onClick={() => setShowMohDetail(!showMohDetail)} style={cursorPointer}>
                  \u5236\u9020\u8d39\u5408\u8ba1 {showMohDetail ? '\u2191' : '\u2193'}
                </th>
                {showMohDetail && (
                  <>
                    <th className="db-h-moh">\u95f4\u63a5\u4eba\u5de5</th>
                    <th className="db-h-moh">\u4f4e\u503c\u6613\u8017</th>
                    <th className="db-h-moh">\u673a\u7269\u6599</th>
                    <th className="db-h-moh">\u5382\u623f\u5206\u644a</th>
                    <th className="db-h-moh">\u81ea\u52a8\u5316\u5206\u644a</th>
                    <th className="db-h-moh">\u5176\u4ed6\u5236\u8d39</th>
                  </>
                )}
                <th>\u635f\u8017</th>
                <th>\u5305\u88c5\u8fd0\u8f93</th>
                <th>\u5185\u90e8\u6210\u672c</th>
                <th>\u5206\u644a</th>
                <th>\u51c0\u5229\u6da6</th>
                <th>\u5229\u6da6\u7387</th>
                <th>\u5355\u8f66\u8d21\u732e</th>
                <th>\u8bca\u65ad</th>
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
                    <td>\u00A5{row.delivered.toFixed(2)}</td>
                    <td>\u00A5{row.material.toFixed(2)}</td>
                    <td>\u00A5{row.directLabor.toFixed(2)}</td>
                    <td>\u00A5{row.mfgTotal.toFixed(2)}</td>
                    {showMohDetail && (
                      <>
                        <td className="db-h-moh">\u00A5{row.indirectLabor.toFixed(2)}</td>
                        <td className="db-h-moh">\u00A5{row.lowValue.toFixed(2)}</td>
                        <td className="db-h-moh">\u00A5{row.matConsumption.toFixed(2)}</td>
                        <td className="db-h-moh">\u00A5{row.factoryAmort.toFixed(2)}</td>
                        <td className="db-h-moh">\u00A5{row.autoAmort.toFixed(2)}</td>
                        <td className="db-h-moh">\u00A5{row.otherOH.toFixed(2)}</td>
                      </>
                    )}
                    <td>\u00A5{row.materialWaste.toFixed(2)}</td>
                    <td>\u00A5{row.packTotal.toFixed(2)}</td>
                    <td>
                      <span className="db-cell-bold">\u00A5{row.internalCost.toFixed(2)}</span>
                      <div className="db-cost-bar">
                        <div style={barSegment('#3b82f6', matPct)} />
                        <div style={barSegment('#f59e0b', labPct)} />
                        <div style={barSegment('#10b981', mfgPct)} />
                        <div style={barSegment('#6b7280', packPct)} />
                      </div>
                    </td>
                    <td>\u00A5{row.allocPerUnit.toFixed(2)}</td>
                    <td className={row.netProfit >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                      \u00A5{row.netProfit.toFixed(2)}
                    </td>
                    <td className={row.margin >= 0 ? 'db-cell-positive' : 'db-cell-negative'}>
                      {row.margin.toFixed(1)}%
                    </td>
                    <td>\u00A5{row.vehicleContrib.toFixed(2)}</td>
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
                <td colSpan={3}>\u5355\u8f66\u5408\u8ba1</td>
                <td>\u00A5{customerVehicleCost.toFixed(2)}</td>
                <td>\u00A5{(internalProject?.weightedMaterial || 0).toFixed(2)}</td>
                <td>\u00A5{(internalProject?.weightedDirectLabor || 0).toFixed(2)}</td>
                <td colSpan={showMohDetail ? 7 : 1} />
                <td />
                <td />
                <td className="db-cell-bold">\u00A5{internalVehicleCost.toFixed(2)}</td>
                <td>\u00A5{allocPerVehicle.toFixed(2)}</td>
                <td className={customerVehicleCost - internalVehicleCost - allocPerVehicle >= 0 ? 'db-cell-positive db-cell-bold' : 'db-cell-negative db-cell-bold'}>
                  \u00A5{(customerVehicleCost - internalVehicleCost - allocPerVehicle).toFixed(2)}
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
