import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Upload,
  Table,
  Select,
  Button,
  Toast,
  Descriptions,
  Typography,
  Space,
  Divider,
  Banner,
} from '@douyinfe/semi-ui';
import { IconUpload, IconTick, IconAlertCircle } from '@douyinfe/semi-icons';
import * as XLSX from 'xlsx';
import { db } from '@/data/db';
import {
  parseBomFromRows,
  parseBomWorkbook,
  parsePackagingFromRows,
  parseProcessHoursFromRows,
  detectBomFormat,
} from '@/engine/bom_parser';
import type { BomItem, WireItem } from '@/types/harness';

const { Text } = Typography;

type SheetType = 'bom' | 'packaging' | 'hours' | 'unknown';

interface SheetMapping {
  name: string;
  type: SheetType;
  rows: any[][];
}

interface ImportSummary {
  successCount: number;
  errorCount: number;
  details: string[];
}

interface MultiImportDialogProps {
  visible: boolean;
  projectId: string;
  scenarioId?: string;
  onClose: () => void;
  onImported: () => void;
}

function buildHarnessInput(harnessId: string, harnessName: string, items: (BomItem | WireItem)[]) {
  return {
    harnessId,
    harnessName,
    vehicleRatio: 1,
    bom: items,
    frontHours: 0,
    backHours: 0,
    packaging: {
      innerBoxCost: 0,
      outerBoxCost: 0,
      palletCost: 0,
      trayDividerCost: 0,
      bubbleWrapCost: 0,
      labelCost: 0,
      subtotal: 0,
    },
    freight: {
      freight: 0,
      excessFreight: 0,
      shortHaul: 0,
      thirdPartyWarehouse: 0,
      storage: 0,
      subtotal: 0,
    },
  };
}

function detectSheetType(name: string, rows: any[][]): SheetType {
  const headers = rows[0]?.map((h) => String(h || '').trim()) || [];
  const headStr = headers.join('|').toLowerCase();
  if (detectBomFormat(headers) !== 'unknown' || /^\d{6,}$/.test(name)) return 'bom';
  if (headStr.includes('内盒') || headStr.includes('外箱') || headStr.includes('托盘') || headStr.includes('innerbox')) return 'packaging';
  if (headStr.includes('工时') || headStr.includes('前工序') || headStr.includes('后工序') || headStr.includes('hours')) return 'hours';
  return 'unknown';
}

function convertParsedItem(item: any): BomItem | WireItem {
  const base: BomItem = {
    partNo: item.partNo,
    partName: item.partName,
    itemCategory: item.itemCategory,
    qty: item.qty,
    unit: item.unit || '个',
    unitPrice: 0,
    amount: 0,
    sapNo: item.sapNo || undefined,
    spec: item.spec || undefined,
    endGroup: item.endGroup || undefined,
    functionText: item.functionText || undefined,
    supplier: item.supplier || undefined,
    isSemiFinished: item.semiFinishedFlag === 'Y' || item.semiFinishedFlag === '是',
  };

  if (item.itemCategory === 'wire') {
    return {
      ...base,
      itemCategory: 'wire',
      copperWeightPerUnit: 0,
      aluminumWeightPerUnit: 0,
      nonMetalCostPerUnit: 0,
    };
  }

  return base;
}

async function findHarness(projectId: string, scenarioId: string | undefined, harnessId: string) {
  if (scenarioId) {
    return db.harnesses.where('[scenarioId+harnessId]').equals([scenarioId, harnessId]).first();
  }
  return db.harnesses.where({ projectId, harnessId }).first();
}

