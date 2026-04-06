import { useState, useCallback, useMemo } from 'react';
import { 
  Modal, Upload, Table, Select, Button, Toast, 
  Descriptions, Typography, Space, Divider
} from '@douyinfe/semi-ui';
import { IconUpload, IconTick, IconAlertCircle } from '@douyinfe/semi-icons';
import * as XLSX from 'xlsx';
import { db } from '@/data/db';
import { 
  parseBomFromRows, 
  parsePackagingFromRows, 
  parseProcessHoursFromRows,
  detectBomFormat
} from '@/engine/bom_parser';

const { Text } = Typography;

interface MultiImportDialogProps {
  visible: boolean;
  projectId: string;
  onClose: () => void;
  onImported: () => void;
}

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

export function MultiImportDialog({ visible, projectId, onClose, onImported }: MultiImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setMappings([]);
    setSelectedSheetIndex(null);
    setSummary(null);
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
      const workbook = XLSX.read(data, { type: 'array' });
      
      const newMappings: SheetMapping[] = workbook.SheetNames.map((name) => {
        const worksheet = workbook.Sheets[name];
        if (!worksheet) return { name, type: 'unknown', rows: [] };
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const headers = rows[0]?.map(h => String(h || '').trim()) || [];
        
        // Auto detection logic
        let type: SheetType = 'unknown';
        const headStr = headers.join('|').toLowerCase();
        
        if (detectBomFormat(headers) !== 'unknown') {
          type = 'bom';
        } else if (headStr.includes('内盒') || headStr.includes('外箱') || headStr.includes('托盘') || headStr.includes('innerbox')) {
          type = 'packaging';
        } else if (headStr.includes('工时') || headStr.includes('前工序') || headStr.includes('后工序') || headStr.includes('hours')) {
          type = 'hours';
        }

        return { name, type, rows };
      });

      setMappings(newMappings);
      if (newMappings.length > 0) setSelectedSheetIndex(0);
      setLoading(false);
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleTypeChange = (index: number, type: SheetType) => {
    const newMappings = [...mappings];
    const mapping = newMappings[index];
    if (mapping) {
      mapping.type = type;
      setMappings(newMappings);
    }
  };

  const previewData = useMemo(() => {
    if (selectedSheetIndex === null || !mappings[selectedSheetIndex]) return [];
    return mappings[selectedSheetIndex].rows.slice(0, 6); // Header + 5 rows
  }, [selectedSheetIndex, mappings]);

  const handleImport = async () => {
    if (mappings.length === 0) return;
    setLoading(true);
    const importDetails: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      const bomSheets = mappings.filter(m => m.type === 'bom');
      const packagingSheets = mappings.filter(m => m.type === 'packaging');
      const hoursSheets = mappings.filter(m => m.type === 'hours');

      // 1. Process BOMs (create/update harnesses)
      for (const sheet of bomSheets) {
        const result = parseBomFromRows(sheet.rows);
        if (result.errors.length > 0) {
          importDetails.push(`Sheet [${sheet.name}] BOM 解析错误: ${result.errors.join(', ')}`);
          errorCount += result.errors.length;
        }

        if (result.items.length > 0) {
          // Group by harnessId if possible, or use sheet name as fallback
          // For now, parseBomFromRows doesn't return harnessId per item explicitly, 
          // it assumes one sheet = one harness or uses generic format.
          // Let's assume for MultiImport, each BOM sheet might be one harness if it's Geely/BYD,
          // OR if it's Generic, it might have many.
          
          // Actually, parseBomFromRows returns a flat list of items. 
          // If it's multiple harnesses, they should be identified by some field.
          // In this project, HarnessRecord.harnessId is the key.
          
          // Let's check if the items have a harnessId or similar.
          // If not, we use the sheet name as harnessId.
          
          const harnessId = sheet.name; // Fallback
          const existing = await db.harnesses.where({ projectId, harnessId }).first();
          
          const input = {
            harnessId,
            harnessName: harnessId,
            vehicleRatio: 1,
            bom: result.items,
            frontHours: 0,
            backHours: 0,
            packaging: {
              innerBoxCost: 0,
              outerBoxCost: 0,
              palletCost: 0,
              trayDividerCost: 0,
              bubbleWrapCost: 0,
              labelCost: 0,
              subtotal: 0
            },
            freight: {
              freight: 0,
              excessFreight: 0,
              shortHaul: 0,
              thirdPartyWarehouse: 0,
              storage: 0,
              subtotal: 0
            }
          };

          if (existing) {
            await db.harnesses.update(existing.id, {
              input: { ...existing.input, bom: result.items },
              updatedAt: new Date().toISOString()
            });
            importDetails.push(`更新线束 BOM: ${harnessId}`);
          } else {
            await db.harnesses.add({
              id: crypto.randomUUID(),
              projectId,
              harnessId,
              harnessName: harnessId,
              input,
              updatedAt: new Date().toISOString()
            });
            importDetails.push(`新增线束: ${harnessId}`);
          }
          successCount++;
        }
      }

      // 2. Process Packaging
      for (const sheet of packagingSheets) {
        const result = parsePackagingFromRows(sheet.rows);
        if (result.errors.length > 0) {
          importDetails.push(`Sheet [${sheet.name}] 包装解析错误: ${result.errors.join(', ')}`);
          errorCount += result.errors.length;
        }

        for (const [partNo, pkg] of Object.entries(result.items)) {
          const harness = await db.harnesses.where({ projectId, harnessId: partNo }).first();
          if (harness) {
            const subtotal = pkg.innerBoxCost + pkg.outerBoxCost + pkg.palletCost + pkg.trayDividerCost + pkg.bubbleWrapCost + pkg.labelCost;
            await db.harnesses.update(harness.id, {
              'input.packaging': { ...pkg, subtotal },
              updatedAt: new Date().toISOString()
            });
            importDetails.push(`更新线束包装费: ${partNo}`);
            successCount++;
          } else {
            importDetails.push(`未找到线束 ${partNo}，跳过包装费导入`);
            errorCount++;
          }
        }
      }

      // 3. Process Hours
      for (const sheet of hoursSheets) {
        const result = parseProcessHoursFromRows(sheet.rows);
        if (result.errors.length > 0) {
          importDetails.push(`Sheet [${sheet.name}] 工时解析错误: ${result.errors.join(', ')}`);
          errorCount += result.errors.length;
        }

        for (const [partNo, hours] of Object.entries(result.items)) {
          const harness = await db.harnesses.where({ projectId, harnessId: partNo }).first();
          if (harness) {
            await db.harnesses.update(harness.id, {
              'input.frontHours': hours.frontHours,
              'input.backHours': hours.backHours,
              updatedAt: new Date().toISOString()
            });
            importDetails.push(`更新线束工时: ${partNo}`);
            successCount++;
          } else {
            importDetails.push(`未找到线束 ${partNo}，跳过工时导入`);
            errorCount++;
          }
        }
      }

      setSummary({ successCount, errorCount, details: importDetails });
      Toast.success('导入完成');
      onImported();
    } catch (err: any) {
      console.error(err);
      Toast.error(`导入失败: ${err.message}`);
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
        <Select 
          value={text} 
          onChange={(v) => handleTypeChange(index, v as SheetType)}
          style={{ width: 120 }}
        >
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

  return (
    <Modal
      title="Excel 一键导入 (BOM + 包装 + 工时)"
      visible={visible}
      onCancel={handleClose}
      width={900}
      footer={
        <Space>
          <Button onClick={handleClose}>关闭</Button>
          <Button 
            type="primary" 
            theme="solid" 
            disabled={mappings.length === 0 || loading}
            onClick={handleImport}
            loading={loading}
          >
            开始导入
          </Button>
        </Space>
      }
    >
      {!file ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Upload
            action=""
            beforeUpload={({ fileList }) => {
              handleFileUpload(fileList);
              return false;
            }}
            showUploadList={false}
            accept=".xlsx, .xls"
          >
            <Button icon={<IconUpload />} theme="light" size="large">
              选择 Excel 文件
            </Button>
          </Upload>
          <div style={{ marginTop: 16 }}>
            <Text type="tertiary">支持包含多个 Sheet 的 Excel 文件，系统将自动识别 BOM、包装费和工时数据</Text>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Descriptions
            data={[
              { key: '文件名', value: file.name },
              { key: 'Sheet 数量', value: mappings.length },
            ]}
          />
          
          <Divider margin={12}>Sheet 类型识别与映射</Divider>
          <Table 
            columns={sheetColumns} 
            dataSource={mappings} 
            pagination={false} 
            size="small"
            rowKey="name"
          />

          {selectedSheetIndex !== null && (
            <>
              <Divider margin={12}>
                预览: {mappings[selectedSheetIndex]?.name} (前 5 行)
              </Divider>
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
                  <div style={{ maxHeight: 200, overflowY: 'auto', width: '100%', fontSize: 12 }}>
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
