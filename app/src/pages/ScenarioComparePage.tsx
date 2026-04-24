import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { db, type HarnessRecord, type ScenarioRecord } from '@/data/db';
import { requireScenarioConfig } from '@/data/scenarioGuards';
import ScenarioSelector from '@/components/ScenarioSelector';
import {
  applyInstallationRatiosToHarnessRecords,
  resolveScenarioVehicleConfigs,
} from '@/engine/configuration_model';
import { computeChangePricing } from '@/engine/change_pricing';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import {
  deepCompareScenarios,
  type ComparisonDimension,
  type ScenarioCompareInput,
} from '@/engine/scenario_deep_compare';
import {
  buildDecisionSummary,
  type CostFactor,
} from '@/engine/shapley_attribution';
import type { HarnessResult, ProjectHarnessResult } from '@/types/harness';
import type { VersionRecord } from '@/types/version';

const { Title, Text } = Typography;

interface ScenarioLoadError {
  scenarioId: string;
  scenarioName: string;
  message: string;
}

interface ScenarioBundle {
  scenario: ScenarioRecord;
  latestVersion: VersionRecord | null;
  harnesses: HarnessRecord[];
  results: HarnessResult[];
  projectResult: ProjectHarnessResult;
  compareInput: ScenarioCompareInput;
}

interface DimensionTableRow {
  key: string;
  label: string;
  category: ComparisonDimension['category'];
  baseValue: number | string | null;
  compareValue: number | string | null;
  delta: number | null;
  deltaPercent: number | null;
}

