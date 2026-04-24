/**
 * 杞﹀瀷閰嶇疆椤?鈥?閰嶇疆鍏崇郴鍥?浜や簰寮? + 绾挎潫鐭╅樀(鍙)
 * 涓ら樁娈靛彂甯? 绾挎潫寮€鍙戝綍鍏ョ嚎鏉?閰嶇疆鈫掑彂甯冣啋閿€鍞綍鍏ユ瘮渚嬧啋鍙戝竷鈫掕嚜鍔ㄧ畻瑁呰溅姣?
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Typography, Spin, Card, Tag, Toast, Banner, Button, Popconfirm } from '@douyinfe/semi-ui';
import { IconSend } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord, ProjectRecord } from '@/data/db';
import { buildE281BaselineImportPayload } from '@/data/seeds/e281';
import { ensureScenarioWorkspaceHydrated, syncScenarioWorkspaceToDexie, type ScenarioWorkspaceBundle } from '@/data/serverScenarioSync';
import type { VehicleConfig, VehicleConfigMeta, ConfigPublishState } from '@/types/harness';
import { detectConfigRisks, detectVehicleConfigRisks } from '@/engine/config_risk';
import { buildVehicleConfigsFromSkus, computeHarnessInstallationRatios } from '@/engine/configuration_model';
import ConfigIntersectionGraph from '@/components/ConfigIntersectionGraph';
import ScenarioSelector from '@/components/ScenarioSelector';
import { UniverSheet } from '@/components/UniverSheet';
import { useProjectStore } from '@/store/projectStore';
import { apiClient } from '@/lib/apiClient';
import { createMinimalHarnessInput } from '@/lib/harnessInputDefaults';

const { Title } = Typography;
const DRAFT_CONFIG_COLUMN_COUNT = 10;
const DRAFT_BLANK_ROW_COUNT = 5;
const DRAFT_BASE_COLUMN_WIDTHS = [132, 208, 112];
const DRAFT_CONFIG_COLUMN_WIDTH = 96;
const RESULT_COLUMN_WIDTHS = [150, 220, 110, 90];

function getSheetWidth(columnWidths: number[]): number {
  return columnWidths.reduce((sum, width) => sum + width, 0) + 24;
}

function getSheetHeight(rowCount: number, options?: { headerRows?: number; minHeight?: number }): number {
  const headerRows = options?.headerRows ?? 1;
  const minHeight = options?.minHeight ?? 0;
  const headerHeight = headerRows * 40;
  const bodyHeight = Math.max(rowCount - headerRows, 0) * 34;
  return Math.max(minHeight, headerHeight + bodyHeight + 18);
}

function createDraftConfigSlot(index: number, config?: VehicleConfig): VehicleConfig {
  return config ?? {
    configId: `draft-config-${index + 1}`,
    configName: '',
    salesRatio: 0,
    harnessIds: [],
  };
}

function padDraftConfigSlots(configs: VehicleConfig[]): VehicleConfig[] {
  return Array.from({ length: DRAFT_CONFIG_COLUMN_COUNT }, (_, index) => createDraftConfigSlot(index, configs[index]));
}

function normalizeMatrixText(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

function normalizeMatrixConfigType(value: string | number | null | undefined): 'S' | 'O' | undefined {
  const text = normalizeMatrixText(value).toUpperCase();
  if (text === 'S' || text.includes('标配')) return 'S';
  if (text === 'O' || text.includes('选配')) return 'O';
  return undefined;
}

function isSelectedMatrixCell(value: string | number | null | undefined): boolean {
  const text = normalizeMatrixText(value).toLowerCase();
  return text === '1' || text === 'x' || text === 'y' || text === 'yes' || text === 'true' || text === '是';
}

function hasMatrixRowContent(row: Array<string | number | null>, configCount: number): boolean {
  if (normalizeMatrixText(row[0]) || normalizeMatrixText(row[1]) || normalizeMatrixText(row[2])) {
    return true;
  }
  for (let index = 0; index < configCount; index += 1) {
    if (normalizeMatrixText(row[index + 3])) {
      return true;
    }
  }
  return false;
}

function getDraftConfigPlaceholder(index: number): string {
  return `配置${index + 1}`;
}

function getActiveVehicleConfigs(configs: VehicleConfig[]): VehicleConfig[] {
  return configs.filter((config, index) => {
    const trimmedName = config.configName.trim();
    const isPlaceholderOnly = trimmedName === getDraftConfigPlaceholder(index);
    return (!isPlaceholderOnly && trimmedName.length > 0) || config.harnessIds.length > 0 || config.salesRatio > 0;
  });
}

interface ConfigMatrixLocationState {
  setupNotice?: string;
}

const STATE_LABELS: Record<ConfigPublishState, { text: string; color: string }> = {
  draft: { text: '草稿 - 线束开发编辑中', color: 'grey' },
  engineer_published: { text: '已发布 - 待销售录入比例', color: 'blue' },
  sales_published: { text: '已发布 - 装车比已生效', color: 'green' },
};

export default function ConfigMatrixPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const location = useLocation();
  const { setCurrentProject, setCurrentScenario } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);
  const [vehicleConfigs, setVehicleConfigs] = useState<VehicleConfig[]>([]);
  const [publishState, setPublishState] = useState<ConfigPublishState>('draft');
  const [importingE281, setImportingE281] = useState(false);
  const setupNotice = (location.state as ConfigMatrixLocationState | null)?.setupNotice ?? null;

  const reload = useCallback(async () => {
    if (!sid || !id) return;
    const localHarnessCount = await db.harnesses.where('scenarioId').equals(sid).count();
    if (!localHarnessCount) {
      try {
        await ensureScenarioWorkspaceHydrated(id, sid);
      } catch (error) {
        console.error('Failed to hydrate scenario workspace:', error);
      }
    }

    const [p, sc] = await Promise.all([
      db.projects.get(id),
      db.scenarios.get(sid),
    ]);
    setProject(p ?? null);
    setScenario(sc ?? null);
    setVehicleConfigs(
      sc?.vehicleConfigs?.length
        ? structuredClone(sc.vehicleConfigs)
        : sc?.configSkus?.length
          ? buildVehicleConfigsFromSkus(sc.configSkus, sc.harnessConfigMappings ?? [])
          : [],
    );
    setPublishState(sc?.vehicleConfigMeta?.publishState ?? 'draft');
    const h = await db.harnesses.where('scenarioId').equals(sid).toArray();
    setHarnesses(h);
    setLoading(false);
  }, [id, sid]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (project) {
      setCurrentProject(
        project.id,
        project.meta?.projectName || project.meta?.projectCode || '项目详情',
      );
    }
    if (scenario) {
      setCurrentScenario(scenario.id, scenario.scenarioName);
    }
  }, [project, scenario, setCurrentProject, setCurrentScenario]);

  const saveConfigs = useCallback(async (configs: VehicleConfig[], meta?: Partial<VehicleConfigMeta>) => {
    if (!sid) return;
    setVehicleConfigs(configs);
    const patch: any = { vehicleConfigs: configs, updatedAt: new Date().toISOString() };
    if (meta) {
      const prev = scenario?.vehicleConfigMeta ?? { publishState: 'draft' as const };
      patch.vehicleConfigMeta = { ...prev, ...meta };
      setPublishState(patch.vehicleConfigMeta.publishState);
    }
    await db.scenarios.update(sid, patch);
  }, [sid, scenario]);

  const importE281Baseline = useCallback(async () => {
    if (!id || !sid) return;
    setImportingE281(true);
    try {
      const payload = buildE281BaselineImportPayload(false);
      const result = await apiClient<ScenarioWorkspaceBundle & {
        allocationCount: number;
        trackingCount: number;
      }>(`/projects/${id}/scenarios/${sid}/import-baseline`, {
        method: 'POST',
        body: payload,
      });
      await syncScenarioWorkspaceToDexie(result);
      Toast.success(
        `E281 基线已导入：${result.scenario.vehicleConfigs?.length ?? 0} 个车型配置，${result.harnesses.length} 条线束，${result.allocationCount} 条分摊项`,
      );
      await reload();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'E281 基线导入失败');
    } finally {
      setImportingE281(false);
    }
  }, [id, sid, reload]);

  const activeVehicleConfigs = useMemo(() => getActiveVehicleConfigs(vehicleConfigs), [vehicleConfigs]);
  const draftConfigSlots = useMemo(() => padDraftConfigSlots(activeVehicleConfigs), [activeVehicleConfigs]);

  const handleConfigSheetChange = useCallback((data: (string | number | null)[][]) => {
    const updatedConfigs = [...vehicleConfigs];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      const configName = String(row[0]);
      const ratio = row[1] !== null ? Number(row[1]) : 0;
      const cfg = updatedConfigs.find(c => c.configName === configName);
      if (cfg && !isNaN(ratio)) {
        cfg.salesRatio = ratio;
      }
    }
    saveConfigs(updatedConfigs);
  }, [vehicleConfigs, saveConfigs]);

  const handleDraftRelationMatrixChange = useCallback(async (data: (string | number | null)[][]) => {
    if (!sid || !id || data.length === 0) return;

    const nextConfigSlots = draftConfigSlots.map((slot, index) => {
      const configuredName = normalizeMatrixText(data[0]?.[index + 3]);
      return {
        ...slot,
        configName: configuredName,
        harnessIds: [],
      };
    });

    const nextHarnessRows: Array<{
      harnessId: string;
      harnessName: string;
      configType?: 'S' | 'O';
      includedConfigIds: string[];
    }> = [];

    for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
      const row = data[rowIndex] ?? [];
      if (!hasMatrixRowContent(row, draftConfigSlots.length)) {
        continue;
      }

      const harnessId = normalizeMatrixText(row[0]);
      const harnessName = normalizeMatrixText(row[1]) || harnessId;
      const configType = normalizeMatrixConfigType(row[2]);
      if (!harnessId) {
        continue;
      }

      const includedConfigIds = nextConfigSlots
        .filter((_, configIndex) => isSelectedMatrixCell(row[configIndex + 3]))
        .map((config) => config.configId);

      nextHarnessRows.push({
        harnessId,
        harnessName,
        configType,
        includedConfigIds,
      });
    }

    const nextConfigs = nextConfigSlots
      .map((config) => ({
        ...config,
        harnessIds: nextHarnessRows
          .filter((row) => row.includedConfigIds.includes(config.configId))
          .map((row) => row.harnessId),
      }))
      .filter((config, index) => {
        const trimmedName = config.configName.trim();
        const isPlaceholderOnly = trimmedName === getDraftConfigPlaceholder(index);
        return (!isPlaceholderOnly && trimmedName.length > 0) || config.harnessIds.length > 0 || config.salesRatio > 0;
      });

    const now = new Date().toISOString();
    const existingByHarnessId = new Map(harnesses.map((h) => [h.input.harnessId, h]));
    const nextHarnessIds = new Set(nextHarnessRows.map((row) => row.harnessId));

    await saveConfigs(nextConfigs);

    for (const existing of harnesses) {
      if (!nextHarnessIds.has(existing.input.harnessId)) {
        await db.harnesses.delete(existing.id);
      }
    }

    for (const row of nextHarnessRows) {
      const existing = existingByHarnessId.get(row.harnessId);
      const nextInput = createMinimalHarnessInput({
        ...existing?.input,
        harnessId: row.harnessId,
        harnessName: row.harnessName,
        configType: row.configType,
        functionalSlot: undefined,
        vehicleRatio: existing?.input.vehicleRatio ?? 0,
      });

      if (existing) {
        await db.harnesses.update(existing.id, {
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          input: nextInput,
          updatedAt: now,
        });
      } else {
        await db.harnesses.add({
          id: crypto.randomUUID(),
          projectId: id,
          scenarioId: sid,
          harnessId: row.harnessId,
          harnessName: row.harnessName,
          eopYear: null,
          updatedAt: now,
          input: nextInput,
        });
      }
    }

    await reload();
  }, [draftConfigSlots, harnesses, id, reload, saveConfigs, sid]);

  // --- Publish: engineer ---
  const publishEngineer = async () => {
    if (!sid || !scenario || !id) return;
    if (activeVehicleConfigs.length === 0) { Toast.warning('请先录入至少一个车型配置'); return; }
    const empty = activeVehicleConfigs.filter(c => c.harnessIds.length === 0);
    if (empty.length > 0) {
      Toast.warning(`检测到 ${empty.length} 个配置未选择任何线束：${empty.map((item) => item.configName || item.configId).join('、')}。系统将继续发布，并在后续风险/校验链路中显式提示。`);
    }
    const now = new Date().toISOString();
    const existingIds = new Set(harnesses.map(h => h.input.harnessId));
    const allRefIds = [...new Set(activeVehicleConfigs.flatMap(c => c.harnessIds))];
    for (const hid of allRefIds) {
      if (!existingIds.has(hid)) {
        await db.harnesses.add({
          id: crypto.randomUUID(), projectId: id, scenarioId: sid,
          harnessId: hid, harnessName: hid, eopYear: null, updatedAt: now,
          input: createMinimalHarnessInput({
            harnessId: hid,
            harnessName: hid,
            vehicleRatio: 0,
          }),
        });
      }
    }
    await saveConfigs(activeVehicleConfigs, { publishState: 'engineer_published', engineerPublishedAt: now });
    await db.trackingItems.add({
      id: `track-sales-${sid}-${Date.now()}`, projectId: scenario.projectId,
      category: 'sales_input',
      title: '请录入各车型配置的预计销售比例',
      description: `线束开发配置已冻结，共 ${activeVehicleConfigs.length} 个车型配置（${activeVehicleConfigs.map((c) => c.configName).join('、')}），请销售录入各配置的预计销售比例后再发布。`,
      costImpact: 0, status: 'open', priority: 'high', createdAt: now, updatedAt: now,
    });
    await db.trackingItems.add({
      id: `track-bom-${sid}-${Date.now()}`, projectId: scenario.projectId,
      category: 'config_change',
      title: '请录入各线束 BOM 明细',
      description: `已创建 ${allRefIds.length} 条线束（${allRefIds.join('、')}），请前往各线束编辑页录入 BOM 明细。`,
      costImpact: 0, status: 'open', priority: 'high', createdAt: now, updatedAt: now,
    });
    Toast.success('已发布并冻结线束开发配置');
    await reload();
  };

  // --- Publish: sales ---
  const publishSales = async () => {
    if (!sid || !scenario) return;
    const ratioSum = activeVehicleConfigs.reduce((s, c) => s + c.salesRatio, 0);
    if (Math.abs(ratioSum - 1.0) > 0.005) { Toast.warning(`销售比例合计 ${ratioSum.toFixed(3)}，应为 1.000`); return; }
    const now = new Date().toISOString();
    const ratioMap = computeHarnessInstallationRatios(
      activeVehicleConfigs,
      scenario.harnessConfigMappings ?? [],
    );
    for (const h of harnesses) {
      const inferred = ratioMap.get(h.input.harnessId) ?? 0;
      if (Math.abs(inferred - h.input.vehicleRatio) > 0.001) {
        await db.harnesses.update(h.id, {
          input: createMinimalHarnessInput({
            ...h.input,
            harnessId: h.input.harnessId || h.harnessId,
            harnessName: h.input.harnessName || h.harnessName,
            vehicleRatio: inferred,
          }),
          updatedAt: now,
        });
      }
    }
    await saveConfigs(activeVehicleConfigs, { publishState: 'sales_published', salesPublishedAt: now });
    const items = await db.trackingItems.where('projectId').equals(scenario.projectId).toArray();
    for (const item of items) {
      if (item.category === 'sales_input' && item.status === 'open') {
        await db.trackingItems.update(item.id, { status: 'resolved', resolvedAt: now, updatedAt: now });
      }
    }
    Toast.success('销售比例已发布，装车比已自动更新');
    await reload();
  };

  // Risks
  const slotRisks = useMemo(() => {
    if (!harnesses.length) return [];
    return detectConfigRisks(harnesses.map(h => h.input));
  }, [harnesses]);
  const vcRisks = useMemo(() => {
    if (!activeVehicleConfigs.length) return [];
    return detectVehicleConfigRisks(
      activeVehicleConfigs,
      harnesses.map(h => h.input),
      scenario?.harnessConfigMappings ?? [],
    );
  }, [activeVehicleConfigs, scenario?.harnessConfigMappings, harnesses]);
  const allRisks = useMemo(() => [...slotRisks, ...vcRisks], [slotRisks, vcRisks]);

  // Inferred ratio map
  const inferredRatioMap = useMemo(() => {
      return computeHarnessInstallationRatios(
      activeVehicleConfigs,
      scenario?.harnessConfigMappings ?? [],
    );
  }, [activeVehicleConfigs, scenario?.harnessConfigMappings]);

  // Engineer published: config list sheet (editable sales ratio)
  const configSheetData = useMemo(() => {
    const header: (string | number | null)[] = ['配置名称', '销售比例'];
    const rows = activeVehicleConfigs.map(cfg => [cfg.configName, cfg.salesRatio] as (string | number | null)[]);
    return [header, ...rows];
  }, [activeVehicleConfigs]);

  const draftRelationMatrixData = useMemo(() => {
    const header: (string | number | null)[] = [
      '线束号',
      '线束名称',
      '标配/选配',
      ...draftConfigSlots.map((config, index) => config.configName || getDraftConfigPlaceholder(index)),
    ];
    const rows = harnesses.map((harness) => {
      const configText = harness.input.configType === 'S' ? 'S' : harness.input.configType === 'O' ? 'O' : '';
      return [
        harness.input.harnessId,
        harness.input.harnessName,
        configText,
        ...draftConfigSlots.map((config) => config.harnessIds.includes(harness.input.harnessId) ? 1 : ''),
      ] as (string | number | null)[];
    });
    return [
      header,
      ...rows,
      ...Array.from({ length: DRAFT_BLANK_ROW_COUNT }, () => Array.from({ length: 3 + DRAFT_CONFIG_COLUMN_COUNT }, () => '')),
    ];
  }, [draftConfigSlots, harnesses]);

  const relationPreviewData = useMemo(() => {
    const previewConfigs = publishState === 'draft' ? draftConfigSlots : activeVehicleConfigs;
    const header: (string | number | null)[] = [
      '线束号',
      '线束名称',
      '标配/选配',
      ...previewConfigs.map((config, index) => config.configName || getDraftConfigPlaceholder(index)),
    ];
    const rows = harnesses.map((harness) => {
      const configText = harness.input.configType === 'S' ? 'S 标配' : harness.input.configType === 'O' ? 'O 选配' : '-';
      return [
        harness.input.harnessId,
        harness.input.harnessName,
        configText,
        ...previewConfigs.map((config) => config.harnessIds.includes(harness.input.harnessId) ? 1 : ''),
      ] as (string | number | null)[];
    });
    return [header, ...rows];
  }, [activeVehicleConfigs, draftConfigSlots, harnesses, publishState]);

  // Sales published: result matrix (read-only, for reference if needed)
  const matrixData = useMemo(() => {
    const header: (string | number | null)[] = ['零件号', '线束名称', '标配/选配', '装车比'];
    const rows = harnesses.map(h => {
      const configText = h.input.configType === 'S' ? 'S 标配' : h.input.configType === 'O' ? 'O 选配' : '-';
      const inferred = inferredRatioMap.get(h.input.harnessId);
      const ratio = inferred !== undefined ? Number(inferred.toFixed(3)) : Number(h.input.vehicleRatio.toFixed(3));
      return [h.input.harnessId, h.input.harnessName, configText, ratio] as (string | number | null)[];
    });
    return [header, ...rows];
  }, [harnesses, inferredRatioMap]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!scenario) return <div>场景不存在</div>;

  const severityColor = (s: string) => s === 'error' ? 'red' : s === 'warning' ? 'orange' : 'blue';
  const stateInfo = STATE_LABELS[publishState];
  const isDraft = publishState === 'draft';
  const isEngineerPub = publishState === 'engineer_published';
  const isSalesPub = publishState === 'sales_published';
  const needsInitialSetup = harnesses.length === 0 || vehicleConfigs.length === 0;
  const isLikelyE281Project = [project?.meta?.projectCode, project?.meta?.projectName, project?.meta?.platform]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
    .includes('E281');
  const showDevImportAction = import.meta.env.DEV && needsInitialSetup && isLikelyE281Project;

  const draftColumnWidths = [...DRAFT_BASE_COLUMN_WIDTHS, ...Array.from({ length: DRAFT_CONFIG_COLUMN_COUNT }, () => DRAFT_CONFIG_COLUMN_WIDTH)];
  const draftSheetWidth = getSheetWidth(draftColumnWidths);
  const draftSheetHeight = getSheetHeight(draftRelationMatrixData.length, { minHeight: 520 });
  const previewColumnWidths = [...DRAFT_BASE_COLUMN_WIDTHS, ...Array.from({ length: Math.max(activeVehicleConfigs.length, 1) }, () => DRAFT_CONFIG_COLUMN_WIDTH)];
  const previewSheetWidth = getSheetWidth(previewColumnWidths);
  const previewSheetHeight = getSheetHeight(relationPreviewData.length, { minHeight: 280 });
  const resultSheetHeight = getSheetHeight(matrixData.length, { minHeight: 240 });

  return (
    <div style={{ width: 'min(100%, 1760px)', margin: '0 auto', paddingBottom: 64 }} data-testid="config-matrix-page">
      <ScenarioSelector />
      {(setupNotice || needsInitialSetup) && (
        <Banner
          type="info"
          style={{ marginBottom: 16 }}
          description={setupNotice ?? (showDevImportAction ? '请先录入车型配置、线束关系、销售比例；当前为本地开发环境，可直接导入 E281 基线数据。' : '请先新增车型配置和线束，再发布销售比例；录完后系统才会计算装车比并开放后续核算页面。')}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title heading={4} style={{ margin: 0 }}>车型配置管理</Title>
        <Tag color={stateInfo.color as any} size="large">{stateInfo.text}</Tag>
      </div>

      {allRisks.length > 0 && (
        <Card className="glass-card" style={{ marginBottom: 24 }}>
          <Title heading={6} style={{ margin: '0 0 12px' }}>配置风险检测</Title>
          {allRisks.map((r, i) => (
            <Banner key={i}
              type={r.severity === 'error' ? 'danger' : r.severity === 'warning' ? 'warning' : 'info'}
              description={<span><Tag color={severityColor(r.severity)} size="small" style={{ marginRight: 8 }}>{r.code}</Tag>{r.message}</span>}
              style={{ marginBottom: 8 }} />
          ))}
        </Card>
      )}

      {/* 鎿嶄綔鎸夐挳鏍?*/}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        {showDevImportAction && (
          <Popconfirm
            title="Import E281 baseline"
            content="This will overwrite the current scenario's config matrix, harnesses, BOM, one-time costs, and scenario tracking items."
            onConfirm={importE281Baseline}
          >
            <Button size="small" loading={importingE281}>
              Import E281 baseline
            </Button>
          </Popconfirm>
        )}
        {isDraft && (
          <Button data-testid="publish-engineering-config" size="small" type="primary" icon={<IconSend />} onClick={publishEngineer}>
            发布线束开发配置并冻结
          </Button>
        )}
        {isEngineerPub && (
          <Button data-testid="publish-sales-config" size="small" type="primary" icon={<IconSend />} onClick={publishSales}>
            发布销售比例
          </Button>
        )}
      </div>

      {isDraft && (
        <Card className="glass-card" style={{ marginBottom: 24 }}>
          <Title heading={6} style={{ margin: '0 0 8px' }}>配置关系录入</Title>
          <Banner
            type="info"
            style={{ marginBottom: 12 }}
            description="保留 Univer 录入。支持从 Excel 直接多格复制粘贴到起始单元格；首行固定为 10 个配置列，正文保留 5 行空白位，只有在页面确实放不下时才出现外层滚动。"
          />
          <div className="config-entry-sheet-wrap">
            <UniverSheet
              key={`draft-${draftRelationMatrixData.length}-${draftRelationMatrixData[0]?.length ?? 0}-${harnesses.length}-${activeVehicleConfigs.length}`}
              data={draftRelationMatrixData}
              columnWidths={draftColumnWidths}
              minRowCount={draftRelationMatrixData.length}
              minColumnCount={draftRelationMatrixData[0]?.length ?? draftColumnWidths.length}
              readOnly={false}
              className="univer-sheet-soft univer-sheet-entry"
              hideToolbar
              hideFormulaBar
              hideHeaders
              hideGridlines
              width={draftSheetWidth}
              height={draftSheetHeight}
              testId="config-matrix-entry-sheet"
              ariaLabel="配置关系录入表"
              onChange={handleDraftRelationMatrixChange}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ConfigIntersectionGraph vehicleConfigs={activeVehicleConfigs} harnesses={harnesses.map((h) => h.input)} />
          </div>
        </Card>
      )}

      {isEngineerPub && (
        <>
          <Card className="glass-card" style={{ marginBottom: 24 }}>
            <Title heading={6} style={{ margin: '0 0 12px' }}>销售比例录入</Title>
            <UniverSheet
              data={configSheetData}
              columnWidths={[200, 120]}
              readOnly={false}
              hideToolbar
              hideFormulaBar
              hideHeaders
              hideGridlines
              height={Math.min(300, 28 + vehicleConfigs.length * 28 + 20)}
              testId="config-sales-ratio-sheet"
              ariaLabel="销售比例录入表"
              onChange={handleConfigSheetChange}
            />
          </Card>
          <Card className="glass-card" style={{ marginBottom: 24 }}>
            <Title heading={6} style={{ margin: '0 0 12px' }}>配置关系预览</Title>
            <div className="config-entry-sheet-wrap">
              <UniverSheet
                key={`preview-${relationPreviewData.length}-${relationPreviewData[0]?.length ?? 0}-${publishState}`}
                data={relationPreviewData}
                columnWidths={previewColumnWidths}
                minRowCount={relationPreviewData.length}
                minColumnCount={relationPreviewData[0]?.length ?? previewColumnWidths.length}
                readOnly
                className="univer-sheet-soft univer-sheet-entry"
                hideToolbar
                hideFormulaBar
                hideHeaders
                hideGridlines
                width={previewSheetWidth}
                height={previewSheetHeight}
                testId="config-matrix-preview-sheet"
                ariaLabel="配置关系预览表"
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <ConfigIntersectionGraph vehicleConfigs={activeVehicleConfigs} harnesses={harnesses.map((h) => h.input)} />
            </div>
          </Card>
        </>
      )}

      {isSalesPub && (
        <Card className="glass-card" style={{ marginBottom: 24 }}>
          <Title heading={6} style={{ margin: '0 0 12px' }}>配置关系图（已发布）</Title>
          <div className="config-entry-sheet-wrap">
            <UniverSheet
              key={`published-${relationPreviewData.length}-${relationPreviewData[0]?.length ?? 0}-${publishState}`}
              data={relationPreviewData}
              columnWidths={previewColumnWidths}
              minRowCount={relationPreviewData.length}
              minColumnCount={relationPreviewData[0]?.length ?? previewColumnWidths.length}
              readOnly
              className="univer-sheet-soft univer-sheet-entry"
              hideToolbar
              hideFormulaBar
              hideHeaders
              hideGridlines
              width={previewSheetWidth}
              height={previewSheetHeight}
              testId="config-matrix-published-sheet"
              ariaLabel="已发布配置关系表"
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ConfigIntersectionGraph vehicleConfigs={activeVehicleConfigs} harnesses={harnesses.map((h) => h.input)} />
          </div>
        </Card>
      )}

      {/* 鏈€缁堢嚎鏉熺煩闃?鈥?鎵€鏈夌姸鎬侀兘鏄剧ず锛堝彧璇诲弬鑰冿級 */}
      <Card className="glass-card">
        <Title heading={6} style={{ margin: '0 0 12px' }}>线束配置矩阵{isSalesPub ? '（装车比已生效）' : '（预览）'}</Title>
        <div className="config-entry-sheet-wrap">
          <UniverSheet
            key={`result-${matrixData.length}-${matrixData[0]?.length ?? 0}-${publishState}`}
            data={matrixData}
            columnWidths={RESULT_COLUMN_WIDTHS}
            minRowCount={matrixData.length}
            minColumnCount={matrixData[0]?.length ?? RESULT_COLUMN_WIDTHS.length}
            readOnly
            className="univer-sheet-soft univer-sheet-entry"
            hideToolbar
            hideFormulaBar
            hideHeaders
            hideGridlines
            width={getSheetWidth(RESULT_COLUMN_WIDTHS)}
            height={resultSheetHeight}
            testId="config-harness-matrix-sheet"
            ariaLabel="线束配置矩阵"
          />
        </div>
      </Card>
    </div>
  );
}
