import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Toast,
  Tag,
  Divider,
  Popconfirm,
  Spin,
  Dropdown,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconSave, IconUpload, IconInfoCircle, IconEdit } from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStableLiveQuery } from '../hooks/useStableLiveQuery';
import { RoleGuard } from '@/components/RoleGuard';
import { db, type HarnessRecord } from '@/data/db';
import { settingsRepo } from '@/data/repositories';
import { apiClient } from '@/lib/apiClient';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessInput, BomItem, WireItem, HarnessResult } from '@/types/harness';
import type {
  AssemblyPartRow,
  ChangeHistoryRow,
  KskBomRow,
  SecondaryMaterialRow,
} from '@/types/bomWorkbook';
import { BomImportDialog } from '@/components/BomImportDialog';
import { UniverSheet, type SheetDef } from '@/components/UniverSheet';
import ScenarioSelector from '@/components/ScenarioSelector';
import { MultiDirectionNoticeBar } from '@/components/MultiDirectionNoticeBar';
import { CascadeConfirmWizard } from '@/components/CascadeConfirmWizard';
import { InboundSyncWizard } from '@/components/InboundSyncWizard';
import {
  assemblyRowsToSheetData,
  bomRowsToSheetData,
  buildAssemblyPartRows,
  buildBomSheetRows,
  buildKskBomRows,
  buildSecondaryMaterialRows,
  historyRowsToSheetData,
  kskRowsToSheetData,
  secondaryRowsToSheetData,
} from '@/engine/bom_workbook_builders';
import { detectBomChanges, type BomChangeDetectionResult, type BomRowChange } from '@/engine/change_detector';
import {
  buildClassifyHints,
  classifyChangePatterns,
  type SemanticChange,
} from '@/engine/change_pattern_classifier';
import {
  type CascadeAction,
} from '@/engine/cascade_impact';
import {
  buildInboundSyncPreviewRows,
  changeBus,
  type AffectedTarget,
  type SheetChangeEvent,
  type SheetType,
} from '@/engine/change_bus';
import { useSmartPaste, BOM_TARGET_COLUMNS } from '@/hooks/useSmartPaste';

const { Text } = Typography;

const TOOLBAR_HEIGHT = 48;
const STATUS_BAR_HEIGHT = 36;
const BOM_COL_WIDTHS = [45, 120, 160, 180, 55, 110, 160, 65, 50, 120, 80, 75, 85];
const CONFIG_HEADERS = ['序号', '零件包名称', '零件号', '零件名称', '适配导线', '配置', '标配/选配', '单台用量', '占比'];

type PersistedWorkbookState = {
  historyRows?: ChangeHistoryRow[];
};

type PendingChangeSubmission = {
  harnessId: string;
  payload: {
    projectId: string;
    changeType: 'add' | 'replace' | 'cancel' | 'adjust';
    reason: string;
    affectedHarnessIds: string[];
    affectedBomRows: Array<Record<string, unknown>>;
    status: string;
  };
};

