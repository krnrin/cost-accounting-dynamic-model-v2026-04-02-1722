import React, { useState, useEffect } from 'react';
import {
  Modal,
  Upload,
  Table,
  Tag,
  Radio,
  RadioGroup,
  Button,
  Toast,
  Typography,
  Space,
  Banner,
  Empty,
  Divider,
} from '@douyinfe/semi-ui';
import {
  IconUpload,
  IconTickCircle,
  IconAlertCircle,
  IconFile,
} from '@douyinfe/semi-icons';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { parseBomFromRows, type BomFormat, type BomParseResult } from '@/engine/bom_parser';
import type { BomItem, WireItem } from '@/types/harness';
import { importLogRepo } from '@/data/repositories';
import type { ImportLogRecord } from '@/data/db';
import VirtualList from './VirtualList';

const { Title, Text } = Typography;

interface BomImportDialogProps {
  visible: boolean;
  projectId: string;
  harnessId: string;
  harnessName: string;
  existingBomItems: (BomItem | WireItem)[];
  onClose: () => void;
  onImport: (items: (BomItem | WireItem)[]) => void;
}

type ConflictAction = 'overwrite' | 'skip';

interface ParsedItemWrapper {
  item: BomItem | WireItem;
  isConflict: boolean;
  action: ConflictAction;
}

