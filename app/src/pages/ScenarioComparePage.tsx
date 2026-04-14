/**
 * 场景对比页 — 增强版
 * 并排对比 2~4 个场景的成本 KPI，全维度差异分析 + 线束级明细
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Spin,
  Button,
  Card,
  Tag,
  Space,
  Table,
  Empty,
  Checkbox,
  Select,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconPlus } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessInput, HarnessResult } from '@/engine/harness_costing';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

/* ── extracted styles ── */
const S: Record<string, React.CSSProperties> = {
  spin: { display: 'flex', justifyContent: 'center', padding: 60 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { margin: 0 },
  flex1: { flex: 1 },
  sectionTitle: { margin: '24px 0 12px' },
  chipRow: { marginBottom: 16 },
  tagMl: { marginLeft: 4 },
  toggleRow: { marginTop: 24 },
};

/* ── helpers ── */
function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtCny(v: number): string {
  return '¥' + v.toFixed(2);
}

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function deltaStyle(v: number): React.CSSProperties {
  const color =
    v > 0
      ? 'var(--semi-color-danger)'
      : v < 0
        ? 'var(--semi-color-success)'
        : 'inherit';
  return { color, fontWeight: 600 };
}

/* ── KPI definitions ── */
const KPI_KEYS = [
  { key: 'vehicleCost', label: '整车成本', unit: 'cny' },
  { key: 'materialCost', label: '材料成本', unit: 'cny' },
  { key: 'directLabor', label: '直接人工', unit: 'cny' },
  { key: 'manufacturingOverhead', label: '制造费用', unit: 'cny' },
  { key: 'processingCost', label: '加工费', unit: 'cny' },
  { key: 'packagingCost', label: '包装运输', unit: 'cny' },
  { key: 'exFactoryPrice', label: '出厂价', unit: 'cny' },
  { key: 'deliveredPrice', label: '含税交付价', unit: 'cny' },
  { key: 'profitAmount', label: '利润额', unit: 'cny' },
  { key: 'profitRate', label: '利润率', unit: 'pct' },
  { key: 'harnessCount', label: '线束数量', unit: 'count' },
  { key: 'bomItemCount', label: 'BOM 零件数', unit: 'count' },
] as const;

interface ScenarioBundle {
  scenario: ScenarioRecord;
  harnesses: HarnessRecord[];
  results: HarnessResult[];
  kpi: Record<string, number>;
}

function buildKpi(
  results: HarnessResult[],
  harnesses: HarnessRecord[],
): Record<string, number> {
  let totalVehicle = 0;
  let totalMaterial = 0;
  let totalLabor = 0;
  let totalMfg = 0;
  let totalProc = 0;
  let totalPkg = 0;
  let totalExFactory = 0;
  let totalDelivered = 0;
  let totalProfit = 0;

  results.forEach((r) => {
    totalVehicle += safeNum(r.vehicleCost);
    totalMaterial += safeNum(r.materialCost);
    totalLabor += safeNum(r.directLabor);
    totalMfg += safeNum(r.manufacturingOverhead);
    totalProc += safeNum(r.processingCost);
    totalPkg += safeNum(r.packagingCost);
    totalExFactory += safeNum(r.exFactoryPrice);
    totalDelivered += safeNum(r.deliveredPrice);
    totalProfit += safeNum(r.profitAmount);
  });

  return {
    vehicleCost: totalVehicle,
    materialCost: totalMaterial,
    directLabor: totalLabor,
    manufacturingOverhead: totalMfg,
    processingCost: totalProc,
    packagingCost: totalPkg,
    exFactoryPrice: totalExFactory,
    deliveredPrice: totalDelivered,
    profitAmount: totalProfit,
    profitRate:
      totalExFactory !== 0
        ? (totalProfit / totalExFactory) * 100
        : 0,
    harnessCount: harnesses.length,
    bomItemCount: harnesses.reduce(
      (acc, h) => acc + ((h.input as any)?.bom?.length || 0),
      0,
    ),
  };
}

/* ── component ── */
export default function ScenarioComparePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [allScenarios, setAllScenarios] = useState<ScenarioRecord[]>(
    [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bundles, setBundles] = useState<ScenarioBundle[]>([]);
  const [showHarnessDetail, setShowHarnessDetail] = useState(false);

  /* load all scenarios for project */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const all = await db.scenarios
        .where('projectId')
        .equals(projectId)
        .toArray();
      setAllScenarios(all);
      if (selectedIds.length === 0 && all.length >= 2) {
        const baseline = all.find((s) => s.isBaseline);
        const others = all.filter((s) => !s.isBaseline);
        if (baseline && others.length > 0) {
          setSelectedIds([baseline.id!, others[0].id!]);
        } else {
          setSelectedIds(all.slice(0, 2).map((s) => s.id!));
        }
      }
    })();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* compute bundles for selected scenarios */
  useEffect(() => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    (async () => {
      try {
        const result: ScenarioBundle[] = [];
        for (const sId of selectedIds) {
          const scenario = await db.scenarios.get(sId);
          if (!scenario) continue;
          const harnesses = await db.harnesses
            .where('scenarioId')
            .equals(sId)
            .toArray();
          const results: HarnessResult[] = [];
          harnesses.forEach((h) => {
            try {
              results.push(
                computeHarnessCost(
                  h.input as HarnessInput,
                  scenario.config?.costRates || {},
                  scenario.config?.metalPrices || {},
                ),
              );
            } catch {
              /* skip */
            }
          });
          result.push({
            scenario,
            harnesses,
            results,
            kpi: buildKpi(results, harnesses),
          });
        }
        setBundles(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIds]);

  /* ── KPI comparison table columns ── */
  const kpiColumns = useMemo(() => {
    const cols: any[] = [
      {
        title: '指标',
        dataIndex: 'label',
        width: 140,
        fixed: 'left' as const,
      },
    ];
    bundles.forEach((b, i) => {
      const isBase = i === 0;
      cols.push({
        title: (
          <span>
            {b.scenario.scenarioName}
            {b.scenario.isBaseline && (
              <Tag size="small" color="blue" style={S.tagMl}>
                基准
              </Tag>
            )}
            {isBase && (
              <Tag size="small" color="green" style={S.tagMl}>
                基线
              </Tag>
            )}
          </span>
        ),
        dataIndex: 'v' + i,
        width: 140,
      });
      if (!isBase) {
        const baseName =
          bundles[0]?.scenario.scenarioName || '基线';
        cols.push({
          title: 'Δ vs ' + baseName,
          dataIndex: 'd' + i,
          width: 150,
          render: (v: string, row: any) => {
            const dn = row['dn' + i];
            if (row.unit === 'count') return v || '-';
            return <span style={deltaStyle(dn)}>{v}</span>;
          },
        });
      }
    });
    return cols;
  }, [bundles]);

  /* ── KPI comparison table data ── */
  const kpiData = useMemo(() => {
    return KPI_KEYS.map((k) => {
      const row: any = { key: k.key, label: k.label, unit: k.unit };
      bundles.forEach((b, i) => {
        const val = safeNum(b.kpi[k.key]);
        if (k.unit === 'pct') {
          row['v' + i] = val.toFixed(1) + '%';
        } else if (k.unit === 'count') {
          row['v' + i] = String(val);
        } else {
          row['v' + i] = fmtCny(val);
        }

        if (i > 0) {
          const baseVal = safeNum(bundles[0]?.kpi[k.key]);
          const delta = val - baseVal;
          row['dn' + i] = delta;
          if (k.unit === 'pct') {
            row['d' + i] =
              (delta >= 0 ? '+' : '') +
              delta.toFixed(1) +
              'pp';
          } else if (k.unit === 'count') {
            row['d' + i] =
              (delta >= 0 ? '+' : '') + String(delta);
          } else {
            const pctDelta =
              baseVal !== 0 ? (delta / baseVal) * 100 : 0;
            row['d' + i] =
              (delta >= 0 ? '+' : '') +
              fmtCny(delta) +
              ' (' +
              fmtPct(pctDelta) +
              ')';
          }
        }
      });
      return row;
    });
  }, [bundles]);

  /* ── per-harness breakdown columns ── */
  const harnessColumns = useMemo(() => {
    const cols: any[] = [
      {
        title: '线束号',
        dataIndex: 'harnessId',
        width: 120,
        fixed: 'left' as const,
      },
      {
        title: '线束名',
        dataIndex: 'harnessName',
        width: 140,
        ellipsis: true,
      },
    ];
    bundles.forEach((b, i) => {
      cols.push({
        title: b.scenario.scenarioName + ' 总价',
        dataIndex: 'total' + i,
        width: 120,
        render: (v: number | null) =>
          v != null ? fmtCny(v) : '-',
      });
      if (i > 0) {
        cols.push({
          title: 'Δ',
          dataIndex: 'delta' + i,
          width: 110,
          render: (v: number | null) => {
            if (v == null) return '-';
            return (
              <span style={deltaStyle(v)}>
                {v >= 0 ? '+' : ''}
                {fmtCny(v)}
              </span>
            );
          },
          sorter: (a: any, b: any) =>
            (a['delta' + i] || 0) - (b['delta' + i] || 0),
        });
      }
    });
    return cols;
  }, [bundles]);

  /* ── per-harness breakdown data ── */
  const harnessData = useMemo(() => {
    const allIds = new Set<string>();
    const maps: Map<
      string,
      { name: string; total: number }
    >[] = bundles.map((b) => {
      const m = new Map<
        string,
        { name: string; total: number }
      >();
      b.harnesses.forEach((h, idx) => {
        const r = b.results[idx];
        const total = safeNum(
          r?.deliveredPrice ?? r?.exFactoryPrice,
        );
        m.set(h.harnessId, {
          name: h.harnessName || h.harnessId,
          total,
        });
        allIds.add(h.harnessId);
      });
      return m;
    });

    return Array.from(allIds).map((hId) => {
      const firstName =
        maps[0]?.get(hId)?.name ||
        maps.find((m) => m.has(hId))?.get(hId)?.name ||
        hId;
      const row: any = { harnessId: hId, harnessName: firstName };
      maps.forEach((m, i) => {
        const entry = m.get(hId);
        row['total' + i] = entry?.total ?? null;
        if (i > 0) {
          const base = maps[0]?.get(hId)?.total;
          row['delta' + i] =
            base != null && entry?.total != null
              ? entry.total - base
              : null;
        }
      });
      return row;
    });
  }, [bundles]);

  const availableToAdd = allScenarios.filter(
    (s) => !selectedIds.includes(s.id!),
  );

  const kpiScrollX = { x: 700 };
  const harnessScrollX = { x: 800 };

  return (
    <div className="page-container">
      <ScenarioSelector />
      <div style={S.header}>
        <Button
          icon={<IconArrowLeft />}
          theme="borderless"
          onClick={() => navigate(-1)}
        />
        <div style={S.flex1}>
          <Title heading={4} style={S.title}>
            场景对比分析
          </Title>
          <Text type="secondary">
            已选 {selectedIds.length} 个场景
            {bundles.length > 0 &&
              ' · 基线: ' + bundles[0]?.scenario.scenarioName}
          </Text>
        </div>
        <Space>
          {availableToAdd.length > 0 &&
            selectedIds.length < 4 && (
              <Select
                placeholder="添加场景…"
                value={undefined}
                onChange={(v) => {
                  if (v)
                    setSelectedIds([...selectedIds, v as string]);
                }}
                optionList={availableToAdd.map((s) => ({
                  label: s.scenarioName,
                  value: s.id!,
                }))}
              />
            )}
        </Space>
      </div>

      {/* Scenario chips */}
      <Space style={S.chipRow} wrap>
        {bundles.map((b, i) => (
          <Tag
            key={b.scenario.id}
            size="large"
            color={i === 0 ? 'blue' : 'cyan'}
            closable={selectedIds.length > 2}
            onClose={() =>
              setSelectedIds(
                selectedIds.filter((id) => id !== b.scenario.id),
              )
            }
          >
            {b.scenario.scenarioName}
            {b.scenario.isBaseline ? ' (基准)' : ''}
          </Tag>
        ))}
      </Space>

      {loading ? (
        <Spin size="large" style={S.spin} />
      ) : bundles.length < 2 ? (
        <Empty
          title="至少选择 2 个场景"
          description="请添加场景进行对比分析"
        />
      ) : (
        <>
          {/* KPI Comparison Table */}
          <Title heading={5} style={S.sectionTitle}>
            KPI 指标对比
          </Title>
          <Table
            rowKey="key"
            columns={kpiColumns}
            dataSource={kpiData}
            pagination={false}
            scroll={kpiScrollX}
            size="small"
          />

          {/* Toggle harness detail */}
          <div style={S.toggleRow}>
            <Checkbox
              checked={showHarnessDetail}
              onChange={(e) =>
                setShowHarnessDetail(e.target.checked)
              }
            >
              显示线束级明细
            </Checkbox>
          </div>

          {showHarnessDetail && (
            <>
              <Title heading={5} style={S.sectionTitle}>
                线束级对比
              </Title>
              <Table
                rowKey="harnessId"
                columns={harnessColumns}
                dataSource={harnessData}
                pagination={
                  harnessData.length > 30
                    ? { pageSize: 30 }
                    : false
                }
                scroll={harnessScrollX}
                size="small"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