function workbookStateKey(projectId: string, scenarioId?: string): string {
  return `bom-workbook:${projectId}:${scenarioId || 'default'}`;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFieldValue(change: BomRowChange, field: string, side: 'before' | 'after') {
  return change.fieldChanges.find((item) => item.field === field)?.[side] ?? null;
}

function resolveChangeEventType(
  detection: BomChangeDetectionResult,
  semanticChanges: SemanticChange[]
): PendingChangeSubmission['payload']['changeType'] {
  if (semanticChanges.some((item) => ['replace', 'wire_spec_replace'].includes(item.pattern))) {
    return 'replace';
  }

  const changeTypes = new Set(detection.changes.map((item) => item.changeType));
  if (changeTypes.size === 1 && changeTypes.has('added')) return 'add';
  if (changeTypes.size === 1 && changeTypes.has('removed')) return 'cancel';
  if (changeTypes.has('added') && changeTypes.has('removed')) return 'replace';
  return 'adjust';
}

function buildAffectedBomRows(detection: BomChangeDetectionResult) {
  return detection.changes.map((change) => {
    const beforeQty = toNumber(getFieldValue(change, 'qty', 'before'));
    const afterQty = toNumber(getFieldValue(change, 'qty', 'after'));
    const beforePrice = toNumber(getFieldValue(change, 'unitPrice', 'before'));
    const afterPrice = toNumber(getFieldValue(change, 'unitPrice', 'after'));
    const beforeAmount = toNumber(getFieldValue(change, 'amount', 'before'), beforeQty * beforePrice);
    const afterAmount = toNumber(getFieldValue(change, 'amount', 'after'), afterQty * afterPrice);

    return {
      changeType: change.changeType,
      harnessId: detection.harnessId,
      harnessName: detection.harnessName,
      partNo: change.partNo,
      partName: change.partName,
      itemCategory: change.itemCategory || String(getFieldValue(change, 'itemCategory', 'after') || getFieldValue(change, 'itemCategory', 'before') || ''),
      supplier: change.supplier || String(getFieldValue(change, 'supplier', 'after') || getFieldValue(change, 'supplier', 'before') || ''),
      beforeQty,
      afterQty,
      qty: change.changeType === 'removed' ? beforeQty : afterQty,
      beforePrice,
      afterPrice,
      unitPrice: change.changeType === 'removed' ? beforePrice : afterPrice,
      deltaAmount: Number((afterAmount - beforeAmount).toFixed(4)),
      remainingQuantity: Math.max(beforeQty - afterQty, 0),
      fieldChanges: change.fieldChanges,
      rowKey: change.rowKey,
      rowIndex: change.rowIndex,
    };
  });
}

function buildPendingChangeSubmission(
  projectId: string,
  detection: BomChangeDetectionResult,
  semanticChanges: SemanticChange[]
): PendingChangeSubmission {
  const semanticReason = semanticChanges.map((item) => item.description).filter(Boolean).join('；');
  return {
    harnessId: detection.harnessId,
    payload: {
      projectId,
      changeType: resolveChangeEventType(detection, semanticChanges),
      reason: semanticReason || detection.summary,
      affectedHarnessIds: [detection.harnessId],
      affectedBomRows: buildAffectedBomRows(detection),
      status: 'draft',
    },
  };
}

function cloneInput(input: HarnessInput): HarnessInput {
  return JSON.parse(JSON.stringify(input)) as HarnessInput;
}

function buildInputMap(harnesses: HarnessRecord[]): Map<string, HarnessInput> {
  const initial = new Map<string, HarnessInput>();
  harnesses.forEach((harness) => {
    initial.set(harness.harnessId, cloneInput(harness.input));
  });
  return initial;
}

function flattenMapRows<T>(rowsByHarness: Map<string, T[]>): T[] {
  return Array.from(rowsByHarness.values()).flat();
}

function buildInitialHistoryRow(projectName: string): ChangeHistoryRow {
  return {
    rowKey: 'history::init',
    sheetType: 'change_history',
    seqNo: 1,
    packageName: projectName,
    harnessPartNo: '',
    partName: '',
    changeDescription: '初始化',
    changeDate: new Date().toLocaleString(),
    remark: '',
  };
}

function rebuildDerivedRows(harnesses: HarnessRecord[], inputs: Map<string, HarnessInput>) {
  const assembly = new Map<string, AssemblyPartRow[]>();
  const secondary = new Map<string, SecondaryMaterialRow[]>();
  const ksk = new Map<string, KskBomRow[]>();

  harnesses.forEach((harness) => {
    const input = inputs.get(harness.harnessId) || harness.input;
    assembly.set(harness.harnessId, buildAssemblyPartRows(harness.harnessId, harness.harnessName, input.bom));
    secondary.set(
      harness.harnessId,
      buildSecondaryMaterialRows(harness.harnessId, harness.harnessName, input.bom)
    );
    ksk.set(harness.harnessId, buildKskBomRows(harness.harnessId, harness.harnessName, input.bom));
  });

  return { assembly, secondary, ksk };
}

function getSheetTypeById(sheetId: string): SheetType | null {
  if (sheetId.startsWith('bom-')) return 'bom';
  if (sheetId === 'assembly') return 'assembly_parts';
  if (sheetId === 'secondary') return 'secondary_material';
  if (sheetId === 'ksk') return 'ksk_bom';
  return null;
}

function applyCascadeAction<T extends { rowKey: string }>(rows: T[], action: CascadeAction): T[] {
  if (action.actionType === 'remove' && action.rowKey) {
    return rows.filter((row) => row.rowKey !== action.rowKey);
  }
  if (action.actionType === 'update' && action.rowKey) {
    return rows.map((row) =>
      row.rowKey === action.rowKey ? { ...row, ...(action.data as Partial<T>) } : row
    );
  }
  if (action.actionType === 'add') {
    return [...rows, action.data as T];
  }
  return rows;
}

function applyRowFieldUpdates<T extends { rowKey: string }>(
  rowsByHarness: Map<string, T[]>,
  updates: Map<string, Record<string, unknown>>
): Map<string, T[]> {
  const next = new Map<string, T[]>();
  rowsByHarness.forEach((rows, harnessId) => {
    next.set(
      harnessId,
      rows.map((row) => {
        const patch = updates.get(row.rowKey);
        return patch ? ({ ...row, ...patch } as T) : row;
      })
    );
  });
  return next;
}

function arrayToBom(
  data: (string | number | null)[][],
  previousBom: Array<BomItem | WireItem> = []
): (BomItem | WireItem)[] {
  return data
    .slice(1)
    .filter((row) => String(row[2] || '').trim().length > 0)
    .map((row, index) => {
      const itemCategory = String(row[10] || 'other');
      const qty = Number(row[7] || 0);
      const unitPrice = Number(row[11] || 0);
      const semiFlag = String(row[4] || '').toUpperCase();
      const previousItem = previousBom[index];
      const previousWire = previousItem?.itemCategory === 'wire' ? previousItem as WireItem : null;

      const base: BomItem = {
        partNo: String(row[2] || ''),
        partName: String(row[3] || ''),
        itemCategory: itemCategory as BomItem['itemCategory'],
        spec: String(row[6] || ''),
        unit: String(row[8] || ''),
        qty,
        unitPrice,
        amount: Number((qty * unitPrice).toFixed(4)),
        functionText: String(row[1] || ''),
        sapNo: String(row[5] || ''),
        supplier: String(row[9] || ''),
        isSemiFinished: semiFlag === 'Y' || semiFlag === '是',
      };

      if (itemCategory === 'wire') {
        return {
          ...base,
          copperWeightPerUnit: previousWire?.copperWeightPerUnit || 0,
          aluminumWeightPerUnit: previousWire?.aluminumWeightPerUnit || 0,
          nonMetalCostPerUnit: previousWire?.nonMetalCostPerUnit || 0,
        } as WireItem;
      }

      return base;
    });
}

function buildSummarySheet(
  harnesses: HarnessRecord[],
  results: Map<string, HarnessResult>
): (string | number | null)[][] {
  const header = ['序号', '线束号', '线束名称', '装车比', 'BOM项数', '材料成本', '人工成本', '制造费用', '出厂价', '到厂价'];
  const rows = harnesses.map((harness, index) => {
    const result = results.get(harness.harnessId);
    return [
      index + 1,
      harness.harnessId,
      harness.harnessName,
      harness.input.vehicleRatio,
      harness.input.bom?.length || 0,
      result ? Number(result.materialCost.toFixed(2)) : '-',
      result ? Number(result.directLabor.toFixed(2)) : '-',
      result ? Number(result.manufacturing.toFixed(2)) : '-',
      result ? Number(result.exFactoryPrice.toFixed(2)) : '-',
      result ? Number(result.deliveredPrice.toFixed(2)) : '-',
    ];
  });
  return [header, ...rows];
}

export default function BomWorkbookPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const smartPaste = useSmartPaste(BOM_TARGET_COLUMNS);

  const data = useStableLiveQuery(async () => {
    if (!id) return null;
    const project = await db.projects.get(id);
    if (!project) return null;
    const scenario = sid ? await db.scenarios.get(sid) : null;
    const harnesses = await db.harnesses.where({ projectId: id }).toArray();
    const scopedHarnesses = sid
      ? harnesses.filter((harness) => harness.scenarioId === sid)
      : harnesses;
    scopedHarnesses.sort((a, b) => a.harnessId.localeCompare(b.harnessId));
    return { project, scenario: scenario ?? null, harnesses: scopedHarnesses };
  }, [id, sid]);

  const scenarioScopeId = sid || data?.scenario?.id || 'default';
  const persistedStateKey = id ? workbookStateKey(id, scenarioScopeId) : null;

  const [modifiedInputs, setModifiedInputs] = useState<Map<string, HarnessInput>>(new Map());
  const [changeDetection, setChangeDetection] = useState<BomChangeDetectionResult | null>(null);
  const [semanticChanges, setSemanticChanges] = useState<SemanticChange[]>([]);
  const [importTarget, setImportTarget] = useState<{ harnessId: string; harnessName: string } | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string>('summary');
  const [historyRows, setHistoryRows] = useState<ChangeHistoryRow[]>([]);
  const [assemblyRowsByHarness, setAssemblyRowsByHarness] = useState<Map<string, AssemblyPartRow[]>>(new Map());
  const [secondaryRowsByHarness, setSecondaryRowsByHarness] = useState<Map<string, SecondaryMaterialRow[]>>(
    new Map()
  );
  const [kskRowsByHarness, setKskRowsByHarness] = useState<Map<string, KskBomRow[]>>(new Map());
  const [showCascadeWizard, setShowCascadeWizard] = useState(false);
  const [pendingChangeSubmissions, setPendingChangeSubmissions] = useState<PendingChangeSubmission[]>([]);
  const [incomingEvents, setIncomingEvents] = useState<Array<{ event: SheetChangeEvent; target: AffectedTarget }>>(
    []
  );
  const [inboundSyncState, setInboundSyncState] = useState<{
    event: SheetChangeEvent;
    target: AffectedTarget;
  } | null>(null);
  const [suspendDetection, setSuspendDetection] = useState(false);
  const [hydratedStateKey, setHydratedStateKey] = useState<string | null>(null);

  useEffect(() => {
    if (!persistedStateKey || !data?.harnesses || data.harnesses.length === 0 || hydratedStateKey === persistedStateKey) return;

    let cancelled = false;

    void (async () => {
      const inputMap = buildInputMap(data.harnesses);
      const derived = rebuildDerivedRows(data.harnesses, inputMap);
      const persisted = (await settingsRepo.get(persistedStateKey)) as PersistedWorkbookState | undefined;
      if (cancelled) return;

      setModifiedInputs(inputMap);
      setAssemblyRowsByHarness(derived.assembly);
      setSecondaryRowsByHarness(derived.secondary);
      setKskRowsByHarness(derived.ksk);
      setHistoryRows(
        persisted?.historyRows && persisted.historyRows.length > 0
          ? persisted.historyRows
          : [buildInitialHistoryRow(data.project?.meta.projectName || data.project?.meta.projectCode || '')]
      );
      setChangeDetection(null);
      setSemanticChanges([]);
      setPendingChangeSubmissions([]);
      setIncomingEvents([]);
      setInboundSyncState(null);
      setShowCascadeWizard(false);
      setHydratedStateKey(persistedStateKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydratedStateKey, persistedStateKey]);

  useEffect(() => {
    if (!persistedStateKey || hydratedStateKey !== persistedStateKey || historyRows.length === 0) return;
    void settingsRepo.set(persistedStateKey, { historyRows });
  }, [historyRows, hydratedStateKey, persistedStateKey]);

  const resultsMap = useMemo(() => {
    const map = new Map<string, HarnessResult>();
    const scenario = data?.scenario;
    if (!scenario) return map;

    modifiedInputs.forEach((input, harnessId) => {
      if (!input.harnessId || input.bom.length === 0) return;
      try {
        map.set(
          harnessId,
          computeHarnessCost(input, scenario.config.costRates, scenario.config.metalPrices)
        );
      } catch {
        // keep workbook interactive even when a single harness cannot be computed
      }
    });

    return map;
  }, [data?.scenario, modifiedInputs]);

  const isDirty = useMemo(() => {
    if (!data?.harnesses) return false;
    return data.harnesses.some((harness) => {
      const modified = modifiedInputs.get(harness.harnessId);
      return modified ? JSON.stringify(modified) !== JSON.stringify(harness.input) : false;
    });
  }, [data?.harnesses, modifiedInputs]);

  const hasPendingWorkflow =
    Boolean(changeDetection) || incomingEvents.length > 0 || Boolean(inboundSyncState);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (!data?.harnesses || !id) return;

    const assemblyFlat = flattenMapRows(assemblyRowsByHarness);
    const secondaryFlat = flattenMapRows(secondaryRowsByHarness);
    const kskFlat = flattenMapRows(kskRowsByHarness);

    const indexedRows = data.harnesses.flatMap((harness) => {
      const input = modifiedInputs.get(harness.harnessId) || harness.input;
      return [
        ...input.bom.map((item, rowIndex) => ({
          projectId: id,
          scenarioId: scenarioScopeId,
          harnessId: harness.harnessId,
          sheetType: 'bom' as const,
          sheetId: `bom-${harness.harnessId}`,
          sheetName: harness.harnessId,
          partNo: item.partNo,
          rowIndex,
        })),
        ...(assemblyRowsByHarness.get(harness.harnessId) || []).map((row) => ({
          projectId: id,
          scenarioId: scenarioScopeId,
          harnessId: harness.harnessId,
          sheetType: 'assembly_parts' as const,
          sheetId: 'assembly',
          sheetName: 'Assembly Parts',
          partNo: row.partNo,
          rowIndex: assemblyFlat.findIndex((candidate) => candidate.rowKey === row.rowKey),
        })),
        ...(secondaryRowsByHarness.get(harness.harnessId) || []).map((row) => ({
          projectId: id,
          scenarioId: scenarioScopeId,
          harnessId: harness.harnessId,
          sheetType: 'secondary_material' as const,
          sheetId: 'secondary',
          sheetName: 'Secondary Material',
          partNo: row.partNo,
          rowIndex: secondaryFlat.findIndex((candidate) => candidate.rowKey === row.rowKey),
        })),
        ...(kskRowsByHarness.get(harness.harnessId) || []).map((row) => ({
          projectId: id,
          scenarioId: scenarioScopeId,
          harnessId: harness.harnessId,
          sheetType: 'ksk_bom' as const,
          sheetId: 'ksk',
          sheetName: 'KSK BOM',
          partNo: row.partNo,
          rowIndex: kskFlat.findIndex((candidate) => candidate.rowKey === row.rowKey),
        })),
      ];
    });

    changeBus.rebuildIndex(indexedRows.filter((row) => row.rowIndex >= 0));
  }, [assemblyRowsByHarness, data?.harnesses, id, kskRowsByHarness, modifiedInputs, scenarioScopeId, secondaryRowsByHarness]);

  useEffect(() => {
    const unsubscribe = changeBus.on((event, targets) => {
      if (event.projectId !== id || event.scenarioId !== scenarioScopeId) return;

      setIncomingEvents((prev) => {
        const next = [...prev];
        targets.forEach((target) => {
          const exists = next.some(
            (item) =>
              item.event.eventId === event.eventId &&
              item.target.targetSheetId === target.targetSheetId &&
              item.target.harnessId === target.harnessId
          );
          if (!exists) {
            next.push({ event, target });
          }
        });
        return next;
      });
    });

    return unsubscribe;
  }, [id, scenarioScopeId]);

  const activeSheetType = useMemo(() => getSheetTypeById(activeSheetId), [activeSheetId]);

  const incomingForActiveSheet = useMemo(() => {
    if (!activeSheetType) return [];
    return incomingEvents.filter((item) => item.target.targetSheetId === activeSheetId);
  }, [activeSheetId, activeSheetType, incomingEvents]);

  const getLocalRowsForTarget = useCallback(
    (target: AffectedTarget): Array<Record<string, unknown>> => {
      if (target.targetSheet === 'assembly_parts') {
        return flattenMapRows(assemblyRowsByHarness) as unknown as Array<Record<string, unknown>>;
      }
      if (target.targetSheet === 'secondary_material') {
        return flattenMapRows(secondaryRowsByHarness) as unknown as Array<Record<string, unknown>>;
      }
      return flattenMapRows(kskRowsByHarness) as unknown as Array<Record<string, unknown>>;
    },
    [assemblyRowsByHarness, kskRowsByHarness, secondaryRowsByHarness]
  );

  const sheets = useMemo((): SheetDef[] => {
    if (!data?.harnesses) return [];

    const assemblyRows = flattenMapRows(assemblyRowsByHarness);
    const secondaryRows = flattenMapRows(secondaryRowsByHarness);
    const kskRows = flattenMapRows(kskRowsByHarness);
    const result: SheetDef[] = [
      {
        id: 'summary',
        name: '总览',
        data: buildSummarySheet(data.harnesses, resultsMap),
        columnWidths: [45, 120, 180, 70, 70, 85, 85, 85, 85, 85],
        freezeRows: 1,
      },
      {
        id: 'history',
        name: '变更履历',
        data: historyRowsToSheetData(historyRows),
        columnWidths: [45, 140, 160, 180, 300, 140, 180],
        freezeRows: 1,
      },
      {
        id: 'secondary',
        name: '二次物料明细',
        data: secondaryRowsToSheetData(secondaryRows),
        columnWidths: [140, 180, 160, 60, 60, 90, 100, 100, 140, 100, 140, 160],
        freezeRows: 1,
      },
      {
        id: 'config',
        name: '配置清单',
        data: [CONFIG_HEADERS],
        columnWidths: [45, 120, 160, 180, 100, 100, 100, 80, 80],
        freezeRows: 1,
      },
      {
        id: 'assembly',
        name: '总成散件清单',
        data: assemblyRowsToSheetData(assemblyRows),
        columnWidths: [45, 120, 160, 180, 80, 80, 60, 80, 120, 70, 50, 120, 120],
        freezeRows: 1,
      },
      {
        id: 'ksk',
        name: 'KSK线束BOM明细',
        data: kskRowsToSheetData(kskRows),
        columnWidths: [140, 180, 120, 160, 180, 70, 120, 100, 70, 60, 120, 160],
        freezeRows: 1,
      },
    ];

    data.harnesses.forEach((harness) => {
      const input = modifiedInputs.get(harness.harnessId) || harness.input;
      result.push({
        id: `bom-${harness.harnessId}`,
        name: harness.harnessId,
        data: bomRowsToSheetData(buildBomSheetRows(harness.harnessId, harness.harnessName, input.bom)),
        columnWidths: BOM_COL_WIDTHS,
        freezeRows: 1,
      });
    });

    return result;
  }, [assemblyRowsByHarness, data?.harnesses, historyRows, kskRowsByHarness, modifiedInputs, resultsMap, secondaryRowsByHarness]);

  const handleSheetChange = useCallback(
    (sheetData: (string | number | null)[][], sheetId?: string) => {
      if (!sheetId || !sheetId.startsWith('bom-') || suspendDetection || !id) return;

      const harnessId = sheetId.replace('bom-', '');
      const harness = data?.harnesses.find((item) => item.harnessId === harnessId);
      if (!harness) return;

      const beforeBom = modifiedInputs.get(harnessId)?.bom || harness.input.bom;
      const nextBom = arrayToBom(sheetData, beforeBom);
      const beforeRows = buildBomSheetRows(harnessId, harness.harnessName, beforeBom);
      const afterRows = buildBomSheetRows(harnessId, harness.harnessName, nextBom);
      const detection = detectBomChanges(harnessId, harness.harnessName, harness.harnessId, beforeRows, afterRows);
      const semantic = detection.hasChanges
        ? classifyChangePatterns(detection, buildClassifyHints(nextBom as BomItem[]))
        : [];

      setModifiedInputs((prev) => {
        const next = new Map(prev);
        const existing = next.get(harnessId);
        if (existing) {
          next.set(harnessId, { ...existing, bom: nextBom });
        }
        return next;
      });
      setAssemblyRowsByHarness((prev) =>
        new Map(prev).set(harnessId, buildAssemblyPartRows(harnessId, harness.harnessName, nextBom))
      );
      setSecondaryRowsByHarness((prev) =>
        new Map(prev).set(harnessId, buildSecondaryMaterialRows(harnessId, harness.harnessName, nextBom))
      );
      setKskRowsByHarness((prev) =>
        new Map(prev).set(harnessId, buildKskBomRows(harnessId, harness.harnessName, nextBom))
      );
      setChangeDetection(detection.hasChanges ? detection : null);
      setSemanticChanges(semantic);

      if (detection.hasChanges) {
        changeBus.emit({
          projectId: id,
          scenarioId: scenarioScopeId,
          harnessId,
          sourceSheet: 'bom',
          sourceSheetId: sheetId,
          sourceSheetName: harness.harnessId,
          detection,
        });
      }
    },
    [data?.harnesses, id, modifiedInputs, scenarioScopeId, suspendDetection]
  );

  const handleCascadeConfirm = useCallback(
    async (actions: CascadeAction[]) => {
      if (!changeDetection || !id) return;

      setSuspendDetection(true);
      try {
        const harnessId = changeDetection.harnessId;

        const updateHarnessRows = <T extends { rowKey: string }>(
          prev: Map<string, T[]>,
          targetSheet: CascadeAction['targetSheet']
        ) => {
          const next = new Map(prev);
          const currentRows = next.get(harnessId) || [];
          const nextRows = actions
            .filter((action) => action.targetSheet === targetSheet)
            .reduce((rows, action) => applyCascadeAction(rows, action), currentRows);
          next.set(harnessId, nextRows);
          return next;
        };

        setAssemblyRowsByHarness((prev) => updateHarnessRows(prev, 'assembly_parts'));
        setSecondaryRowsByHarness((prev) => updateHarnessRows(prev, 'secondary_material'));
        setKskRowsByHarness((prev) => updateHarnessRows(prev, 'ksk_bom'));
        setHistoryRows((prev) => {
          const historyActions = actions.filter((action) => action.targetSheet === 'change_history');
          if (historyActions.length === 0) return prev;

          let next = [...prev];
          historyActions.forEach((action) => {
            const rows = (action.data.rows as ChangeHistoryRow[]) || [];
            rows.forEach((row) => {
              next = [...next, row];
            });
          });
          return next;
        });

        setChangeDetection(null);
        setSemanticChanges([]);
        setPendingChangeSubmissions((prev) => [...prev, buildPendingChangeSubmission(id, changeDetection, semanticChanges)]);
        setShowCascadeWizard(false);
        Toast.success('级联确认完成，关联表与变更履历已更新。');
      } finally {
        setSuspendDetection(false);
      }
    },
    [changeDetection, id, semanticChanges]
  );

  const handleInboundSync = useCallback(
    async (
      rows: Array<ReturnType<typeof buildInboundSyncPreviewRows>[number]>
    ) => {
      if (!inboundSyncState) return;

      const buildUpdates = <T extends { rowKey: string }>(flatRows: T[]) => {
        const updates = new Map<string, Record<string, unknown>>();
        rows.forEach((row) => {
          const targetRow = flatRows[row.localRowIndex];
          if (!targetRow) return;
          const patch = updates.get(targetRow.rowKey) || {};
          patch[row.field] = row.sourceValue;
          updates.set(targetRow.rowKey, patch);
        });
        return updates;
      };

      if (inboundSyncState.target.targetSheet === 'assembly_parts') {
        const updates = buildUpdates(flattenMapRows(assemblyRowsByHarness));
        setAssemblyRowsByHarness((prev) => applyRowFieldUpdates(prev, updates));
      }

      if (inboundSyncState.target.targetSheet === 'secondary_material') {
        const updates = buildUpdates(flattenMapRows(secondaryRowsByHarness));
        setSecondaryRowsByHarness((prev) => applyRowFieldUpdates(prev, updates));
      }

      if (inboundSyncState.target.targetSheet === 'ksk_bom') {
        const updates = buildUpdates(flattenMapRows(kskRowsByHarness));
        setKskRowsByHarness((prev) => applyRowFieldUpdates(prev, updates));
      }

      setIncomingEvents((prev) =>
        prev.filter(
          (item) =>
            !(
              item.event.eventId === inboundSyncState.event.eventId &&
              item.target.targetSheetId === inboundSyncState.target.targetSheetId &&
              item.target.harnessId === inboundSyncState.target.harnessId
            )
        )
      );
      setInboundSyncState(null);
      Toast.success('入站同步完成。');
    },
    [assemblyRowsByHarness, inboundSyncState, kskRowsByHarness, secondaryRowsByHarness]
  );

  const handleSaveAll = useCallback(async () => {
    if (!data?.harnesses) return;
    if (hasPendingWorkflow) {
      Toast.warning('请先完成当前联动确认，再执行保存。');
      return;
    }

    try {
      const changedHarnesses = data.harnesses.filter((harness) => {
        const modified = modifiedInputs.get(harness.harnessId);
        return modified ? JSON.stringify(modified) !== JSON.stringify(harness.input) : false;
      });

      if (sid) {
        for (const harness of changedHarnesses) {
          const modified = modifiedInputs.get(harness.harnessId);
          if (!modified) continue;

          await apiClient(`/scenarios/${sid}/bom/import`, {
            method: 'POST',
            body: {
              harnessId: harness.harnessId,
              rows: modified.bom.map((item) => ({
                partNo: item.partNo,
                partName: item.partName,
                itemCategory: item.itemCategory,
                qty: item.qty,
                unit: item.unit,
                unitPrice: item.unitPrice,
                amount: item.amount,
                sapNo: item.sapNo,
                spec: item.spec,
                supplier: item.supplier,
                functionText: item.functionText,
              })),
            },
          });
        }

        for (const submission of pendingChangeSubmissions) {
          const created = await apiClient<{ id: string }>(`/projects/${id}/scenarios/${sid}/changes`, {
            method: 'POST',
            body: submission.payload,
          });
          await apiClient(`/changes/${created.id}/calculate-impact`, {
            method: 'POST',
          });
        }
      } else if (pendingChangeSubmissions.length > 0) {
        Toast.warning('当前未绑定场景，本次仅保存本地 BOM，未同步设变台账。');
      }

      const updates = changedHarnesses.map((harness) => {
        const modified = modifiedInputs.get(harness.harnessId)!;
        return (
          db.harnesses.update(harness.id, {
            input: modified,
            harnessName: modified.harnessName,
            result: resultsMap.get(harness.harnessId),
            updatedAt: new Date().toISOString(),
          })
        );
      });

      await Promise.all(updates);
      setPendingChangeSubmissions([]);
      Toast.success(`已保存 ${updates.length} 条线束 BOM${sid ? '，并同步场景台账' : ''}。`);
    } catch (error) {
      console.error('Save failed:', error);
      Toast.error('保存失败。');
    }
  }, [data?.harnesses, hasPendingWorkflow, id, modifiedInputs, pendingChangeSubmissions, sid]);

  const handleImportBom = useCallback(
    (newBom: (BomItem | WireItem)[]) => {
      if (!importTarget || !data?.harnesses) return;

      const harness = data.harnesses.find((item) => item.harnessId === importTarget.harnessId);
      if (!harness) return;

      setModifiedInputs((prev) => {
        const next = new Map(prev);
        const existing = next.get(importTarget.harnessId);
        if (existing) {
          next.set(importTarget.harnessId, { ...existing, bom: newBom });
        }
        return next;
      });
      setAssemblyRowsByHarness((prev) =>
        new Map(prev).set(
          importTarget.harnessId,
          buildAssemblyPartRows(importTarget.harnessId, harness.harnessName, newBom)
        )
      );
      setSecondaryRowsByHarness((prev) =>
        new Map(prev).set(
          importTarget.harnessId,
          buildSecondaryMaterialRows(importTarget.harnessId, harness.harnessName, newBom)
        )
      );
      setKskRowsByHarness((prev) =>
        new Map(prev).set(importTarget.harnessId, buildKskBomRows(importTarget.harnessId, harness.harnessName, newBom))
      );
      setChangeDetection(null);
      setSemanticChanges([]);
      setPendingChangeSubmissions([]);
      setImportTarget(null);
      Toast.success('BOM 已导入，派生关联表已重建。');
    },
    [data?.harnesses, importTarget]
  );

  const totals = useMemo(() => {
    let material = 0;
    let labor = 0;
    let manufacturing = 0;
    let exFactory = 0;
    let delivered = 0;

    resultsMap.forEach((result) => {
      material += result.materialCost;
      labor += result.directLabor;
      manufacturing += result.manufacturing;
      exFactory += result.exFactoryPrice;
      delivered += result.deliveredPrice;
    });

    return { count: resultsMap.size, material, labor, manufacturing, exFactory, delivered };
  }, [resultsMap]);

  if (!data || !persistedStateKey || hydratedStateKey !== persistedStateKey) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载 BOM 工作簿..." />
      </div>
    );
  }

  const { project, harnesses } = data;
  const isEditableSheet = activeSheetId.startsWith('bom-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <ScenarioSelector />

      <div
        style={{
          height: TOOLBAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-0)',
          zIndex: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <Space spacing={8}>
          <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate(`/project/${id}/s/${sid}`)} />
          <Text strong style={{ fontSize: 16 }}>
            {(project.meta.projectName || project.meta.projectCode) + ' - BOM 工作簿'}
          </Text>
          <Divider layout="vertical" style={{ margin: '0 4px', height: 16 }} />

          {isEditableSheet ? (
            <Tag color="green" prefixIcon={<IconEdit />}>
              当前线束可编辑
            </Tag>
          ) : (
            <Tooltip content="汇总 Sheet 由系统根据线束 BOM 自动生成，需切换到具体线束页编辑。">
              <Tag color="grey" prefixIcon={<IconInfoCircle />}>
                只读汇总
              </Tag>
            </Tooltip>
          )}

          {isDirty ? (
            <Tag color="orange" type="light">
              有未保存改动
            </Tag>
          ) : null}

          {hasPendingWorkflow ? (
            <Tag color="red" type="light">
              存在待确认联动
            </Tag>
          ) : null}
        </Space>

        <Space spacing={8}>
          <RoleGuard field="bomEdit">
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <Dropdown.Title>选择导入目标线束</Dropdown.Title>
                  {harnesses.map((harness) => (
                    <Dropdown.Item
                      key={harness.harnessId}
                      onClick={() => setImportTarget({ harnessId: harness.harnessId, harnessName: harness.harnessName })}
                    >
                      {harness.harnessId} - {harness.harnessName}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              }
            >
              <Button icon={<IconUpload />} theme="light">
                导入 BOM
              </Button>
            </Dropdown>
          </RoleGuard>

          {isDirty ? (
            <Popconfirm
              title="确定放弃当前未保存改动吗？"
              content="放弃后会恢复到最近一次保存的 BOM 数据。已确认写入的变更履历不会删除。"
              onConfirm={() => {
                const restoredInputs = buildInputMap(harnesses);
                const derived = rebuildDerivedRows(harnesses, restoredInputs);
                setModifiedInputs(restoredInputs);
                setAssemblyRowsByHarness(derived.assembly);
                setSecondaryRowsByHarness(derived.secondary);
                setKskRowsByHarness(derived.ksk);
                setChangeDetection(null);
                setSemanticChanges([]);
                setPendingChangeSubmissions([]);
                setIncomingEvents([]);
                setInboundSyncState(null);
                setShowCascadeWizard(false);
                Toast.info('已恢复到最近一次保存状态。');
              }}
            >
              <Button theme="borderless" type="danger">
                放弃改动
              </Button>
            </Popconfirm>
          ) : null}

          <RoleGuard field="bomEdit" readOnlyFallback>
            <Button
              icon={<IconSave />}
              type="primary"
              theme="solid"
              disabled={!isDirty || hasPendingWorkflow}
              onClick={handleSaveAll}
            >
              全部保存
            </Button>
          </RoleGuard>
        </Space>
      </div>

      <MultiDirectionNoticeBar
        currentSheetType={activeSheetType || 'bom'}
        localDetection={activeSheetType === 'bom' ? changeDetection : null}
        incomingEvents={incomingForActiveSheet}
        onOpenOutboundCascade={(detection) => {
          setChangeDetection(detection);
          setShowCascadeWizard(true);
        }}
        onOpenInboundSync={(event, target) => setInboundSyncState({ event, target })}
        onDismissLocal={() => {
          setChangeDetection(null);
          setSemanticChanges([]);
        }}
        onDismissIncoming={(eventId) =>
          setIncomingEvents((prev) => prev.filter((item) => item.event.eventId !== eventId))
        }
      />

      <div style={{ flex: 1, position: 'relative' }}>
        <UniverSheet
          sheets={sheets}
          onChange={handleSheetChange}
          onActiveSheetChange={setActiveSheetId}
          height="100%"
          hideToolbar
        />
      </div>

      {showCascadeWizard && changeDetection ? (
        <CascadeConfirmWizard
          detection={changeDetection}
          semanticChanges={semanticChanges}
          assemblyRows={flattenMapRows(assemblyRowsByHarness)}
          secondaryRows={flattenMapRows(secondaryRowsByHarness)}
          kskRows={flattenMapRows(kskRowsByHarness)}
          existingHistoryRows={historyRows}
          onConfirm={handleCascadeConfirm}
          onCancel={() => setShowCascadeWizard(false)}
        />
      ) : null}

      {inboundSyncState ? (
        <InboundSyncWizard
          event={inboundSyncState.event}
          target={inboundSyncState.target}
          localData={getLocalRowsForTarget(inboundSyncState.target)}
          onConfirmSync={handleInboundSync}
          onCancel={() => setInboundSyncState(null)}
        />
      ) : null}

      <div
        style={{
          height: STATUS_BAR_HEIGHT,
          backgroundColor: 'var(--text-primary)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: 12,
          color: '#fff',
        }}
      >
        <Space spacing={24}>
          <Text size="small" style={{ color: 'var(--text-secondary)' }}>
            共 <Text strong style={{ color: '#fff' }}>{harnesses.length}</Text> 条线束 | 已计算{' '}
            <Text strong style={{ color: '#fff' }}>{totals.count}</Text> 条
          </Text>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text size="small" style={{ color: '#64748b' }}>
              项目估算
            </Text>
            <Text size="small" style={{ color: 'var(--text-secondary)' }}>
              材料 <Text strong style={{ color: '#06b6d4', fontFamily: 'JetBrains Mono' }}>¥{totals.material.toFixed(2)}</Text>
            </Text>
            <Text size="small" style={{ color: 'var(--text-secondary)' }}>
              人工 <Text strong style={{ color: '#fff', fontFamily: 'JetBrains Mono' }}>¥{totals.labor.toFixed(2)}</Text>
            </Text>
            <Text size="small" style={{ color: 'var(--text-secondary)' }}>
              制造 <Text strong style={{ color: '#fff', fontFamily: 'JetBrains Mono' }}>¥{totals.manufacturing.toFixed(2)}</Text>
            </Text>
            <Text size="small" style={{ color: 'var(--text-secondary)' }}>
              出厂 <Text strong style={{ color: '#fbbf24', fontFamily: 'JetBrains Mono' }}>¥{totals.exFactory.toFixed(2)}</Text>
            </Text>
            <Text size="small" style={{ color: 'var(--text-secondary)' }}>
              到厂 <Text strong style={{ color: '#f87171', fontFamily: 'JetBrains Mono' }}>¥{totals.delivered.toFixed(2)}</Text>
            </Text>
          </div>
        </Space>
      </div>

      {importTarget ? (
        <BomImportDialog
          visible
          projectId={id!}
          harnessId={importTarget.harnessId}
          harnessName={importTarget.harnessName}
          existingBomItems={modifiedInputs.get(importTarget.harnessId)?.bom || []}
          onClose={() => setImportTarget(null)}
          onImport={handleImportBom}
        />
      ) : null}
    </div>
  );
}
