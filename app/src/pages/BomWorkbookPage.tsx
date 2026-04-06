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
import { RoleGuard } from '@/components/RoleGuard';

import { db, type HarnessRecord } from '@/data/db';
import { computeHarnessCost } from '@/engine/harness_costing';
import type { HarnessInput, BomItem, WireItem, HarnessResult } from '@/types/harness';
import { BomImportDialog } from '@/components/BomImportDialog';
import { UniverSheet, type SheetDef } from '@/components/UniverSheet';

const { Text } = Typography;

const TOOLBAR_HEIGHT = 48;
const STATUS_BAR_HEIGHT = 36;

// ── BOM Column Layout (same as HarnessEditPage) ──────────────────────────────
const BOM_HEADERS = [
  '序号', '功能', '零件号', '零件名称', '半成品',
  'SAP物料号', '规格', '数量', '单位', '供应商',
  '分类', '单价(元)', '金额(元)', '铜重(kg)', '铝重(kg)', '非金属成本(元)',
];
const BOM_COL_WIDTHS = [45, 120, 160, 180, 55, 110, 160, 65, 50, 120, 80, 75, 85, 70, 70, 90];

// ── Special Sheets Headers ───────────────────────────────────────────────────
const HISTORY_HEADERS = ['序号', '零件包名称', '线束零件号', '零件名称', '变更履历', '更改时间', '备注'];
const SECONDARY_MATERIAL_HEADERS = ['组件描述', '物料名称（英文/中文）', '用量', '单位', '单价', '单位铜重', '铜重', '供应商名称', '产地', 'SAP号', '备注'];
const CONFIG_HEADERS = ['序号', '零件包名称', '零件号', '零件名称', '适配导线', '配置', '标配/选配', '单台用量', '占比'];
const ASSEMBLY_PARTS_HEADERS = ['NO.', 'Function/功能', 'Part Number/零件号', 'Part Name/零件名称', 'Semi-Finished/是否半成品', 'Wire NO./回路号', 'PIN', 'OPTION', 'SPEC/规格', 'Quantity/数量', 'Unit/单位', 'Remark/其他备注'];
const KSK_HEADERS = ['线束零件号', '零件名称', '总成号', '零件号', '物料名称/零件名称', '是否半成品', '物料型号/SAP', '回路号', '数量', '单位', '供应商', '其他备注'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function bomToArray(bom: (BomItem | WireItem)[]): (string | number | null)[][] {
  const rows = bom.map((item, index) => [
    index + 1,
    item.functionText || item.endGroup || '',
    item.partNo,
    item.partName,
    item.isSemiFinished ? 'Y' : 'N',
    item.sapNo || '',
    item.spec || '',
    item.qty,
    item.unit,
    item.supplier || '',
    item.itemCategory,
    item.unitPrice,
    item.amount,
    (item as WireItem).copperWeightPerUnit || 0,
    (item as WireItem).aluminumWeightPerUnit || 0,
    (item as WireItem).nonMetalCostPerUnit || 0,
  ]);
  return [BOM_HEADERS, ...rows];
}

function arrayToBom(data: (string | number | null)[][]): (BomItem | WireItem)[] {
  const rows = data.slice(1); // skip header
  return rows
    .filter(row => row.some((cell, i) => i > 0 && cell !== null && cell !== ''))
    .map(row => {
      const itemCategory = (row[10] as any) || 'other';
      const qty = Number(row[7] || 0);
      const unitPrice = Number(row[11] || 0);
      const semiFlag = String(row[4] || '').toUpperCase();

      const base: BomItem = {
        partNo: String(row[2] || ''),
        partName: String(row[3] || ''),
        itemCategory,
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
          copperWeightPerUnit: Number(row[13] || 0),
          aluminumWeightPerUnit: Number(row[14] || 0),
          nonMetalCostPerUnit: Number(row[15] || 0),
        } as WireItem;
      }
      return base;
    });
}

