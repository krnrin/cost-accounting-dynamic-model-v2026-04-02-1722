import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import '@univerjs/preset-sheets-core/lib/index.css';

import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import UniverPresetSheetsFilterZhCN from '@univerjs/preset-sheets-filter/locales/zh-CN';
import '@univerjs/preset-sheets-filter/lib/index.css';

import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import UniverPresetSheetsSortZhCN from '@univerjs/preset-sheets-sort/locales/zh-CN';
import '@univerjs/preset-sheets-sort/lib/index.css';

import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import UniverPresetSheetsCFZhCN from '@univerjs/preset-sheets-conditional-formatting/locales/zh-CN';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';

import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import UniverPresetSheetsFRZhCN from '@univerjs/preset-sheets-find-replace/locales/zh-CN';
import '@univerjs/preset-sheets-find-replace/lib/index.css';

import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDVZhCN from '@univerjs/preset-sheets-data-validation/locales/zh-CN';
import '@univerjs/preset-sheets-data-validation/lib/index.css';

import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import UniverPresetSheetsHLZhCN from '@univerjs/preset-sheets-hyper-link/locales/zh-CN';
import '@univerjs/preset-sheets-hyper-link/lib/index.css';

import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import UniverPresetSheetsNoteZhCN from '@univerjs/preset-sheets-note/locales/zh-CN';
import '@univerjs/preset-sheets-note/lib/index.css';

