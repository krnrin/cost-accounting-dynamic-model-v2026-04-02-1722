/**
 * BOM 差异对比页 — 增强版
 * 对比当前场景与选定基线场景的线束成本差异
 * 支持：基线场景选择、成本差异统计卡片、排序/筛选、CSV 导出
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Spin, Button, Table, Empty, Card, Select, Space, Tag, Toast,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload, IconRefresh } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessInput, HarnessResult } from '@/engine/harness_costing';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

/* ── extracted styles (avoids JSX double-brace inline objects) ── */
const S: Record<string, React.CSSProperties> = {
  spin: { display: 'flex', justifyContent: 'center', padding: 60 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { margin: 0 },
  flex1: { flex: 1 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  cardBody: { padding: '12px 16px' },
};

function cardValueStyle(color: string): React.CSSProperties {
  return { margin: 0, color };
}

/* ── types ── */
interface DiffRow {
  harnessId: string;
  harnessName: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  baseMaterial: number;
  currentMaterial: number;
  baseTotal: number;
  currentTotal: number;
  delta: number;
  deltaPct: number;
}

/* ── helpers ── */
function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtCurrency(v: number): string {
  return '¥' + v.toFixed(2);
}

function buildDiffRows(
  baseMap: Map<string, { name: string; result: HarnessResult }>,
  currentMap: Map<string, { name: string; result: HarnessResult }>,
): DiffRow[] {
  const allIds = new Set([...baseMap.keys(), ...currentMap.keys()]);
  const rows: DiffRow[] = [];

  allIds.forEach((id) => {
    const base = baseMap.get(id);
    const cur = currentMap.get(id);
    const baseMat = safeNum(base?.result?.materialCost);
    const curMat = safeNum(cur?.result?.materialCost);
    const baseTotal = safeNum(
      base?.result?.deliveredPrice ?? base?.result?.exFactoryPrice,
    );
    const curTotal = safeNum(
      cur?.result?.deliveredPrice ?? cur?.result?.exFactoryPrice,
    );
    const delta = curTotal - baseTotal;
    const deltaPct =
      baseTotal !== 0
        ? (delta / baseTotal) * 100
        : curTotal !== 0
          ? 100
          : 0;

    let changeType: DiffRow['changeType'] = 'unchanged';
    if (!base) changeType = 'added';
    else if (!cur) changeType = 'removed';
    else if (Math.abs(delta) > 0.005) changeType = 'modified';

    rows.push({
      harnessId: id,
      harnessName: cur?.name || base?.name || id,
      changeType,
      baseMaterial: baseMat,
      currentMaterial: curMat,
      baseTotal,
      currentTotal: curTotal,
      delta,
      deltaPct,
    });
  });

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function exportCsv(rows: DiffRow[], projectName: string) {
  const hdr = [
    '线束号', '线束名称', '变更类型',
    '基线材料', '当前材料', '基线总价', '当前总价', '差异', '差异%',
  ];
  const body = rows.map((r) =>
    [
      r.harnessId,
      r.harnessName,
      r.changeType === 'added'
        ? '新增'
        : r.changeType === 'removed'
          ? '移除'
          : r.changeType === 'modified'
            ? '变更'
            : '无变化',
      r.baseMaterial.toFixed(2),
      r.currentMaterial.toFixed(2),
      r.baseTotal.toFixed(2),
      r.currentTotal.toFixed(2),
      r.delta.toFixed(2),
      r.deltaPct.toFixed(1) + '%',
    ].join(','),
  );
  const csv = [hdr.join(','), ...body].join('\n');
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    'BOM_Diff_' +
    projectName +
    '_' +
    new Date().toISOString().slice(0, 10) +
    '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ── component ── */
export default function BomDiffPage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [currentResults, setCurrentResults] = useState<
    Map<string, { name: string; result: HarnessResult }>
  >(new Map());
  const [baseResults, setBaseResults] = useState<
    Map<string, { name: string; result: HarnessResult }>
  >(new Map());

  /* load project & scenario list */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const proj = await db.projects.get(projectId);
      setProjectName(
        proj?.meta?.projectName || proj?.meta?.projectCode || '',
      );
      const all = await db.scenarios
        .where('projectId')
        .equals(projectId)
        .toArray();
      setScenarios(all.filter((s) => s.id !== sid));
      // auto-select baseline if available
      const baseline = all.find((s) => s.isBaseline && s.id !== sid);
      if (baseline && !baseId) setBaseId(baseline.id!);
    })();
  }, [projectId, sid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* compute harness results for one scenario */
  const computeResults = useCallback(
    async (scenarioId: string) => {
      const scenario = await db.scenarios.get(scenarioId);
      if (!scenario) return new Map();
      const harnesses = await db.harnesses
        .where('scenarioId')
        .equals(scenarioId)
        .toArray();
      const map = new Map<
        string,
        { name: string; result: HarnessResult }
      >();
      harnesses.forEach((h) => {
        try {
          const result = computeHarnessCost(
            h.input as HarnessInput,
            scenario.config?.costRates || {},
            scenario.config?.metalPrices || {},
          );
          map.set(h.harnessId, {
            name: h.harnessName || h.harnessId,
            result,
          });
        } catch {
          // skip harnesses that fail to compute
        }
      });
      return map;
    },
    [],
  );

  /* load current scenario */
  useEffect(() => {
    if (!sid) return;
    (async () => {
      setLoading(true);
      try {
        setCurrentResults(await computeResults(sid));
      } finally {
        setLoading(false);
      }
    })();
  }, [sid, computeResults]);

  /* load base scenario when selected */
  useEffect(() => {
    if (!baseId) {
      setBaseResults(new Map());
      return;
    }
    (async () => {
      setLoading(true);
      try {
        setBaseResults(await computeResults(baseId));
      } finally {
        setLoading(false);
      }
    })();
  }, [baseId, computeResults]);

  const diffRows = useMemo(
    () => buildDiffRows(baseResults, currentResults),
    [baseResults, currentResults],
  );

  const summary = useMemo(() => {
    let added = 0;
    let removed = 0;
    let modified = 0;
    let totalDelta = 0;
    let baseSum = 0;
    let curSum = 0;
    diffRows.forEach((r) => {
      if (r.changeType === 'added') added++;
      else if (r.changeType === 'removed') removed++;
      else if (r.changeType === 'modified') modified++;
      totalDelta += r.delta;
      baseSum += r.baseTotal;
      curSum += r.currentTotal;
    });
    return { added, removed, modified, totalDelta, baseSum, curSum };
  }, [diffRows]);

  const changeTagMap: Record<
    string,
    { color: string; label: string }
  > = {
    added: { color: 'green', label: '新增' },
    removed: { color: 'red', label: '移除' },
    modified: { color: 'orange', label: '变更' },
    unchanged: { color: 'grey', label: '无变化' },
  };

  const columns = [
    {
      title: '变更',
      dataIndex: 'changeType',
      width: 80,
      render: (v: string) => {
        const t = changeTagMap[v] || changeTagMap.unchanged;
        return (
          <Tag color={t.color as any} size="small">
            {t.label}
          </Tag>
        );
      },
      filters: Object.entries(changeTagMap).map(([k, v]) => ({
        text: v.label,
        value: k,
      })),
      onFilter: (value: string, record: DiffRow) =>
        record.changeType === value,
    },
    { title: '线束号', dataIndex: 'harnessId', width: 120 },
    {
      title: '线束名称',
      dataIndex: 'harnessName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '基线材料',
      dataIndex: 'baseMaterial',
      width: 100,
      render: (v: number) => fmtCurrency(v),
    },
    {
      title: '当前材料',
      dataIndex: 'currentMaterial',
      width: 100,
      render: (v: number) => fmtCurrency(v),
    },
    {
      title: '基线总价',
      dataIndex: 'baseTotal',
      width: 100,
      render: (v: number) => fmtCurrency(v),
    },
    {
      title: '当前总价',
      dataIndex: 'currentTotal',
      width: 100,
      render: (v: number) => fmtCurrency(v),
    },
    {
      title: '差异',
      dataIndex: 'delta',
      width: 100,
      render: (v: number) => {
        const color =
          v > 0
            ? 'var(--semi-color-danger)'
            : v < 0
              ? 'var(--semi-color-success)'
              : 'inherit';
        const prefix = v > 0 ? '+' : '';
        return (
          <Text style={cardValueStyle(color)}>
            {prefix}
            {fmtCurrency(v)}
          </Text>
        );
      },
      sorter: (a: DiffRow, b: DiffRow) => a.delta - b.delta,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '差异%',
      dataIndex: 'deltaPct',
      width: 80,
      render: (v: number) => {
        const color =
          v > 0
            ? 'var(--semi-color-danger)'
            : v < 0
              ? 'var(--semi-color-success)'
              : 'inherit';
        return (
          <Text style={cardValueStyle(color)}>
            {v > 0 ? '+' : ''}
            {v.toFixed(1)}%
          </Text>
        );
      },
      sorter: (a: DiffRow, b: DiffRow) => a.deltaPct - b.deltaPct,
    },
  ];

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
            BOM 差异对比
          </Title>
          <Text type="secondary">{projectName}</Text>
        </div>
        <Space>
          <Select
            placeholder="选择基线场景"
            value={baseId || undefined}
            onChange={(v) => setBaseId(v as string)}
            style={S.selectWidth}
            showClear
            optionList={scenarios.map((s) => ({
              label:
                s.scenarioName + (s.isBaseline ? ' (基准)' : ''),
              value: s.id!,
            }))}
          />
          <Button
            icon={<IconDownload />}
            theme="light"
            disabled={diffRows.length === 0}
            onClick={() => {
              exportCsv(diffRows, projectName);
              Toast.success('已导出 CSV');
            }}
          >
            导出
          </Button>
        </Space>
      </div>

      {!baseId ? (
        <Empty
          title="请选择基线场景"
          description="选择一个基线场景以对比 BOM 差异"
        />
      ) : loading ? (
        <Spin size="large" style={S.spin} />
      ) : diffRows.length === 0 ? (
        <Empty description="两个场景之间无差异" />
      ) : (
        <>
          {/* Summary Cards */}
          <div style={S.grid}>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                新增线束
              </Text>
              <Title
                heading={3}
                style={cardValueStyle(
                  'var(--semi-color-success)',
                )}
              >
                {summary.added}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                移除线束
              </Text>
              <Title
                heading={3}
                style={cardValueStyle(
                  'var(--semi-color-danger)',
                )}
              >
                {summary.removed}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                变更线束
              </Text>
              <Title
                heading={3}
                style={cardValueStyle(
                  'var(--semi-color-warning)',
                )}
              >
                {summary.modified}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                基线总成本
              </Text>
              <Title heading={4} style={S.title}>
                {fmtCurrency(summary.baseSum)}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                当前总成本
              </Text>
              <Title heading={4} style={S.title}>
                {fmtCurrency(summary.curSum)}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                总差异
              </Text>
              <Title
                heading={3}
                style={cardValueStyle(
                  summary.totalDelta > 0
                    ? 'var(--semi-color-danger)'
                    : 'var(--semi-color-success)',
                )}
              >
                {summary.totalDelta > 0 ? '+' : ''}
                {fmtCurrency(summary.totalDelta)}
              </Title>
            </Card>
          </div>

          {/* Diff Table */}
          <Table
            rowKey="harnessId"
            columns={columns}
            dataSource={diffRows}
            pagination={
              diffRows.length > 50 ? { pageSize: 50 } : false
            }
            scroll={scrollX}
            size="small"
          />
        </>
      )}
    </div>
  );
}

/* avoid inline object in JSX */
const scrollX = { x: 1100 };
