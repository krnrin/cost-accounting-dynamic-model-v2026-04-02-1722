/**
 * SmartPasteIntegration — BomWorkbookPage 的智能粘贴集成面板
 *
 * 独立组件，避免修改 BomWorkbookPage.tsx（41KB）。
 * 在 BomWorkbookPage 中嵌入此组件即可获得智能粘贴能力。
 *
 * 用法：
 *   import SmartPasteIntegration from '@/components/SmartPasteIntegration';
 *   <SmartPasteIntegration
 *     targetColumns={BOM_TARGET_COLUMNS}
 *     onApply={(rows, mappings) => applyToGrid(rows, mappings)}
 *   />
 *
 * Issue: #98
 */
import { useCallback, useRef, useState } from 'react';
import { Button, Modal, Table, Tag, Toast, Typography, Space, Empty } from '@douyinfe/semi-ui';
import { IconCopy, IconTick, IconClose } from '@douyinfe/semi-icons';
import { useSmartPaste, BOM_TARGET_COLUMNS, type SmartPastePreview } from '@/hooks/useSmartPaste';

const { Text, Title } = Typography;

export interface SmartPasteIntegrationProps {
  /** 目标列名（用于自动映射），默认 BOM_TARGET_COLUMNS */
  targetColumns?: string[];
  /** 粘贴确认后的回调，由父页面负责写入表格 */
  onApply: (rows: Record<string, string>[], mappings: any) => void;
  /** 可选：隐藏触发按钮（由父组件自行控制 onPaste） */
  hideTrigger?: boolean;
}

/** 映射置信度颜色 */
function confidenceColor(score: number): string {
  if (score >= 0.8) return 'green';
  if (score >= 0.5) return 'orange';
  return 'red';
}

export default function SmartPasteIntegration({
  targetColumns = BOM_TARGET_COLUMNS,
  onApply,
  hideTrigger = false,
}: SmartPasteIntegrationProps) {
  const paste = useSmartPaste(targetColumns);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputVisible, setInputVisible] = useState(false);

  const handleManualPaste = useCallback(() => {
    const text = textareaRef.current?.value ?? '';
    if (!text.trim()) {
      Toast.warning('请先粘贴表格内容');
      return;
    }
    const result = paste.handlePaste(text);
    if (!result.success) {
      Toast.error(result.error || '解析失败');
    }
    setInputVisible(false);
  }, [paste]);

  const handleConfirm = useCallback(() => {
    const data = paste.confirmPaste();
    if (data && data.rows.length > 0) {
      onApply(data.rows, data.mappings);
      Toast.success(`已应用 ${data.rowCount} 行数据`);
    }
  }, [paste, onApply]);

  // Build preview columns from headers + mappings
  const previewColumns = paste.preview
    ? paste.preview.headers.map((header, idx) => {
        const mapping = Array.isArray(paste.preview!.mappings)
          ? paste.preview!.mappings.find((m: any) => m.sourceIndex === idx || m.sourceHeader === header)
          : null;
        return {
          title: (
            <div>
              <div>{header}</div>
              {mapping && (
                <Tag size="small" color={confidenceColor(mapping.confidence ?? 0)}>
                  → {mapping.targetColumn}
                </Tag>
              )}
            </div>
          ),
          dataIndex: header,
          width: 140,
        };
      })
    : [];

  return (
    <>
      {/* Trigger button */}
      {!hideTrigger && (
        <Button
          icon={<IconCopy />}
          onClick={() => setInputVisible(true)}
          theme="light"
        >
          智能粘贴
        </Button>
      )}

      {/* Input modal */}
      <Modal
        title="智能粘贴 — 粘贴表格数据"
        visible={inputVisible}
        onCancel={() => setInputVisible(false)}
        onOk={handleManualPaste}
        okText="解析"
        cancelText="取消"
        width={600}
      >
        <Text type="tertiary" style= marginBottom: 8, display: 'block' >
          从 Excel / WPS 复制表格内容，粘贴到下方文本框。支持 TSV 格式，自动识别中/英/德表头。
        </Text>
        <textarea
          ref={textareaRef}
          placeholder="在此粘贴表格内容（Ctrl+V）..."
          style=
            width: '100%',
            minHeight: 200,
            fontFamily: 'monospace',
            fontSize: 13,
            padding: 12,
            border: '1px solid var(--semi-color-border)',
            borderRadius: 6,
            resize: 'vertical',
          
        />
      </Modal>

      {/* Preview modal */}
      <Modal
        title={`智能粘贴预览 — ${paste.preview?.rowCount ?? 0} 行`}
        visible={paste.isPreviewing}
        onCancel={paste.cancelPaste}
        width={900}
        footer={
          <Space>
            <Button icon={<IconClose />} onClick={paste.cancelPaste}>取消</Button>
            <Button icon={<IconTick />} theme="solid" type="primary" onClick={handleConfirm}>
              确认应用 ({paste.preview?.rowCount ?? 0} 行)
            </Button>
          </Space>
        }
      >
        {paste.preview && paste.preview.rows.length > 0 ? (
          <>
            <div style= marginBottom: 12 >
              <Text type="tertiary">列映射结果（绿色=高置信，橙色=中等，红色=低置信）</Text>
            </div>
            <Table
              columns={previewColumns}
              dataSource={paste.preview.rows.slice(0, 50)}
              rowKey={(_, idx) => String(idx)}
              pagination={false}
              size="small"
              scroll= x: previewColumns.length * 140 
            />
            {paste.preview.rows.length > 50 && (
              <Text type="tertiary" style= marginTop: 8, display: 'block' >
                仅显示前 50 行，共 {paste.preview.rowCount} 行
              </Text>
            )}
          </>
        ) : (
          <Empty description="无数据" />
        )}
      </Modal>
    </>
  );
}
