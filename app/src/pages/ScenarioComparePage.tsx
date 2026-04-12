/**
 * 场景对比页 — 并排对比 2~4 个场景的 KPI
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Button, Card, Tag, Space } from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord, HarnessRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { apiClient } from '@/lib/apiClient';

const { Title, Text } = Typography;

interface ScenarioData {
  scenario: ScenarioRecord;
  harnesses: HarnessRecord[];
  vehicleCost: number;
  materialCost: number;
  totalVolume: number;
}

interface ServerScenarioSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  lifecycleYears: number;
  volume: number;
  installRatio: number;
  rateSnapshot: Record<string, any>;
  rateSnapshotVersion: string | null;
  bomVersionRef?: string | null;
  sourceScenarioId?: string | null;
  compareBaselineId?: string | null;
}

type ServerStatus = 'idle' | 'loading' | 'success' | 'fallback';

export default function ScenarioComparePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenarioData, setScenarioData] = useState<ScenarioData[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const scenarioIds = useMemo(() => (searchParams.get('ids') || '').split(',').filter(Boolean), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      setServerStatus('loading');
      setServerError(null);

      const ids = scenarioIds;
      if (ids.length === 0) {
        setServerStatus('fallback');
      } else {
        try {
          const data = await apiClient<ServerScenarioSummary[]>(`/scenarios/compare?ids=${ids.join(',')}`);
          if (!cancelled) {
            setServerStatus(data.length > 0 ? 'success' : 'fallback');
          }
        } catch (error: any) {
          if (!cancelled) {
            setServerStatus('fallback');
            setServerError(error instanceof Error ? error.message : '服务器对比失败');
          }
        }
      }

      try {
        const p = await db.projects.get(id);
        if (!p) return;
        if (!cancelled) setProject(p);

        const data: ScenarioData[] = [];
        for (const sid of ids) {
          const scenario = await db.scenarios.get(sid);
          if (!scenario) continue;
          const harnesses = await db.harnesses.where('scenarioId').equals(sid).toArray();
          const results = harnesses.map(h =>
            computeHarnessCost(h.input, scenario.config.costRates, scenario.config.metalPrices)
          );
          const proj = computeProjectFromHarnesses(results);
          data.push({
            scenario,
            harnesses,
            vehicleCost: proj.vehicleCost,
            materialCost: proj.weightedMaterial,
            totalVolume: scenario.config.volumes.reduce((s, v) => s + v.volume, 0),
          });
        }
        if (!cancelled) setScenarioData(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, scenarioIds]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!project) return <div>项目不存在</div>;
  if (scenarioData.length === 0) return <div>请选择至少一个场景进行对比</div>;

  const baseline = scenarioData.find(d => d.scenario.isBaseline) ?? scenarioData[0];
  const formatCurrency = (v: number) => `¥${v.toFixed(2)}`;
  const formatDelta = (v: number) => {
    const color = v > 0 ? 'var(--semi-color-danger)' : v < 0 ? 'var(--semi-color-success)' : 'inherit';
    const prefix = v > 0 ? '+' : '';
    return <span style={{ color }}>{prefix}{v.toFixed(2)}</span>;
  };

  const kpiRows = [
    { label: '生命周期(年)', getValue: (d: ScenarioData) => d.scenario.lifecycleYears },
    { label: '总销量', getValue: (d: ScenarioData) => d.totalVolume.toLocaleString() },
    { label: '铜价(元/吨)', getValue: (d: ScenarioData) => d.scenario.config.metalPrices.copper.toLocaleString() },
    { label: '铝价(元/吨)', getValue: (d: ScenarioData) => d.scenario.config.metalPrices.aluminum.toLocaleString() },
    { label: '单车材料成本', getValue: (d: ScenarioData) => formatCurrency(d.materialCost) },
    { label: '单车到厂价', getValue: (d: ScenarioData) => formatCurrency(d.vehicleCost) },
    { label: '线束数量', getValue: (d: ScenarioData) => d.harnesses.length },
  ];

  return (
    <div className="page-container">
      {serverStatus === 'fallback' && scenarioIds.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
          服务器对比数据暂不可用，已回退本地缓存{serverError ? `：${serverError}` : '。'}
        </Text>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px 0' }}>
        <Button icon={<IconArrowLeft />} aria-label="返回" theme="borderless" onClick={() => navigate(`/project/${id}`)} />
        <div>
          <Title heading={4} style={{ margin: 0 }}>场景对比</Title>
          <Text style={{ color: 'var(--semi-color-text-2)' }}>{project.meta.projectName}</Text>
        </div>
      </div>

      <Card className="glass-card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--semi-color-border)' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', width: 160 }}>指标</th>
              {scenarioData.map(d => (
                <th key={d.scenario.id} style={{ textAlign: 'center', padding: '12px 16px' }}>
                  <Space vertical spacing={4}>
                    <Text strong>{d.scenario.scenarioName}</Text>
                    {d.scenario.isBaseline && <Tag color="blue" size="small">基准</Tag>}
                  </Space>
                </th>
              ))}
              {scenarioData.length > 1 && <th style={{ textAlign: 'center', padding: '12px 16px' }}>差异(vs基准)</th>}
            </tr>
          </thead>
          <tbody>
            {kpiRows.map(row => (
              <tr key={row.label} style={{ borderBottom: '1px solid var(--semi-color-border)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--semi-color-text-2)' }}>{row.label}</td>
                {scenarioData.map(d => (
                  <td key={d.scenario.id} style={{ textAlign: 'center', padding: '10px 16px' }}>{row.getValue(d)}</td>
                ))}
                {scenarioData.length > 1 && (
                  <td style={{ textAlign: 'center', padding: '10px 16px' }}>
                    {row.label === '单车到厂价' ? formatDelta(scenarioData[scenarioData.length - 1]!.vehicleCost - baseline!.vehicleCost) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
