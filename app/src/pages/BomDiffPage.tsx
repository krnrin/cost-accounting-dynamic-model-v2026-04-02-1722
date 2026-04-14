/**
 * BOM 差异对比页 — 语义化版本
 * 集成 change_pattern_classifier 引擎，展示语义化的设变影响分析
 *
 * 数据流：
 *   Dexie 加载两个场景的 Harness[]
 *   → detectBomChanges()       生成 BomChangeDetectionResult
 *   → classifyChangePatterns() 生成 SemanticChange[]
 *   → 用 PATTERN_DISPLAY        渲染 icon / color / label
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Spin,
  Button,
  Empty,
  Card,
  Select,
  Space,
  Tag,
  Toast,
  Collapse,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconDownload } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import type { BomItem } from '@/types/harness';
import {
  classifyChangePatterns,
  buildClassifyHints,
  PATTERN_DISPLAY,
} from '@/engine/change_pattern_classifier';
import type {
  SemanticChange,
  BomChangeDetectionResult,
  BomRowChange,
  BomRowFieldChange,
  ChangePattern,
} from '@/engine/change_pattern_classifier';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

/* ========== extracted styles (avoid JSX double-brace) ========== */

const S: Record<string, React.CSSProperties> = {
  spin: { display: 'flex', justifyContent: 'center', padding: 60 },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: { margin: 0 },
  flex1: { flex: 1 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 10,
    marginBottom: 16,
  },
  cardBody: { padding: '10px 14px' },
  changeItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 6,
    marginBottom: 6,
    background: 'var(--semi-color-fill-0)',
  },
  changeIcon: { fontSize: 18, flexShrink: 0, lineHeight: '24px' },
  changeBody: { flex: 1, minWidth: 0 },
  block: { display: 'block', marginTop: 4 },
  patternRow: { marginBottom: 12 },
  selectW: { width: 220 },
};

function valStyle(color: string): React.CSSProperties {
  return { margin: 0, color };
}

/* ========== Semi Tag color mapping for PATTERN_DISPLAY hex ========== */

const TAG_COLOR: Record<ChangePattern | string, string> = {
  simple_add: 'green',
  simple_remove: 'red',
  field_modify: 'amber',
  replace: 'purple',
  split: 'orange',
  merge: 'teal',
  qty_change: 'blue',
  qty_explode: 'red',
  wire_spec_replace: 'violet',
  fixed_length: 'cyan',
  segmented_length: 'cyan',
  cross_sheet_inconsistency: 'amber',
  unknown: 'grey',
};

function tagColor(pattern: string): any {
  return TAG_COLOR[pattern] || 'grey';
}

/* ========== helpers ========== */

function getBomItems(harness: HarnessRecord): BomItem[] {
  const input = harness.input as unknown as Record<string, unknown> | null;
  if (!input) return [];
  if (Array.isArray(input.bom)) return input.bom as BomItem[];
  if (Array.isArray(input.bomItems)) return input.bomItems as BomItem[];
  if (Array.isArray(input.items)) return input.items as BomItem[];
  return [];
}

/* ========== BOM row-level diff engine ========== */

function detectBomChanges(
  harnessId: string,
  harnessName: string,
  baseBom: BomItem[],
  currentBom: BomItem[],
): BomChangeDetectionResult {
  const baseByPart = new Map<string, BomItem & { _idx: number }>();
  baseBom.forEach((item, i) => {
    if (item.partNo) baseByPart.set(item.partNo, Object.assign({}, item, { _idx: i }));
  });

  const curByPart = new Map<string, BomItem & { _idx: number }>();
  currentBom.forEach((item, i) => {
    if (item.partNo) curByPart.set(item.partNo, Object.assign({}, item, { _idx: i }));
  });

  const changes: BomRowChange[] = [];
  const allPartNos = new Set([...baseByPart.keys(), ...curByPart.keys()]);
  const COMPARE_FIELDS = ['qty', 'unitPrice', 'partName', 'unit', 'supplier', 'endGroup', 'amount'];

  allPartNos.forEach((partNo) => {
    const base = baseByPart.get(partNo);
    const cur = curByPart.get(partNo);

    if (!base && cur) {
      changes.push({
        changeType: 'added',
        partNo,
        partName: cur.partName || '',
        rowIndex: cur._idx,
        fieldChanges: [],
      });
      return;
    }

    if (base && !cur) {
      changes.push({
        changeType: 'removed',
        partNo,
        partName: base.partName || '',
        rowIndex: base._idx,
        fieldChanges: [],
      });
      return;
    }

    if (base && cur) {
      const fc: BomRowFieldChange[] = [];
      COMPARE_FIELDS.forEach((field) => {
        const bv = (base as unknown as Record<string, unknown>)[field];
        const cv = (cur as unknown as Record<string, unknown>)[field];
        if (String(bv ?? '') !== String(cv ?? '')) {
          fc.push({ field, before: (bv as any) ?? null, after: (cv as any) ?? null });
        }
      });
      if (fc.length > 0) {
        changes.push({
          changeType: 'modified',
          partNo,
          partName: cur.partName || base.partName || '',
          rowIndex: cur._idx,
          fieldChanges: fc,
        });
      }
    }
  });

  const groups = new Set<string>();
  changes.forEach((c) => {
    const item = curByPart.get(c.partNo) || baseByPart.get(c.partNo);
    if (item?.endGroup) groups.add(item.endGroup);
  });

  const added = changes.filter((c) => c.changeType === 'added').length;
  const removed = changes.filter((c) => c.changeType === 'removed').length;
  const modified = changes.filter((c) => c.changeType === 'modified').length;

  return {
    harnessId,
    harnessName,
    sheetName: 'BOM',
    hasChanges: changes.length > 0,
    changes,
    summary: added + ' 新增, ' + removed + ' 删除, ' + modified + ' 修改',
    affectedEndGroups: Array.from(groups),
    detectedAt: new Date().toISOString(),
  };
}

