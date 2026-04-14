/**
 * useSmartPaste — 智能粘贴 hook
 *
 * 桥接 engine/smart_paste 到页面层
 * 为 BomWorkbookPage / HarnessEditPage 提供：
 *   - 剖贴板 TSV 解析
 *   - 自动列映射（支持中/英/德表头）
 *   - 粘贴预览 + 确认流程
 *
 * 集成方式（BomWorkbookPage.tsx）：
 *   import { useSmartPaste } from '@/hooks/useSmartPaste';
 *   const paste = useSmartPaste(BOM_TARGET_COLUMNS);
 *   // 在 onPaste handler 中：
 *   //   const result = paste.handlePaste(clipboardText);
 *   //   if (result.success) showPreviewModal(result.preview);
 */
import { useCallback, useState } from 'react';
import {
  smartPaste,
  parseClipboardTable,
  guessColumnMappings,
} from '@/engine/smart_paste';

export interface SmartPastePreview {
  /** 解析后的行数据 */
  rows: Record<string, string>[];
  /** 列映射结果 */
  mappings: ReturnType<typeof guessColumnMappings>;
  /** 原始表头 */
  headers: string[];
  /** 总行数 */
  rowCount: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 智能粘贴 hook
 * @param targetColumns 目标列定义（传给 guessColumnMappings 用于自动匹配）
 */
export function useSmartPaste(targetColumns?: string[]) {
  const [preview, setPreview] = useState<SmartPastePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  /**
   * 处理粘贴事件
   * @param clipboardText 剖贴板文本（通常是 TSV 格式）
   */
  const handlePaste = useCallback(
    (clipboardText: string): SmartPastePreview => {
      try {
        if (!clipboardText || !clipboardText.trim()) {
          const empty: SmartPastePreview = {
            rows: [],
            mappings: [] as any,
            headers: [],
            rowCount: 0,
            success: false,
            error: '粘贴内容为空',
          };
          return empty;
        }

        const rows = parseClipboardTable(clipboardText);
        const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
        const mappings = targetColumns
          ? guessColumnMappings(headers)
          : ([] as any);

        const result: SmartPastePreview = {
          rows,
          mappings,
          headers,
          rowCount: rows.length,
          success: true,
        };

        setPreview(result);
        setIsPreviewing(true);
        return result;
      } catch (err) {
        const errResult: SmartPastePreview = {
          rows: [],
          mappings: [] as any,
          headers: [],
          rowCount: 0,
          success: false,
          error: err instanceof Error ? err.message : '解析失败',
        };
        return errResult;
      }
    },
    [targetColumns],
  );

  /**
   * 确认粘贴（应用到表格）
   */
  const confirmPaste = useCallback(() => {
    const current = preview;
    setIsPreviewing(false);
    setPreview(null);
    return current;
  }, [preview]);

  /**
   * 取消粘贴
   */
  const cancelPaste = useCallback(() => {
    setIsPreviewing(false);
    setPreview(null);
  }, []);

  return {
    /** 处理粘贴文本 */
    handlePaste,
    /** 确认应用 */
    confirmPaste,
    /** 取消 */
    cancelPaste,
    /** 当前预览数据 */
    preview,
    /** 是否正在预览 */
    isPreviewing,
    /** 底层工具函数 */
    utils: {
      smartPaste,
      parseClipboardTable,
      guessColumnMappings,
    },
  };
}

/** BOM 表格常用目标列（可作为 targetColumns 的默认值） */
export const BOM_TARGET_COLUMNS = [
  'partNo',
  'partName',
  'qty',
  'unit',
  'unitPrice',
  'supplier',
  'endGroup',
  'amount',
];