/** Build summary sheet data: overview of all harnesses */
function buildSummarySheet(
  harnesses: HarnessRecord[],
  results: Map<string, HarnessResult>
): (string | number | null)[][] {
  const header = [
    '序号', '零件号', '零件名称', '装车比', 'BOM数量',
    '材料成本', '人工成本', '制造费', '出厂价', '到厂价',
  ];
  const rows = harnesses.map((h, i) => {
    const r = results.get(h.harnessId);
    return [
      i + 1,
      h.harnessId,
      h.harnessName,
      h.input.vehicleRatio,
      h.input.bom?.length || 0,
      r ? Number(r.materialCost.toFixed(2)) : '-',
      r ? Number(r.directLabor.toFixed(2)) : '-',
      r ? Number(r.manufacturing.toFixed(2)) : '-',
      r ? Number(r.exFactoryPrice.toFixed(2)) : '-',
      r ? Number(r.deliveredPrice.toFixed(2)) : '-',
    ];
  });
  return [header, ...rows];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BomWorkbookPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load project + all harnesses
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const project = await db.projects.get(id);
    if (!project) return null;
    const harnesses = await db.harnesses.where({ projectId: id }).toArray();
    // Sort by harnessId for consistent sheet order
    harnesses.sort((a, b) => a.harnessId.localeCompare(b.harnessId));
    return { project, harnesses };
  }, [id]);

  // Track modified harness inputs (keyed by harnessId)
  const [modifiedInputs, setModifiedInputs] = useState<Map<string, HarnessInput>>(new Map());
  const [importTarget, setImportTarget] = useState<{ harnessId: string; harnessName: string } | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string>('summary');

  // When data loads, initialize modifiedInputs if empty
  useEffect(() => {
    if (data?.harnesses && modifiedInputs.size === 0) {
      const initial = new Map<string, HarnessInput>();
      data.harnesses.forEach(h => {
        initial.set(h.harnessId, JSON.parse(JSON.stringify(h.input)));
      });
      setModifiedInputs(initial);
    }
  }, [data?.harnesses]);

  // Compute results for all harnesses (for status bar preview)
  const resultsMap = useMemo(() => {
    const map = new Map<string, HarnessResult>();
    if (!data?.project) return map;
    modifiedInputs.forEach((input, hId) => {
      if (input.harnessId && input.bom.length > 0) {
        try {
          const r = computeHarnessCost(input, data.project!.config.costRates, data.project!.config.metalPrices);
          map.set(hId, r);
        } catch { /* skip */ }
      }
    });
    return map;
  }, [data?.project, modifiedInputs]);

  // Check dirty state
  const isDirty = useMemo(() => {
    if (!data?.harnesses) return false;
    for (const h of data.harnesses) {
      const modified = modifiedInputs.get(h.harnessId);
      if (modified && JSON.stringify(modified) !== JSON.stringify(h.input)) return true;
    }
    return false;
  }, [data?.harnesses, modifiedInputs]);

  // Beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Build multi-sheet data for Univer
  const sheets = useMemo((): SheetDef[] => {
    if (!data?.harnesses) return [];
    const result: SheetDef[] = [];

    // 1. Summary sheet
    result.push({
      id: 'summary',
      name: '总览',
      data: buildSummarySheet(data.harnesses, resultsMap),
      columnWidths: [45, 120, 180, 70, 70, 85, 85, 85, 85, 85],
      freezeRows: 1,
    });

    // 2. Change History sheet
    result.push({
      id: 'history',
      name: '变更履历',
      data: [HISTORY_HEADERS, [1, data.project?.meta.projectName || '', '', '', '初始化', new Date().toLocaleDateString(), '']],
      columnWidths: [45, 120, 160, 180, 300, 100, 100],
      freezeRows: 1,
    });

    // 3. Secondary Material sheet
    const secondaryData: (string | number | null)[][] = [SECONDARY_MATERIAL_HEADERS];
    data.harnesses.forEach(h => {
      const input = modifiedInputs.get(h.harnessId) || h.input;
      input.bom.forEach(item => {
        if (item.itemCategory !== 'wire') {
          secondaryData.push([
            h.harnessName, item.partName, item.qty, item.unit, item.unitPrice, 0, 0, item.supplier || '', '', item.sapNo || '', ''
          ]);
        }
      });
    });
    result.push({
      id: 'secondary',
      name: '二次物料明细',
      data: secondaryData,
      columnWidths: [120, 180, 60, 50, 70, 70, 70, 120, 100, 120, 100],
      freezeRows: 1,
    });

    // 4. Config Sheet
    result.push({
      id: 'config',
      name: '配置清单',
      data: [CONFIG_HEADERS],
      columnWidths: [45, 120, 160, 180, 100, 100, 100, 80, 80],
      freezeRows: 1,
    });

    // 5. Assembly Parts sheet
    const assemblyData: (string | number | null)[][] = [ASSEMBLY_PARTS_HEADERS];
    data.harnesses.forEach(h => {
      const input = modifiedInputs.get(h.harnessId) || h.input;
      input.bom.forEach((item, i) => {
        assemblyData.push([
          i + 1, item.functionText || '', item.partNo, item.partName, item.isSemiFinished ? 'Y' : 'N', '', '', '', item.spec || '', item.qty, item.unit, ''
        ]);
      });
    });
    result.push({
      id: 'assembly',
      name: '总成散件清单',
      data: assemblyData,
      columnWidths: [45, 120, 160, 180, 80, 80, 60, 80, 120, 70, 50, 120],
      freezeRows: 1,
    });

    // 6. KSK sheet
    result.push({
      id: 'ksk',
      name: 'KSK线束BOM',
      data: [KSK_HEADERS],
      columnWidths: [160, 180, 120, 160, 180, 60, 120, 100, 70, 50, 100, 120],
      freezeRows: 1,
    });

    // 7. Per-harness BOM sheets
    data.harnesses.forEach(h => {
      const input = modifiedInputs.get(h.harnessId) || h.input;
      result.push({
        id: `bom-${h.harnessId}`,
        name: `${h.harnessId.slice(-4)}-${h.harnessName.slice(0, 6)}`,
        data: bomToArray(input.bom),
        columnWidths: BOM_COL_WIDTHS,
        freezeRows: 1,
      });
    });

    return result;
  }, [data?.harnesses, data?.project, modifiedInputs, resultsMap]);

  // Handle sheet data change
  const handleSheetChange = useCallback((sheetData: (string | number | null)[][], sheetId?: string) => {
    if (!sheetId || !sheetId.startsWith('bom-')) return; // Non-BOM sheets are read-only for now
    const harnessId = sheetId.replace('bom-', '');
    const newBom = arrayToBom(sheetData);
    setModifiedInputs(prev => {
      const next = new Map(prev);
      const existing = next.get(harnessId);
      if (existing) {
        next.set(harnessId, { ...existing, bom: newBom });
      }
      return next;
    });
  }, []);

  // Save all modified harnesses
  const handleSaveAll = useCallback(async () => {
    if (!data?.harnesses) return;
    try {
      const updates: Promise<any>[] = [];
      for (const h of data.harnesses) {
        const modified = modifiedInputs.get(h.harnessId);
        if (modified && JSON.stringify(modified) !== JSON.stringify(h.input)) {
          updates.push(
            db.harnesses.update(h.id, {
              input: modified,
              harnessName: modified.harnessName,
              updatedAt: new Date().toISOString(),
            })
          );
        }
      }
      await Promise.all(updates);
      Toast.success(`已保存 ${updates.length} 个线束`);
    } catch (err) {
      console.error('Save failed:', err);
      Toast.error('保存失败');
    }
  }, [data?.harnesses, modifiedInputs]);

  // Handle BOM import for a specific harness
  const handleImportBom = useCallback((newBom: (BomItem | WireItem)[]) => {
    if (!importTarget) return;
    setModifiedInputs(prev => {
      const next = new Map(prev);
      const existing = next.get(importTarget.harnessId);
      if (existing) {
        next.set(importTarget.harnessId, { ...existing, bom: newBom });
      }
      return next;
    });
    setImportTarget(null);
  }, [importTarget]);

  // Aggregate cost totals
  const totals = useMemo(() => {
    let material = 0, labor = 0, mfg = 0, exFactory = 0, delivered = 0;
    resultsMap.forEach(r => {
      material += r.materialCost;
      labor += r.directLabor;
      mfg += r.manufacturing;
      exFactory += r.exFactoryPrice;
      delivered += r.deliveredPrice;
    });
    return { material, labor, mfg, exFactory, delivered, count: resultsMap.size };
  }, [resultsMap]);

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载项目数据..." />
      </div>
    );
  }

  const { project, harnesses } = data;
  const isEditableSheet = activeSheetId?.startsWith('bom-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Toolbar ── */}
      <div style={{
        height: TOOLBAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--semi-color-border)',
        backgroundColor: 'var(--semi-color-bg-0)',
        zIndex: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}>
        {/* Left: back + project title */}
        <Space spacing={8}>
          <Button
            icon={<IconArrowLeft />}
            theme="borderless"
            onClick={() => navigate(`/project/${id}`)}
          />
          <Text strong style={{ fontSize: 16 }}>
            {project.meta.projectName || project.meta.projectCode} · BOM工作簿
          </Text>
          <Divider layout="vertical" style={{ margin: '0 4px', height: 16 }} />
          
          {isEditableSheet ? (
            <Tag color="green" prefixIcon={<IconEdit />}>当前线束可编辑</Tag>
          ) : (
            <Tooltip content="汇总类表格由系统自动生成，不可直接编辑。请切换至具体线束名称的 Sheet 进行修改。">
              <Tag color="grey" prefixIcon={<IconInfoCircle />}>只读预览</Tag>
            </Tooltip>
          )}

          {isDirty && <Tag color="orange" type="light">有未保存的更改</Tag>}
        </Space>

        {/* Right: actions */}
        <Space spacing={8}>
          {/* Import BOM dropdown — select target harness */}
          <RoleGuard field="bomEdit">
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <Dropdown.Title>选择目标线束</Dropdown.Title>
                  {harnesses.map(h => (
                    <Dropdown.Item
                      key={h.harnessId}
                      onClick={() => setImportTarget({ harnessId: h.harnessId, harnessName: h.harnessName })}
                    >
                      {h.harnessId} — {h.harnessName}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              }
            >
              <Button icon={<IconUpload />} theme="light">导入BOM</Button>
            </Dropdown>
          </RoleGuard>

          {isDirty && (
            <Popconfirm
              title="确定要放弃所有未保存的更改吗？"
              content="放弃后，所有未保存的编辑内容将丢失并恢复到上次保存的状态。"
              onConfirm={() => {
                const fresh = new Map<string, HarnessInput>();
                harnesses.forEach(h => fresh.set(h.harnessId, JSON.parse(JSON.stringify(h.input))));
                setModifiedInputs(fresh);
                Toast.info('已恢复至上次保存的状态');
              }}
            >
              <Button theme="borderless" type="danger">放弃更改</Button>
            </Popconfirm>
          )}

          <RoleGuard field="bomEdit" readOnlyFallback>
            <Button
              icon={<IconSave />}
              type="primary"
              theme="solid"
              disabled={!isDirty}
              onClick={handleSaveAll}
            >
              全部保存
            </Button>
          </RoleGuard>
        </Space>
      </div>

      {/* ── Univer Multi-Sheet Workbook ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <UniverSheet
          sheets={sheets}
          onChange={handleSheetChange}
          onActiveSheetChange={setActiveSheetId}
          height="100%"
          hideToolbar
        />
      </div>

      {/* ── Status Bar ── */}
      <div style={{
        height: STATUS_BAR_HEIGHT,
        backgroundColor: '#0f172a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: '12px',
        color: '#fff'
      }}>
        <Space spacing={24}>
          <Text size="small" style={{ color: '#94a3b8' }}>
            共 <Text strong style={{ color: '#fff' }}>{harnesses.length}</Text> 款线束 | 已加载 <Text strong style={{ color: '#fff' }}>{totals.count}</Text>
          </Text>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text size="small" style={{ color: '#64748b' }}>项目总计估算 :</Text>
            <Text size="small" style={{ color: '#94a3b8' }}>材料: <Text strong style={{ color: '#06b6d4', fontFamily: 'JetBrains Mono' }}>¥{totals.material.toFixed(2)}</Text></Text>
            <Text size="small" style={{ color: '#94a3b8' }}>人工: <Text strong style={{ color: '#fff', fontFamily: 'JetBrains Mono' }}>¥{totals.labor.toFixed(2)}</Text></Text>
            <Text size="small" style={{ color: '#94a3b8' }}>制造: <Text strong style={{ color: '#fff', fontFamily: 'JetBrains Mono' }}>¥{totals.mfg.toFixed(2)}</Text></Text>
            <Text size="small" style={{ color: '#94a3b8' }}>出厂: <Text strong style={{ color: '#fbbf24', fontFamily: 'JetBrains Mono' }}>¥{totals.exFactory.toFixed(2)}</Text></Text>
            <Text size="small" style={{ color: '#94a3b8' }}>到厂: <Text strong style={{ color: '#f87171', fontFamily: 'JetBrains Mono' }}>¥{totals.delivered.toFixed(2)}</Text></Text>
          </div>
        </Space>
      </div>

      {/* ── Import Dialog ── */}
      {importTarget && (
        <BomImportDialog
          visible={!!importTarget}
          projectId={id!}
          harnessId={importTarget.harnessId}
          harnessName={importTarget.harnessName}
          existingBomItems={modifiedInputs.get(importTarget.harnessId)?.bom || []}
          onClose={() => setImportTarget(null)}
          onImport={handleImportBom}
        />
      )}
    </div>
  );
}