/* ========== per-harness result type ========== */

interface HarnessDiff {
  harnessId: string;
  harnessName: string;
  detection: BomChangeDetectionResult;
  semanticChanges: SemanticChange[];
  baseBomCount: number;
  currentBomCount: number;
}

/* ========== CSV export ========== */

function exportCsv(results: HarnessDiff[], projectName: string) {
  const hdr = [
    '线束号',
    '线束名',
    '变更模式',
    '描述',
    '置信度',
    '涉及零件号',
    '字段变化',
  ];
  const body: string[] = [];

  results.forEach((r) => {
    r.semanticChanges.forEach((sc) => {
      const d = PATTERN_DISPLAY[sc.pattern] || PATTERN_DISPLAY.unknown;
      const parts = sc.relatedChanges.map((c) => c.partNo).join('; ');
      const fields = sc.relatedChanges
        .flatMap((c) =>
          c.fieldChanges.map(
            (f) => f.field + ': ' + String(f.before ?? '') + ' → ' + String(f.after ?? ''),
          ),
        )
        .join('; ');
      body.push(
        [
          r.harnessId,
          r.harnessName,
          d.label,
          sc.description.replace(/,/g, '，'),
          (sc.confidence * 100).toFixed(0) + '%',
          parts,
          fields,
        ].join(','),
      );
    });
  });

  const csv = [hdr.join(','), ...body].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    'BOM_SemanticDiff_' + projectName + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ========== sub-components ========== */

function ConfBadge(props: { value: number }) {
  const v = props.value;
  const pct = (v * 100).toFixed(0) + '%';
  if (v >= 0.9) return <Tag size="small" color="green">{pct} 高</Tag>;
  if (v >= 0.7) return <Tag size="small" color="orange">{pct} 中</Tag>;
  return <Tag size="small" color="grey">{pct} 低</Tag>;
}

function PatternDistribution(props: { changes: SemanticChange[] }) {
  const dist = useMemo(() => {
    const map = new Map<ChangePattern, number>();
    props.changes.forEach((sc) => {
      map.set(sc.pattern, (map.get(sc.pattern) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [props.changes]);

  return (
    <Space wrap style={S.patternRow}>
      {dist.map(([pattern, count]) => {
        const d = PATTERN_DISPLAY[pattern] || PATTERN_DISPLAY.unknown;
        return (
          <Tag key={pattern} color={tagColor(pattern)} size="large">
            {d.icon} {d.label} ×{count}
          </Tag>
        );
      })}
    </Space>
  );
}

function SemanticChangeCard(props: { sc: SemanticChange }) {
  const sc = props.sc;
  const d = PATTERN_DISPLAY[sc.pattern] || PATTERN_DISPLAY.unknown;

  return (
    <div style={S.changeItem}>
      <span style={S.changeIcon}>{d.icon}</span>
      <div style={S.changeBody}>
        <Space>
          <Tag size="small" color={tagColor(sc.pattern)}>
            {d.label}
          </Tag>
          <ConfBadge value={sc.confidence} />
        </Space>
        <Text size="small" style={S.block}>
          {sc.description}
        </Text>
        {sc.relatedChanges.length > 0 && (
          <Text type="tertiary" size="small" style={S.block}>
            {'涉及: '}
            {sc.relatedChanges.map((c) => c.partNo).join(', ')}
            {sc.relatedChanges.some((c) => c.fieldChanges.length > 0) &&
              ' · ' +
                sc.relatedChanges
                  .flatMap((c) => c.fieldChanges)
                  .slice(0, 3)
                  .map(
                    (f) =>
                      f.field +
                      ': ' +
                      String(f.before ?? '∅') +
                      ' → ' +
                      String(f.after ?? '∅'),
                  )
                  .join('; ')}
          </Text>
        )}
        {sc.supplierCheck && !sc.supplierCheck.allInheritedOrUnknown && (
          <Tag size="small" color="red" style={S.block}>
            ⚠️ 供应商不一致
          </Tag>
        )}
        {sc.metadata && typeof sc.metadata === 'object' && 'type' in sc.metadata && (
          <Text type="tertiary" size="small" style={S.block}>
            {'类型: ' + String(sc.metadata.type)}
            {sc.metadata.beforeLength ? (' | 原: ' + String(sc.metadata.beforeLength)) : null}
            {sc.metadata.afterLength ? (' → ' + String(sc.metadata.afterLength)) : null}
          </Text>
        )}
      </div>
    </div>
  );
}

/* ========== main component ========== */

export default function BomDiffPage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [results, setResults] = useState<HarnessDiff[]>([]);

  /* ---- load project & scenario list ---- */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const proj = await db.projects.get(projectId);
      setProjectName(proj?.meta?.projectName || proj?.meta?.projectCode || '');
      const all = await db.scenarios.where('projectId').equals(projectId).toArray();
      setScenarios(all.filter((s) => s.id !== sid));
      const baseline = all.find((s) => s.isBaseline && s.id !== sid);
      if (baseline && !baseId) setBaseId(baseline.id!);
    })();
  }, [projectId, sid]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- compute semantic diff ---- */
  const computeDiff = useCallback(async () => {
    if (!sid || !baseId) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [currentHarnesses, baseHarnesses] = await Promise.all([
        db.harnesses.where('scenarioId').equals(sid).toArray(),
        db.harnesses.where('scenarioId').equals(baseId).toArray(),
      ]);

      const baseMap = new Map<string, HarnessRecord>();
      baseHarnesses.forEach((h) => baseMap.set(h.harnessId, h));

      const diffs: HarnessDiff[] = [];
      const processedIds = new Set<string>();

      // Process current harnesses (new + modified)
      for (const curH of currentHarnesses) {
        processedIds.add(curH.harnessId);
        const baseH = baseMap.get(curH.harnessId);
        const curBom = getBomItems(curH);
        const baseBom = baseH ? getBomItems(baseH) : [];

        if (curBom.length === 0 && baseBom.length === 0) continue;

        const detection = detectBomChanges(
          curH.harnessId,
          curH.harnessName || curH.harnessId,
          baseBom,
          curBom,
        );

        if (!detection.hasChanges) continue;

        // Build hints from the UNION of both BOMs for best classification
        const allItems = [...baseBom, ...curBom];
        const seen = new Set<string>();
        const uniqueItems = allItems.filter((item) => {
          if (!item.partNo || seen.has(item.partNo)) return false;
          seen.add(item.partNo);
          return true;
        });
        const hints = buildClassifyHints(uniqueItems);
        const semanticChanges = classifyChangePatterns(detection, hints);

        diffs.push({
          harnessId: curH.harnessId,
          harnessName: curH.harnessName || curH.harnessId,
          detection,
          semanticChanges,
          baseBomCount: baseBom.length,
          currentBomCount: curBom.length,
        });
      }

      // Process base-only harnesses (entirely removed)
      for (const baseH of baseHarnesses) {
        if (processedIds.has(baseH.harnessId)) continue;
        const baseBom = getBomItems(baseH);
        if (baseBom.length === 0) continue;

        const detection = detectBomChanges(
          baseH.harnessId,
          baseH.harnessName || baseH.harnessId,
          baseBom,
          [],
        );
        const hints = buildClassifyHints(baseBom);
        const semanticChanges = classifyChangePatterns(detection, hints);

        diffs.push({
          harnessId: baseH.harnessId,
          harnessName: baseH.harnessName || baseH.harnessId,
          detection,
          semanticChanges,
          baseBomCount: baseBom.length,
          currentBomCount: 0,
        });
      }

      diffs.sort((a, b) => b.semanticChanges.length - a.semanticChanges.length);
      setResults(diffs);
    } catch (err) {
      console.error('Semantic BOM diff failed:', err);
      Toast.error('BOM 语义差异分析失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [sid, baseId]);

  useEffect(() => {
    computeDiff();
  }, [computeDiff]);

  /* ---- aggregate stats ---- */
  const allChanges = useMemo(
    () => results.flatMap((r) => r.semanticChanges),
    [results],
  );

  const stats = useMemo(() => {
    let totalConf = 0;
    const patternCounts = new Map<string, number>();
    allChanges.forEach((sc) => {
      patternCounts.set(sc.pattern, (patternCounts.get(sc.pattern) || 0) + 1);
      totalConf += sc.confidence;
    });
    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return {
      total: allChanges.length,
      harnesses: results.length,
      avgConf: allChanges.length > 0 ? totalConf / allChanges.length : 0,
      topPatterns,
    };
  }, [allChanges, results]);

  const confColor =
    stats.avgConf >= 0.9
      ? 'var(--semi-color-success)'
      : stats.avgConf >= 0.7
        ? 'var(--semi-color-warning)'
        : 'var(--semi-color-danger)';

  /* ---- render ---- */
  return (
    <div className="page-container">
      <ScenarioSelector />

      {/* Header */}
      <div style={S.header}>
        <Button
          icon={<IconArrowLeft />}
          theme="borderless"
          onClick={() => navigate(-1)}
        />
        <div style={S.flex1}>
          <Title heading={4} style={S.title}>
            BOM 语义差异分析
          </Title>
          <Text type="secondary">
            {projectName} — 基于 change_pattern_classifier 引擎
          </Text>
        </div>
        <Space>
          <Select
            placeholder="选择基线场景"
            value={baseId || undefined}
            onChange={(v) => setBaseId(v as string)}
            style={S.selectW}
            showClear
            optionList={scenarios.map((s) => ({
              label: s.scenarioName + (s.isBaseline ? ' (基准)' : ''),
              value: s.id!,
            }))}
          />
          <Button
            icon={<IconDownload />}
            theme="light"
            disabled={results.length === 0}
            onClick={() => {
              exportCsv(results, projectName);
              Toast.success('语义差异报告已导出');
            }}
          >
            导出
          </Button>
        </Space>
      </div>

      {/* Content */}
      {!baseId ? (
        <Empty
          title="请选择基线场景"
          description="选择基线后自动执行语义化 BOM 差异分析"
        />
      ) : loading ? (
        <Spin size="large" style={S.spin} />
      ) : results.length === 0 ? (
        <Empty description="两个场景之间无 BOM 差异" />
      ) : (
        <>
          {/* Summary Cards */}
          <div style={S.grid}>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                语义变更
              </Text>
              <Title heading={3} style={S.title}>
                {stats.total}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                受影响线束
              </Text>
              <Title heading={3} style={S.title}>
                {stats.harnesses}
              </Title>
            </Card>
            <Card bodyStyle={S.cardBody}>
              <Text type="secondary" size="small">
                平均置信度
              </Text>
              <Title heading={3} style={valStyle(confColor)}>
                {(stats.avgConf * 100).toFixed(0)}%
              </Title>
            </Card>
            {stats.topPatterns.map(([pattern, count]) => {
              const d =
                PATTERN_DISPLAY[pattern as ChangePattern] ||
                PATTERN_DISPLAY.unknown;
              return (
                <Card key={pattern} bodyStyle={S.cardBody}>
                  <Text type="secondary" size="small">
                    {d.icon} {d.label}
                  </Text>
                  <Title heading={3} style={valStyle(d.color)}>
                    {count}
                  </Title>
                </Card>
              );
            })}
          </div>

          {/* Pattern Distribution Tags */}
          <PatternDistribution changes={allChanges} />

          {/* Per-harness Semantic Changes */}
          <Collapse keepDOM={false}>
            {results.map((r) => (
              <Collapse.Panel
                key={r.harnessId}
                header={
                  <Space>
                    <Text strong>{r.harnessId}</Text>
                    <Text type="secondary">{r.harnessName}</Text>
                    <Tag size="small" color="blue">
                      {r.semanticChanges.length} 个变更
                    </Tag>
                    <Text type="tertiary" size="small">
                      BOM: {r.baseBomCount} → {r.currentBomCount}
                    </Text>
                    {r.detection.affectedEndGroups.length > 0 && (
                      <Text type="tertiary" size="small">
                        端组: {r.detection.affectedEndGroups.join(', ')}
                      </Text>
                    )}
                  </Space>
                }
                itemKey={r.harnessId}
              >
                {r.semanticChanges.map((sc, idx) => (
                  <SemanticChangeCard key={idx} sc={sc} />
                ))}
              </Collapse.Panel>
            ))}
          </Collapse>
        </>
      )}
    </div>
  );
}