export const BomImportDialog: React.FC<BomImportDialogProps> = ({
  visible,
  projectId,
  harnessId,
  existingBomItems,
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<BomParseResult | null>(null);
  const [itemWrappers, setItemWrappers] = useState<ParsedItemWrapper[]>([]);
  const [importHistory, setImportHistory] = useState<ImportLogRecord[]>([]);

  useEffect(() => {
    if (visible) {
      loadHistory();
      resetState();
    }
  }, [visible, harnessId]);

  const loadHistory = async () => {
    try {
      const history = await importLogRepo.listByHarness(harnessId);
      setImportHistory(history);
    } catch (err) {
      console.error('Failed to load import history', err);
    }
  };

  const resetState = () => {
    setFile(null);
    setParseResult(null);
    setItemWrappers([]);
  };

  const handleFileUpload = async (fileList: any[]) => {
    const f = fileList[0]?.fileInstance;
    if (!f) return;
    setFile(f);

    try {
      const arrayBuffer = await f.arrayBuffer();
      const workbook = xlsxRead(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        Toast.error('Excel 文件无工作表');
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        Toast.error('工作表内容无效');
        return;
      }
      const rows = xlsxUtils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const result = parseBomFromRows(rows);
      setParseResult(result);

      // Conflict detection
      const wrappers: ParsedItemWrapper[] = result.items.map(item => {
        const isConflict = existingBomItems.some(existing => {
          if (item.partNo && item.partNo !== '') {
            return existing.partNo === item.partNo;
          }
          // Fallback matching: partName + spec
          return existing.partName === item.partName && (existing.spec || '') === (item.spec || '');
        });
        return {
          item,
          isConflict,
          action: isConflict ? 'skip' : 'overwrite' as ConflictAction,
        };
      });
      setItemWrappers(wrappers);
    } catch (err) {
      console.error('File parse failed', err);
      Toast.error('文件解析失败');
    }
  };

  const handleActionChange = (index: number, action: ConflictAction) => {
    const nextWrappers = [...itemWrappers];
    const target = nextWrappers[index];
    if (target) {
      nextWrappers[index] = { ...target, action };
      setItemWrappers(nextWrappers);
    }
  };

  const handleBatchAction = (action: ConflictAction) => {
    const nextWrappers = itemWrappers.map(w => w.isConflict ? { ...w, action } : w);
    setItemWrappers(nextWrappers);
  };

  const handleImport = async () => {
    if (!parseResult) return;
    const itemsToImport = itemWrappers
      .filter(w => w.action === 'overwrite')
      .map(w => w.item);

    if (itemsToImport.length === 0) {
      Toast.warning('没有可导入的物料');
      return;
    }

    // Merge logic: Replace existing if matched, otherwise add
    const finalItems = [...existingBomItems];
    itemsToImport.forEach(newItem => {
      const existingIndex = finalItems.findIndex(existing => {
        if (newItem.partNo && newItem.partNo !== '') {
          return existing.partNo === newItem.partNo;
        }
        return existing.partName === newItem.partName && (existing.spec || '') === (newItem.spec || '');
      });

      if (existingIndex > -1) {
        finalItems[existingIndex] = newItem;
      } else {
        finalItems.push(newItem);
      }
    });

    onImport(finalItems);

    // Save log
    const log: ImportLogRecord = {
      id: crypto.randomUUID(),
      projectId,
      harnessId,
      fileName: file?.name || 'unknown',
      importedAt: new Date().toISOString(),
      totalRows: parseResult?.totalRows || 0,
      successRows: itemsToImport.length,
      skippedRows: (parseResult?.totalRows || 0) - itemsToImport.length,
      errors: parseResult?.errors || [],
    };
    await importLogRepo.create(log);
    
    Toast.success(`成功导入 ${itemsToImport.length} 条物料`);
    onClose();
  };

  const columns = [
    {
      title: '物料编号',
      dataIndex: 'item.partNo',
      render: (_: any, record: ParsedItemWrapper) => (
        <Space>
          <Text>{record.item.partNo}</Text>
          {record.isConflict && <Tag color="orange">已存在</Tag>}
        </Space>
      ),
    },
    {
      title: '物料名称',
      dataIndex: 'item.partName',
      render: (_: any, record: ParsedItemWrapper) => (
        <Space>
          <Text>{record.item.partName}</Text>
          {!record.item.partNo && <Text type="warning" size="small">(无零件号)</Text>}
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'item.itemCategory',
      render: (_: any, record: ParsedItemWrapper) => <Tag>{record.item.itemCategory}</Tag>,
    },
    {
      title: '冲突处理',
      render: (_: any, record: ParsedItemWrapper, index: number) => {
        if (!record.isConflict) return <Text type="success">新增</Text>;
        return (
          <RadioGroup 
            value={record.action} 
            onChange={(e) => handleActionChange(index, e.target.value as ConflictAction)}
            type="button"
          >
            <Radio value="overwrite">覆盖</Radio>
            <Radio value="skip">跳过</Radio>
          </RadioGroup>
        );
      },
    },
  ];

  const historyColumns = [
    {
      title: '导入时间',
      dataIndex: 'importedAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '文件名',
      dataIndex: 'fileName',
    },
    {
      title: '成功/总行数',
      render: (_: any, record: ImportLogRecord) => `${record.successRows}/${record.totalRows}`,
    },
  ];

  const formatLabels: Record<BomFormat, string> = {
    geely: '吉利标准',
    byd: '比亚迪标准',
    generic: '通用格式',
    unknown: '未知格式',
  };

  return (
    <Modal
      title="导入 BOM 物料清单"
      visible={visible}
      onCancel={onClose}
      width={900}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            theme="solid" 
            disabled={!itemWrappers.length} 
            onClick={handleImport}
          >
            开始导入 ({itemWrappers.filter(w => w.action === 'overwrite').length} 项)
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!parseResult ? (
          <Upload
            action=""
            beforeUpload={() => false}
            onChange={({ fileList }) => handleFileUpload(fileList)}
            dragIcon={<IconUpload size="extra-large" />}
            draggable={true}
            accept=".xlsx,.xls,.csv"
          >
            <div style={{ textAlign: 'center' }}>
              <Title heading={5}>点击或拖拽 Excel 文件到此处</Title>
              <Text type="secondary">支持 吉利标准、比亚迪标准 及 通用格式</Text>
            </div>
          </Upload>
        ) : (
          <>
            <Banner
              fullMode={false}
              type="info"
              icon={<IconTickCircle />}
              title={`检测到格式: ${formatLabels[parseResult.format]}`}
              description={`共解析到 ${parseResult.totalRows} 行数据，成功识别 ${parseResult.successRows} 条物料。`}
              closeIcon={null}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>共 {itemWrappers.length} 条物料，其中 {itemWrappers.filter(w => w.isConflict).length} 条存在冲突</Text>
              {itemWrappers.some(w => w.isConflict) && (
                <Space>
                  <Button size="small" onClick={() => handleBatchAction('overwrite')}>全部覆盖</Button>
                  <Button size="small" onClick={() => handleBatchAction('skip')}>全部跳过</Button>
                </Space>
              )}
            </div>

            {itemWrappers.length > 30 ? (
              <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 4 }}>
                 {/* Simple header */}
                 <div style={{ display: 'flex', background: 'var(--semi-color-fill-0)', padding: '8px 16px', fontWeight: 'bold', borderBottom: '1px solid var(--semi-color-border)' }}>
                    <div style={{ flex: 2 }}>物料编号</div>
                    <div style={{ flex: 2 }}>物料名称</div>
                    <div style={{ flex: 1 }}>分类</div>
                    <div style={{ flex: 2 }}>冲突处理</div>
                 </div>
                 <VirtualList
                   items={itemWrappers}
                   estimateSize={40}
                   containerHeight={400}
                   renderItem={(record, index) => (
                     <div style={{ display: 'flex', padding: '8px 16px', borderBottom: '1px solid var(--semi-color-border)', alignItems: 'center' }}>
                        <div style={{ flex: 2 }}>
                          <Space>
                            <Text>{record.item.partNo}</Text>
                            {record.isConflict && <Tag color="orange">已存在</Tag>}
                          </Space>
                        </div>
                        <div style={{ flex: 2 }}>
                          <Space>
                            <Text>{record.item.partName}</Text>
                            {!record.item.partNo && <Text type="warning" size="small">(无零件号)</Text>}
                          </Space>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Tag>{record.item.itemCategory}</Tag>
                        </div>
                        <div style={{ flex: 2 }}>
                          {!record.isConflict ? (
                            <Text type="success">新增</Text>
                          ) : (
                            <RadioGroup 
                              value={record.action} 
                              onChange={(e) => handleActionChange(index, e.target.value as ConflictAction)}
                              type="button"
                            >
                              <Radio value="overwrite">覆盖</Radio>
                              <Radio value="skip">跳过</Radio>
                            </RadioGroup>
                          )}
                        </div>
                     </div>
                   )}
                 />
              </div>
            ) : (
              <Table
                dataSource={itemWrappers}
                columns={columns}
                pagination={false}
                size="small"
              />
            )}

            {parseResult.errors.length > 0 && (
              <Banner
                type="danger"
                icon={<IconAlertCircle />}
                title="解析过程中出现错误"
                description={
                  <ul>
                    {parseResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {parseResult.errors.length > 5 && <li>...等共 {parseResult.errors.length} 个错误</li>}
                  </ul>
                }
              />
            )}
            
            <Button icon={<IconFile />} theme="light" onClick={resetState}>重新上传</Button>
          </>
        )}

        <Divider />
        
        <div>
          <Title heading={6} style={{ marginBottom: 12 }}>最近导入记录</Title>
          {importHistory.length > 0 ? (
            <Table
              dataSource={importHistory}
              columns={historyColumns}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          ) : (
            <Empty description="暂无导入记录" />
          )}
        </div>
      </div>
    </Modal>
  );
};