import { useRef, useEffect, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Single sheet definition for multi-sheet workbooks */
export interface SheetDef {
  id: string;
  name: string;
  /** Row data: 2D array including header row(s) */
  data: (string | number | null)[][];
  /** Column widths */
  columnWidths?: number[];
  /** Number of header rows to freeze (default 1) */
  freezeRows?: number;
}

export interface UniverSheetProps {
  /** Single-sheet mode: 2D array data (backward-compatible) */
  data?: (string | number | null)[][];
  /** Single-sheet mode: column definitions */
  columns?: string[];
  /** Single-sheet mode: column widths */
  columnWidths?: number[];

  /** Multi-sheet mode: array of sheet definitions */
  sheets?: SheetDef[];

  /** Number of header rows to freeze (default 1, used for single-sheet mode) */
  freezeRows?: number;
  /** Read-only mode */
  readOnly?: boolean;
  /** Hide Univer's built-in toolbar ribbon (default false) */
  hideToolbar?: boolean;
  /** Hide Univer's built-in formula bar (default false) */
  hideFormulaBar?: boolean;
  /** Container height */
  height?: number | string;
  /** Container width */
  width?: number | string;
  /** Data change callback — returns 2D array of active sheet */
  onChange?: (data: (string | number | null)[][], sheetId?: string) => void;
  /** Active sheet change callback */
  onActiveSheetChange?: (sheetId: string) => void;
  /** Custom className */
  className?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const HEADER_STYLE_ID = 'excel-header';

const WORKBOOK_STYLES: Record<string, any> = {
  [HEADER_STYLE_ID]: {
    bl: 1,
    bg: { rgb: '#D9E2F3' },
    ht: 2,
    vt: 2,
    bd: {
      b: { s: 1, cl: { rgb: '#B4C6E7' } },
      r: { s: 1, cl: { rgb: '#B4C6E7' } },
    },
  },
  'data-cell': {
    bd: {
      b: { s: 1, cl: { rgb: '#E0E0E0' } },
      r: { s: 1, cl: { rgb: '#E0E0E0' } },
    },
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function UniverSheet({
  data,
  columns,
  columnWidths,
  sheets,
  freezeRows = 1,
  readOnly = false,
  hideToolbar = false,
  hideFormulaBar = false,
  height = 400,
  width = '100%',
  onChange,
  onActiveSheetChange,
  className,
}: UniverSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const workbookRef = useRef<any>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onActiveSheetChangeRef = useRef(onActiveSheetChange);
  onActiveSheetChangeRef.current = onActiveSheetChange;

  const debouncedOnChange = useMemo(() => {
    let timeout: any;
    return (d: (string | number | null)[][], sheetId?: string) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        onChangeRef.current?.(d, sheetId);
      }, 300);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const { univerAPI } = createUniver({
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(
          UniverPresetSheetsCoreZhCN,
          UniverPresetSheetsFilterZhCN,
          UniverPresetSheetsSortZhCN,
          UniverPresetSheetsCFZhCN,
          UniverPresetSheetsFRZhCN,
          UniverPresetSheetsDVZhCN,
          UniverPresetSheetsHLZhCN,
          UniverPresetSheetsNoteZhCN,
        ),
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          // Hide built-in toolbar ribbon when requested
          ...(hideToolbar ? { header: false, toolbar: false } : {}),
          ...(hideFormulaBar ? { formulaBar: false } : {}),
        }),
        UniverSheetsFilterPreset(),
        UniverSheetsSortPreset(),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsFindReplacePreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsHyperLinkPreset(),
        UniverSheetsNotePreset(),
      ],
    });

    univerRef.current = univerAPI;

    // Build workbook data — multi-sheet or single-sheet
    const workbookData = sheets && sheets.length > 0
      ? buildMultiSheetWorkbook(sheets)
      : buildSingleSheetWorkbook(data, columns, columnWidths, freezeRows);

    const workbook = univerAPI.createUniverSheet(workbookData);
    workbookRef.current = workbook;

    if (readOnly && typeof (workbook as any).setEditable === 'function') {
      (workbook as any).setEditable(false);
    }

    // Listen for data changes & active sheet changes
    let disposable: { dispose: () => void } | undefined;
    if (onChange || onActiveSheetChange) {
      disposable = univerAPI.onCommandExecuted((command: any) => {
        // Handle Active Sheet Change
        if (command.id === 'sheet.command.set-worksheet-active') {
          const sheetId = command.params?.subUnitId;
          if (sheetId && onActiveSheetChangeRef.current) {
            onActiveSheetChangeRef.current(sheetId);
          }
        }

        // Handle Data Changes
        const changeCommands = [
          'sheet.command.set-range-values',
          'sheet.command.set-style',
          'sheet.command.insert-row',
          'sheet.command.insert-col',
          'sheet.command.delete-row',
          'sheet.command.delete-col',
          'sheet.command.move-range',
        ];
        if (changeCommands.includes(command.id)) {
          const activeWorkbook = univerAPI.getActiveWorkbook();
          const activeSheet = activeWorkbook?.getActiveSheet();
          if (activeSheet) {
            const s = activeSheet as any;
            const rowCount = typeof s.getRowCount === 'function' ? s.getRowCount() : 100;
            const colCount = typeof s.getColumnCount === 'function' ? s.getColumnCount() : 20;
            const range = activeSheet.getRange(0, 0, rowCount, colCount);
            const values = range.getValues();
            const simpleValues = (values as any[][]).map(row =>
              row.map(cell => cell?.v ?? null)
            );
            const sheetId = typeof s.getSheetId === 'function' ? s.getSheetId() : undefined;
            debouncedOnChange(simpleValues, sheetId);
          }
        }
      });
    }

    return () => {
      if (disposable) disposable.dispose();
      univerAPI.dispose();
      univerRef.current = null;
      workbookRef.current = null;
    };
  }, []); // mount only

  useEffect(() => {
    if (workbookRef.current && typeof workbookRef.current.setEditable === 'function') {
      workbookRef.current.setEditable(!readOnly);
    }
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width, background: 'var(--semi-color-bg-2)', overflow: 'hidden' }}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSheetData(
  displayData: (string | number | null)[][],
  colWidths?: number[],
  freeze: number = 1
) {
  const cellData: Record<number, Record<number, any>> = {};
  displayData.forEach((row, ri) => {
    cellData[ri] = {};
    row.forEach((cell, ci) => {
      if (cell !== null && cell !== undefined && cell !== '') {
        cellData[ri]![ci] = {
          v: cell,
          s: ri < freeze ? HEADER_STYLE_ID : 'data-cell',
        };
      }
    });
  });

  const columnData: Record<number, { w: number }> = {};
  if (colWidths) {
    colWidths.forEach((w, i) => { columnData[i] = { w }; });
  }

  const rowData: Record<number, { h: number }> = {};
  for (let i = 0; i < freeze; i++) {
    rowData[i] = { h: 28 };
  }

  return {
    cellData,
    rowCount: Math.max(displayData.length, 50),
    columnCount: Math.max(displayData[0]?.length || 0, 20),
    columnData,
    rowData,
    showGridlines: 1,
    freeze: { startRow: freeze, startColumn: 0, ySplit: freeze, xSplit: 0 },
  };
}

function buildSingleSheetWorkbook(
  data?: (string | number | null)[][],
  columns?: string[],
  columnWidths?: number[],
  freezeRows: number = 1
) {
  let displayData: (string | number | null)[][] = [];
  if (data && data.length > 0) displayData = data;
  else if (columns && columns.length > 0) displayData = [columns];

  const sheetPayload = buildSheetData(displayData, columnWidths, freezeRows);
  return {
    id: 'workbook-01',
    styles: WORKBOOK_STYLES,
    sheets: { 'sheet-01': { id: 'sheet-01', name: 'BOM', ...sheetPayload } },
    sheetOrder: ['sheet-01'],
  };
}

function buildMultiSheetWorkbook(sheets: SheetDef[]) {
  const sheetsMap: Record<string, any> = {};
  const sheetOrder: string[] = [];

  sheets.forEach(s => {
    const payload = buildSheetData(s.data, s.columnWidths, s.freezeRows ?? 1);
    sheetsMap[s.id] = { id: s.id, name: s.name, ...payload };
    sheetOrder.push(s.id);
  });

  return {
    id: 'workbook-multi',
    styles: WORKBOOK_STYLES,
    sheets: sheetsMap,
    sheetOrder,
  };
}