async function upsertHarnessBom(
  projectId: string,
  scenarioId: string | undefined,
  harnessId: string,
  harnessName: string,
  items: (BomItem | WireItem)[],
) {
  const existing = await findHarness(projectId, scenarioId, harnessId);
  const now = new Date().toISOString();

  if (existing) {
    await db.harnesses.update(existing.id, {
      harnessName,
      input: {
        ...existing.input,
        harnessId,
        harnessName,
        bom: items,
      },
      updatedAt: now,
    });
    return 'update' as const;
  }

  await db.harnesses.add({
    id: crypto.randomUUID(),
    projectId,
    scenarioId: scenarioId || '',
    eopYear: null,
    harnessId,
    harnessName,
    input: buildHarnessInput(harnessId, harnessName, items),
    updatedAt: now,
  });
  return 'create' as const;
}

async function updateHarnessPackaging(projectId: string, scenarioId: string | undefined, harnessId: string, packaging: any) {
  const harness = await findHarness(projectId, scenarioId, harnessId);
  if (!harness) return false;
  const subtotal = packaging.innerBoxCost + packaging.outerBoxCost + packaging.palletCost + packaging.trayDividerCost + packaging.bubbleWrapCost + packaging.labelCost;
  await db.harnesses.update(harness.id, {
    input: {
      ...harness.input,
      packaging: { ...packaging, subtotal },
    },
    updatedAt: new Date().toISOString(),
  });
  return true;
}

async function updateHarnessHours(projectId: string, scenarioId: string | undefined, harnessId: string, hours: any) {
  const harness = await findHarness(projectId, scenarioId, harnessId);
  if (!harness) return false;
  await db.harnesses.update(harness.id, {
    input: {
      ...harness.input,
      frontHours: hours.frontHours,
      backHours: hours.backHours,
    },
    updatedAt: new Date().toISOString(),
  });
  return true;
}

function hasWholeWorkbookBom(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.some((name) => /^\d{6,}$/.test(name));
}