interface HarnessImpactRow {
  harnessId: string;
  harnessName: string;
  reason: string;
  baselineContribution: number;
  compareContribution: number;
  deltaContribution: number;
  ratioDelta: number;
}

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return `¥${value.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatValue(key: string, value: number | string | null): string {
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  if (key === 'marginRate' || key === 'recoveryRate') return `${value.toFixed(2)}%`;
  if (key === 'remainingMonths' || key === 'totalHarnesses') return value.toFixed(0);
  return formatCurrency(value);
}

function formatDelta(key: string, delta: number | null, deltaPercent: number | null): string {
  if (delta == null) return '-';
  if (key === 'marginRate' || key === 'recoveryRate') {
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} pp`;
  }
  if (key === 'remainingMonths' || key === 'totalHarnesses') {
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`;
  }
  const percent = deltaPercent == null ? '' : ` (${formatPercent(deltaPercent)})`;
  return `${delta >= 0 ? '+' : ''}${formatCurrency(delta)}${percent}`;
}

function buildCostBreakdown(projectResult: ProjectHarnessResult): ScenarioCompareInput['costBreakdown'] {
  return {
    materialCost: projectResult.weightedMaterial,
    laborCost: projectResult.weightedLabor,
    overheadCost: projectResult.weightedMfg,
    packagingCost: projectResult.weightedPack + projectResult.weightedFreight,
    managementFee: projectResult.weightedMgmtFee,
    scrapCost: projectResult.weightedWaste,
    metalCost: projectResult.weightedCopperWeight + projectResult.weightedAluminumWeight,
    nreCostPerSet: 0,
  };
}

function buildScenarioCompareInput(
  scenario: ScenarioRecord,
  latestVersion: VersionRecord | null,
  projectResult: ProjectHarnessResult,
): ScenarioCompareInput {
  const totalVolume = safeNumber(scenario.config?.volumes?.reduce((sum, item) => sum + safeNumber(item.volume), 0));
  const vehicleCost = projectResult.vehicleCost;
  const weightedProfit = projectResult.weightedProfit;
  const impliedPrice = vehicleCost > 0 ? vehicleCost : projectResult.weightedExFactory;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.scenarioName,
    status: scenario.status || scenario.scenarioType,
    versionRef: latestVersion ? latestVersion.label : undefined,
    bomVersionRef: latestVersion ? `v${latestVersion.versionNumber}` : undefined,
    kpis: {
      totalCostPerSet: vehicleCost,
      sellingPricePerSet: impliedPrice,
      marginRate: impliedPrice > 0 ? (weightedProfit / impliedPrice) * 100 : 0,
      lifecycleProfit: weightedProfit * totalVolume,
      vehicleCostPerSet: vehicleCost,
      totalHarnesses: projectResult.harnessCount,
    },
    costBreakdown: buildCostBreakdown(projectResult),
  };
}

function buildComparisonFactors(
  base: ProjectHarnessResult,
  compare: ProjectHarnessResult,
): CostFactor[] {
  return [
    {
      id: 'material',
      name: '材料成本',
      category: 'material',
      baseValue: base.weightedMaterial,
      currentValue: compare.weightedMaterial,
      delta: compare.weightedMaterial - base.weightedMaterial,
      deltaPercent: base.weightedMaterial === 0 ? 0 : ((compare.weightedMaterial - base.weightedMaterial) / Math.abs(base.weightedMaterial)) * 100,
    },
    {
      id: 'labor',
      name: '人工成本',
      category: 'labor',
      baseValue: base.weightedLabor,
      currentValue: compare.weightedLabor,
      delta: compare.weightedLabor - base.weightedLabor,
      deltaPercent: base.weightedLabor === 0 ? 0 : ((compare.weightedLabor - base.weightedLabor) / Math.abs(base.weightedLabor)) * 100,
    },
    {
      id: 'overhead',
      name: '制造费用',
      category: 'overhead',
      baseValue: base.weightedMfg,
      currentValue: compare.weightedMfg,
      delta: compare.weightedMfg - base.weightedMfg,
      deltaPercent: base.weightedMfg === 0 ? 0 : ((compare.weightedMfg - base.weightedMfg) / Math.abs(base.weightedMfg)) * 100,
    },
    {
      id: 'packaging',
      name: '包装物流',
      category: 'packaging',
      baseValue: base.weightedPack + base.weightedFreight,
      currentValue: compare.weightedPack + compare.weightedFreight,
      delta: (compare.weightedPack + compare.weightedFreight) - (base.weightedPack + base.weightedFreight),
      deltaPercent: (base.weightedPack + base.weightedFreight) === 0 ? 0 : (((compare.weightedPack + compare.weightedFreight) - (base.weightedPack + base.weightedFreight)) / Math.abs(base.weightedPack + base.weightedFreight)) * 100,
    },
    {
      id: 'management',
      name: '管理费',
      category: 'management',
      baseValue: base.weightedMgmtFee,
      currentValue: compare.weightedMgmtFee,
      delta: compare.weightedMgmtFee - base.weightedMgmtFee,
      deltaPercent: base.weightedMgmtFee === 0 ? 0 : ((compare.weightedMgmtFee - base.weightedMgmtFee) / Math.abs(base.weightedMgmtFee)) * 100,
    },
    {
      id: 'scrap',
      name: '废品成本',
      category: 'scrap',
      baseValue: base.weightedWaste,
      currentValue: compare.weightedWaste,
      delta: compare.weightedWaste - base.weightedWaste,
      deltaPercent: base.weightedWaste === 0 ? 0 : ((compare.weightedWaste - base.weightedWaste) / Math.abs(base.weightedWaste)) * 100,
    },
    {
      id: 'metal',
      name: '金属重量',
      category: 'metal',
      baseValue: base.weightedCopperWeight + base.weightedAluminumWeight,
      currentValue: compare.weightedCopperWeight + compare.weightedAluminumWeight,
      delta: (compare.weightedCopperWeight + compare.weightedAluminumWeight) - (base.weightedCopperWeight + base.weightedAluminumWeight),
      deltaPercent: (base.weightedCopperWeight + base.weightedAluminumWeight) === 0 ? 0 : (((compare.weightedCopperWeight + compare.weightedAluminumWeight) - (base.weightedCopperWeight + base.weightedAluminumWeight)) / Math.abs(base.weightedCopperWeight + base.weightedAluminumWeight)) * 100,
    },
  ];
}

function describeDetailedType(value: string): string {
  if (value.includes('config_ratio')) return '配置/装车比变化';
  if (value.includes('material')) return 'BOM/材料变化';
  if (value.includes('hours')) return '工时变化';
  if (value.includes('packaging')) return '包装物流变化';
  if (value === 'add') return '新增线束';
  if (value === 'remove') return '取消线束';
  return '综合变化';
}

function buildReasonSummary(
  changePricingResult: ReturnType<typeof computeChangePricing>,
  insightTitles: string[],
): string[] {
  const topHarnessReasons = [...changePricingResult.changes]
    .sort((left, right) => Math.abs((right.weightedDeltaPrice ?? right.delta.deliveredPrice)) - Math.abs((left.weightedDeltaPrice ?? left.delta.deliveredPrice)))
    .slice(0, 3)
    .map((item) => {
      const delta = item.weightedDeltaPrice ?? item.delta.deliveredPrice;
      const direction = delta >= 0 ? '上升' : '下降';
      return `${item.harnessName || item.harnessId} 单车贡献${direction} ${formatCurrency(Math.abs(delta))}，主因：${describeDetailedType(item.detailedType)}`;
    });

  return [...insightTitles.slice(0, 3), ...topHarnessReasons];
}

export default function ScenarioComparePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [allScenarios, setAllScenarios] = useState<ScenarioRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bundles, setBundles] = useState<ScenarioBundle[]>([]);
  const [loadErrors, setLoadErrors] = useState<ScenarioLoadError[]>([]);
  const [showHarnessDetail, setShowHarnessDetail] = useState(false);
  const [focusCompareId, setFocusCompareId] = useState<string | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const scenarios = await db.scenarios.where('projectId').equals(projectId).toArray();
      scenarios.sort((left, right) => left.scenarioCode.localeCompare(right.scenarioCode));
      setAllScenarios(scenarios);
      if (selectedIds.length === 0 && scenarios.length >= 2) {
        const baseline = scenarios.find((item) => item.isBaseline) ?? scenarios[0] ?? null;
        const firstCompare = scenarios.find((item) => item.id !== baseline?.id) ?? null;
        if (baseline && firstCompare) {
          setSelectedIds([baseline.id, firstCompare.id]);
        }
      }
    })();
  }, [projectId, selectedIds.length]);

  useEffect(() => {
    if (!projectId || selectedIds.length === 0) return;
    setLoading(true);
    void (async () => {
      const nextBundles: ScenarioBundle[] = [];
      const nextErrors: ScenarioLoadError[] = [];

      for (const scenarioId of selectedIds) {
        const scenario = await db.scenarios.get(scenarioId);
        if (!scenario) {
          nextErrors.push({
            scenarioId,
            scenarioName: scenarioId,
            message: '场景不存在，无法纳入比较。',
          });
          continue;
        }

        try {
          const config = requireScenarioConfig(scenario, 'ScenarioComparePage');
          const harnesses = await db.harnesses.where('scenarioId').equals(scenarioId).toArray();
          const versions = await db.versions.where('scenarioId').equals(scenarioId).toArray();
          versions.sort((left, right) => right.versionNumber - left.versionNumber);
          const latestVersion = versions[0] ?? null;
          const vehicleConfigs = resolveScenarioVehicleConfigs({
            vehicleConfigs: scenario.vehicleConfigs,
            configSkus: scenario.configSkus,
            harnessConfigMappings: scenario.harnessConfigMappings,
          });
          const normalizedHarnesses = applyInstallationRatiosToHarnessRecords(
            harnesses,
            vehicleConfigs,
            scenario.harnessConfigMappings ?? [],
          );

          const scenarioErrors: string[] = [];
          const results: HarnessResult[] = [];
          for (const harness of normalizedHarnesses) {
            try {
              results.push(computeHarnessCost(harness.input, config.costRates, config.metalPrices));
            } catch (error) {
              scenarioErrors.push(
                `${harness.harnessId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          if (scenarioErrors.length > 0) {
            throw new Error(
              `场景 ${scenario.scenarioName} 存在 ${scenarioErrors.length} 条线束计算失败：${scenarioErrors.slice(0, 3).join('；')}`,
            );
          }

          const projectResult = computeProjectFromHarnesses(results);
          nextBundles.push({
            scenario,
            latestVersion,
            harnesses: normalizedHarnesses,
            results,
            projectResult,
            compareInput: buildScenarioCompareInput(scenario, latestVersion, projectResult),
          });
        } catch (error) {
          nextErrors.push({
            scenarioId: scenario.id,
            scenarioName: scenario.scenarioName,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      setBundles(nextBundles);
      setLoadErrors(nextErrors);
      setLoading(false);
    })();
  }, [projectId, selectedIds]);

  useEffect(() => {
    if (bundles.length < 2) {
      setFocusCompareId(null);
      return;
    }
    const nextDefault = bundles[1]?.scenario.id ?? null;
    setFocusCompareId((current) => {
      if (current && bundles.some((item) => item.scenario.id === current && item.scenario.id !== bundles[0]?.scenario.id)) {
        return current;
      }
      return nextDefault;
    });
  }, [bundles]);

  const baselineBundle = bundles[0] ?? null;
  const compareCandidates = useMemo(
    () => bundles.slice(1),
    [bundles],
  );
  const focusBundle = useMemo(
    () => compareCandidates.find((item) => item.scenario.id === focusCompareId) ?? compareCandidates[0] ?? null,
    [compareCandidates, focusCompareId],
  );

  const deepCompareResult = useMemo(
    () => (bundles.length >= 2 ? deepCompareScenarios(bundles.map((item) => item.compareInput)) : null),
    [bundles],
  );

  const changePricingResult = useMemo(() => {
    if (!baselineBundle || !focusBundle) return null;
    return computeChangePricing(
      baselineBundle.projectResult,
      focusBundle.projectResult,
        'scenario_compare',
        {
          annualVolumes: focusBundle.scenario.config?.volumes?.map((item) => safeNumber(item.volume)) ?? [],
          lifecycleYears: focusBundle.scenario.lifecycleYears,
        },
      );
  }, [baselineBundle, focusBundle]);

  const decisionSummary = useMemo(() => {
    if (!baselineBundle || !focusBundle) return null;
    return buildDecisionSummary(
      buildComparisonFactors(baselineBundle.projectResult, focusBundle.projectResult),
    );
  }, [baselineBundle, focusBundle]);

  const reasonSummary = useMemo(() => {
    if (!changePricingResult || !decisionSummary) return [];
    return buildReasonSummary(
      changePricingResult,
      decisionSummary.insights.map((item) => `${item.title}: ${item.description}`),
    );
  }, [changePricingResult, decisionSummary]);

  const dimensionRows = useMemo<DimensionTableRow[]>(() => {
    if (!deepCompareResult || !baselineBundle || !focusBundle) return [];
    return deepCompareResult.dimensions
      .map((dimension) => {
        const baseValue = dimension.values.find((item) => item.scenarioId === baselineBundle.scenario.id)?.value ?? null;
        const compareValue = dimension.values.find((item) => item.scenarioId === focusBundle.scenario.id)?.value ?? null;
        const deltaRecord = dimension.deltas.find((item) => item.toId === focusBundle.scenario.id) ?? null;
        return {
          key: dimension.key,
          label: dimension.label,
          category: dimension.category,
          baseValue,
          compareValue,
          delta: deltaRecord?.delta ?? null,
          deltaPercent: deltaRecord?.deltaPercent ?? null,
        };
      })
      .filter((row) => !onlyDifferences || (row.delta != null && Math.abs(row.delta) > 0.0001));
  }, [baselineBundle, compareCandidates.length, deepCompareResult, focusBundle, onlyDifferences]);

  const harnessImpactRows = useMemo<HarnessImpactRow[]>(() => {
    if (!changePricingResult) return [];
    return [...changePricingResult.changes]
      .map((item) => ({
        harnessId: item.harnessId,
        harnessName: item.harnessName,
        reason: describeDetailedType(item.detailedType),
        baselineContribution: item.beforeWeightedPrice ?? safeNumber(item.before?.deliveredPrice),
        compareContribution: item.afterWeightedPrice ?? safeNumber(item.after?.deliveredPrice),
        deltaContribution: item.weightedDeltaPrice ?? item.delta.deliveredPrice,
        ratioDelta: item.installationRatioDelta ?? item.ratioDelta ?? 0,
      }))
      .sort((left, right) => Math.abs(right.deltaContribution) - Math.abs(left.deltaContribution));
  }, [changePricingResult]);

  const scenarioChips = useMemo(
    () => bundles.map((item, index) => ({
      id: item.scenario.id,
      label: item.scenario.scenarioName,
      color: (index === 0 ? 'blue' : item.scenario.id === focusBundle?.scenario.id ? 'green' : 'cyan') as 'blue' | 'green' | 'cyan',
    })),
    [bundles, focusBundle?.scenario.id],
  );

  const availableToAdd = useMemo(
    () => allScenarios.filter((item) => !selectedIds.includes(item.id)),
    [allScenarios, selectedIds],
  );

  const comparisonSummary = useMemo(() => {
    if (!baselineBundle || !focusBundle || !changePricingResult) return null;
    const baseProfit = baselineBundle.projectResult.weightedProfit;
    const compareProfit = focusBundle.projectResult.weightedProfit;
    return {
      totalDelta: changePricingResult.summary.totalDelta,
      deltaPercent: changePricingResult.summary.deltaPercent,
      affectedCount: changePricingResult.summary.affectedCount,
      profitDelta: compareProfit - baseProfit,
    };
  }, [baselineBundle, changePricingResult, focusBundle]);

  return (
    <div className="page-container" data-testid="scenario-compare-page">
      <ScenarioSelector />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate(-1)} />
        <div style={{ flex: 1 }}>
          <Title heading={4} style={{ margin: 0 }}>
            场景对比分析
          </Title>
          <Text type="secondary">
            统一按场景配置模型、安装比例和线束加权贡献进行对比，不再静默跳过失败线束。
          </Text>
        </div>
        <Space>
          {availableToAdd.length > 0 && selectedIds.length < 4 ? (
            <Select
              placeholder="添加场景"
              value={undefined}
              optionList={availableToAdd.map((item) => ({ label: item.scenarioName, value: item.id }))}
              onChange={(value) => {
                if (value) setSelectedIds((current) => [...current, value as string]);
              }}
            />
          ) : null}
        </Space>
      </div>

      {loadErrors.length > 0 ? (
        <Banner
          type="warning"
          style={{ marginBottom: 16 }}
          description={loadErrors.map((item) => `${item.scenarioName}: ${item.message}`).join(' | ')}
        />
      ) : null}

      <Space wrap style={{ marginBottom: 16 }}>
        {scenarioChips.map((item) => (
          <Tag
            key={item.id}
            color={item.color}
            size="large"
            closable={selectedIds.length > 2}
            onClose={() => setSelectedIds((current) => current.filter((scenarioId) => scenarioId !== item.id))}
          >
            {item.label}
          </Tag>
        ))}
      </Space>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : bundles.length < 2 || !baselineBundle || !focusBundle ? (
        <Empty
          title="至少需要两个可计算场景"
          description="请先补齐场景配置、BOM 和线束数据，或移除当前无法计算的场景。"
        />
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Tag color="blue">基准场景：{baselineBundle.scenario.scenarioName}</Tag>
                <Select
                  value={focusBundle.scenario.id}
                  style={{ minWidth: 260 }}
                  optionList={compareCandidates.map((item) => ({
                    value: item.scenario.id,
                    label: item.scenario.scenarioName,
                  }))}
                  onChange={(value) => setFocusCompareId((value as string) || null)}
                />
              </Space>
              <Checkbox checked={onlyDifferences} onChange={(event) => setOnlyDifferences(Boolean(event.target.checked))}>
                仅显示有差异项
              </Checkbox>
            </Space>
          </Card>

          {comparisonSummary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
              <Card bodyStyle={{ padding: 16 }}>
                <Text type="tertiary">单车成本变化</Text>
                <Title heading={4}>{formatCurrency(comparisonSummary.totalDelta)}</Title>
              </Card>
              <Card bodyStyle={{ padding: 16 }}>
                <Text type="tertiary">变化比例</Text>
                <Title heading={4}>{formatPercent(comparisonSummary.deltaPercent)}</Title>
              </Card>
              <Card bodyStyle={{ padding: 16 }}>
                <Text type="tertiary">利润变化</Text>
                <Title heading={4}>{formatCurrency(comparisonSummary.profitDelta)}</Title>
              </Card>
              <Card bodyStyle={{ padding: 16 }}>
                <Text type="tertiary">受影响线束</Text>
                <Title heading={4}>{comparisonSummary.affectedCount}</Title>
              </Card>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card title="多维度差异" headerLine={false}>
              <Table
                rowKey="key"
                pagination={false}
                dataSource={dimensionRows}
                columns={[
                  { title: '维度', dataIndex: 'label', key: 'label', width: 180 },
                  { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (value: string) => <Tag>{value}</Tag> },
                  {
                    title: baselineBundle.scenario.scenarioName,
                    dataIndex: 'baseValue',
                    key: 'baseValue',
                    render: (_value: unknown, record: DimensionTableRow) => formatValue(record.key, record.baseValue),
                  },
                  {
                    title: focusBundle.scenario.scenarioName,
                    dataIndex: 'compareValue',
                    key: 'compareValue',
                    render: (_value: unknown, record: DimensionTableRow) => formatValue(record.key, record.compareValue),
                  },
                  {
                    title: '差异',
                    dataIndex: 'delta',
                    key: 'delta',
                    render: (_value: unknown, record: DimensionTableRow) => (
                      <span style={{ color: (record.delta ?? 0) > 0 ? 'var(--semi-color-danger)' : (record.delta ?? 0) < 0 ? 'var(--semi-color-success)' : 'inherit', fontWeight: 600 }}>
                        {formatDelta(record.key, record.delta, record.deltaPercent)}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>

            <Card title="变化原因摘要" headerLine={false}>
              <Space vertical align="start" style={{ width: '100%' }}>
                {reasonSummary.length === 0 ? (
                  <Text type="tertiary">当前没有可展示的原因摘要。</Text>
                ) : (
                  reasonSummary.map((item) => (
                    <div key={item} style={{ paddingBottom: 8, borderBottom: '1px solid var(--semi-color-border)' }}>
                      <Text>{item}</Text>
                    </div>
                  ))
                )}
              </Space>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card title="主驱动因子" headerLine={false}>
              <Table
                rowKey="factorId"
                pagination={false}
                dataSource={decisionSummary?.shapleyResults ?? []}
                columns={[
                  { title: '因子', dataIndex: 'factorName', key: 'factorName' },
                  { title: '分类', dataIndex: 'category', key: 'category', render: (value: string) => <Tag>{value}</Tag> },
                  { title: '贡献值', dataIndex: 'contribution', key: 'contribution', align: 'right', render: (value: number) => formatCurrency(value) },
                  { title: '贡献率', dataIndex: 'contributionRate', key: 'contributionRate', align: 'right', render: (value: number) => formatPercent(value) },
                ]}
              />
            </Card>

            <Card title="管理建议" headerLine={false}>
              <Space vertical align="start" style={{ width: '100%' }}>
                {decisionSummary?.insights?.length ? (
                  decisionSummary.insights.map((item) => (
                    <Card key={item.title} bodyStyle={{ padding: 12 }} style={{ width: '100%' }}>
                      <Space vertical align="start" style={{ width: '100%' }}>
                        <Tag color={item.type === 'risk' ? 'red' : item.type === 'opportunity' ? 'green' : item.type === 'action' ? 'orange' : 'grey'}>
                          {item.type}
                        </Tag>
                        <Text strong>{item.title}</Text>
                        <Text type="secondary">{item.description}</Text>
                        <Text size="small" type="tertiary">{item.suggestedAction}</Text>
                      </Space>
                    </Card>
                  ))
                ) : (
                  <Text type="tertiary">暂无管理建议。</Text>
                )}
              </Space>
            </Card>
          </div>

          <Card title="线束级贡献变化" headerLine={false}>
            <Table
              rowKey="harnessId"
              dataSource={showHarnessDetail ? harnessImpactRows : harnessImpactRows.slice(0, 10)}
              pagination={false}
              columns={[
                { title: '线束号', dataIndex: 'harnessId', key: 'harnessId', width: 140 },
                { title: '线束名称', dataIndex: 'harnessName', key: 'harnessName', width: 180 },
                { title: '变化原因', dataIndex: 'reason', key: 'reason', width: 150 },
                { title: '基准贡献', dataIndex: 'baselineContribution', key: 'baselineContribution', align: 'right', render: (value: number) => formatCurrency(value) },
                { title: '对比贡献', dataIndex: 'compareContribution', key: 'compareContribution', align: 'right', render: (value: number) => formatCurrency(value) },
                {
                  title: '贡献差异',
                  dataIndex: 'deltaContribution',
                  key: 'deltaContribution',
                  align: 'right',
                  render: (value: number) => (
                    <span style={{ color: value > 0 ? 'var(--semi-color-danger)' : value < 0 ? 'var(--semi-color-success)' : 'inherit', fontWeight: 600 }}>
                      {formatCurrency(value)}
                    </span>
                  ),
                },
                { title: '比例变化', dataIndex: 'ratioDelta', key: 'ratioDelta', align: 'right', render: (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%` },
              ]}
            />

            <div style={{ marginTop: 12 }}>
              <Checkbox checked={showHarnessDetail} onChange={(event) => setShowHarnessDetail(Boolean(event.target.checked))}>
                显示全部线束变化
              </Checkbox>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