export function MultiImportDialog({ visible, projectId, scenarioId, onClose, onImported }: MultiImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setMappings([]);
    setSelectedSheetIndex(null);
    setSummary(null);
    setWorkbook(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFileUpload = (fileList: any[]) => {
    const uploadedFile = fileList[0]?.fileInstance;
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const nextWorkbook = XLSX.read(data, { type: 'array' });
      setWorkbook(nextWorkbook);

      const nextMappings = nextWorkbook.SheetNames.map((name) => {
        const worksheet = nextWorkbook.Sheets[name];
        const rows = worksheet ? (XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]) : [];
        return { name, type: detectSheetType(name, rows), rows };
      });

      setMappings(nextMappings);
      if (nextMappings.length > 0) setSelectedSheetIndex(0);
      setLoading(false);
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleTypeChange = (index: number, type: SheetType) => {
    const nextMappings = [...mappings];
    if (nextMappings[index]) {
      nextMappings[index] = { ...nextMappings[index], type };
      setMappings(nextMappings);
    }
  };

  const previewData = useMemo(() => {
    if (selectedSheetIndex === null || !mappings[selectedSheetIndex]) return [];
    return mappings[selectedSheetIndex].rows.slice(0, 6);
  }, [selectedSheetIndex, mappings]);

  const workbookMode = useMemo(() => workbook ? hasWholeWorkbookBom(workbook) : false, [workbook]);

  const handleImport = async () => {
    if (!workbook || mappings.length === 0) return;

    setLoading(true);
    const details: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      if (workbookMode) {
        const parsed = parseBomWorkbook(workbook, {
          projectCode: projectId,
          releaseLabel: file?.name || 'Workbook Import',
        });

        const grouped = new Map<string, { harnessName: string; items: (BomItem | WireItem)[] }>();
        parsed.headers.forEach((header) => {
          grouped.set(header.harnessNo, {
            harnessName: header.harnessName || header.harnessNo,
            items: [],
          });
        });
        parsed.items.forEach((item) => {
          const current = grouped.get(item.harnessNo) || { harnessName: item.harnessNo, items: [] };
          current.items.push(convertParsedItem(item));
          grouped.set(item.harnessNo, current);
        });

        if (grouped.size === 0) {
          Toast.warning('未识别到任何可导入的线束 BOM Sheet');
          setLoading(false);
          return;
        }

        for (const [harnessId, group] of grouped.entries()) {
          const action = await upsertHarnessBom(projectId, scenarioId, harnessId, group.harnessName, group.items);
          details.push(`${action === 'create' ? '新增' : '更新'}线束 BOM: ${harnessId} (${group.items.length} 条)`);
          successCount += 1;
        }

        const packagingSheets = mappings.filter((m) => m.type === 'packaging');
        for (const sheet of packagingSheets) {
          const result = parsePackagingFromRows(sheet.rows);
          if (result.errors.length > 0) {
            details.push(`Sheet [${sheet.name}] 包装解析错误: ${result.errors.join(', ')}`);
            errorCount += result.errors.length;
          }
          for (const [harnessId, packaging] of Object.entries(result.items)) {
            const ok = await updateHarnessPackaging(projectId, scenarioId, harnessId, packaging);
            details.push(ok ? `更新线束包装费: ${harnessId}` : `未找到线束 ${harnessId}，跳过包装费导入`);
            if (ok) successCount += 1;
            else errorCount += 1;
          }
        }

        const hourSheets = mappings.filter((m) => m.type === 'hours');
        for (const sheet of hourSheets) {
          const result = parseProcessHoursFromRows(sheet.rows);
          if (result.errors.length > 0) {
            details.push(`Sheet [${sheet.name}] 工时解析错误: ${result.errors.join(', ')}`);
            errorCount += result.errors.length;
          }
          for (const [harnessId, hours] of Object.entries(result.items)) {
            const ok = await updateHarnessHours(projectId, scenarioId, harnessId, hours);
            details.push(ok ? `更新线束工时: ${harnessId}` : `未找到线束 ${harnessId}，跳过工时导入`);
            if (ok) successCount += 1;
            else errorCount += 1;
          }
        }

        setSummary({ successCount, errorCount, details });
        Toast.success('整本 BOM 已按线束自动导入');
        onImported();
        setLoading(false);
        return;
      }

      const bomSheets = mappings.filter((m) => m.type === 'bom');
      const packagingSheets = mappings.filter((m) => m.type === 'packaging');
      const hourSheets = mappings.filter((m) => m.type === 'hours');

      for (const sheet of bomSheets) {
        const result = parseBomFromRows(sheet.rows);
        if (result.errors.length > 0) {
          details.push(`Sheet [${sheet.name}] BOM 解析错误: ${result.errors.join(', ')}`);
          errorCount += result.errors.length;
        }
        if (result.items.length > 0) {
          const action = await upsertHarnessBom(projectId, scenarioId, sheet.name, sheet.name, result.items);
          details.push(`${action === 'create' ? '新增' : '更新'}线束 BOM: ${sheet.name}`);
          successCount += 1;
        }
      }

      for (const sheet of packagingSheets) {
        const result = parsePackagingFromRows(sheet.rows);
        if (result.errors.length > 0) {
          details.push(`Sheet [${sheet.name}] 包装解析错误: ${result.errors.join(', ')}`);
          errorCount += result.errors.length;
        }
        for (const [harnessId, packaging] of Object.entries(result.items)) {
          const ok = await updateHarnessPackaging(projectId, scenarioId, harnessId, packaging);
          details.push(ok ? `更新线束包装费: ${harnessId}` : `未找到线束 ${harnessId}，跳过包装费导入`);
          if (ok) successCount += 1;
          else errorCount += 1;
        }
      }

      for (const sheet of hourSheets) {
        const result = parseProcessHoursFromRows(sheet.rows);
        if (result.errors.length > 0) {
          details.push(`Sheet [${sheet.name}] 工时解析错误: ${result.errors.join(', ')}`);
          errorCount += result.errors.length;
        }
        for (const [harnessId, hours] of Object.entries(result.items)) {
          const ok = await updateHarnessHours(projectId, scenarioId, harnessId, hours);
          details.push(ok ? `更新线束工时: ${harnessId}` : `未找到线束 ${harnessId}，跳过工时导入`);
          if (ok) successCount += 1;
          else errorCount += 1;
        }
      }

      setSummary({ successCount, errorCount, details });
      Toast.success('导入完成');
      onImported();
    } catch (error: any) {
      console.error(error);
      Toast.error(`导入失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sheetColumns = [
    {
      title: '工作表名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '识别类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string, _record: SheetMapping, index: number) => (
        <Select value={text} onChange={(v) => handleTypeChange(index, v as SheetType)} style={{ width: 140 }}>
          <Select.Option value="bom">BOM 物料</Select.Option>
          <Select.Option value="packaging">包装费用</Select.Option>
          <Select.Option value="hours">工时数据</Select.Option>
          <Select.Option value="unknown">未识别</Select.Option>
        </Select>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, __: any, index: number) => (
        <Button theme="borderless" onClick={() => setSelectedSheetIndex(index)}>
          预览
        </Button>
      ),
    },
  ];

  const meta = useMemo(() => ([
    { key: '文件名', value: file?.name || '-' },
    { key: 'Sheet 数量', value: mappings.length },
    { key: '导入模式', value: workbookMode ? '整本 BOM 自动分发' : '按 Sheet 解析' },
  ]), [file, mappings.length, workbookMode]);

  return (
    <Modal
      title="Excel 一键导入 (整本BOM + 包装 + 工时)"
      visible={visible}
      onCancel={handleClose}
      width={900}
      footer={
        <Space>
          <Button onClick={handleClose}>关闭</Button>
          <Button type="primary" theme="solid" disabled={mappings.length === 0 || loading} onClick={handleImport} loading={loading}>
            开始导入
          </Button>
        </Space>
      }
    >
      {!file ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Upload action="" beforeUpload={({ fileList }) => {
            handleFileUpload(fileList);
            return false;
          }} showUploadList={false} accept=".xlsx, .xls">
            <Button icon={<IconUpload />} theme="light" size="large">
              选择 Excel 文件
            </Button>
          </Upload>
          <div style={{ marginTop: 16 }}>
            <Text type="tertiary">支持包含多个 Sheet 的 Excel 文件，系统将自动识别整本 BOM、包装费和工时数据</Text>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Descriptions data={meta} />

          {workbookMode && (
            <Banner
              type="info"
              icon={<IconTick />}
              title="整本 BOM 自动分发"
              description="已识别到以线束号命名的 sheet，导入时会自动按线束号把整本 BOM 分发到对应线束。"
            />
          )}

          <Divider margin={12}>Sheet 类型识别与映射</Divider>
          <Table columns={sheetColumns} dataSource={mappings} pagination={false} size="small" rowKey="name" />

          {selectedSheetIndex !== null && (
            <>
              <Divider margin={12}>预览: {mappings[selectedSheetIndex]?.name} (前 5 行)</Divider>
              <div style={{ overflowX: 'auto', background: 'var(--semi-color-bg-1)', padding: 8, borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell: any, j: number) => (
                          <td key={j} style={{ border: '1px solid var(--semi-color-border)', padding: '4px 8px' }}>
                            {String(cell ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {summary && (
            <>
              <Divider margin={12}>导入结果摘要</Divider>
              <div style={{ padding: 16, background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
                <Space vertical align="start" style={{ width: '100%' }}>
                  <Text strong>
                    成功: <Text type="success">{summary.successCount}</Text> |
                    失败: <Text type="danger">{summary.errorCount}</Text>
                  </Text>
                  <div style={{ maxHeight: 220, overflowY: 'auto', width: '100%', fontSize: 12 }}>
                    {summary.details.map((detail, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        {detail.includes('错误') || detail.includes('失败') || detail.includes('跳过') ? (
                          <IconAlertCircle style={{ color: 'var(--semi-color-danger)', marginRight: 4 }} size="small" />
                        ) : (
                          <IconTick style={{ color: 'var(--semi-color-success)', marginRight: 4 }} size="small" />
                        )}
                        {detail}
                      </div>
                    ))}
                  </div>
                </Space>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
