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

import { AddSheetDataValidationCommand } from '@univerjs/sheets-data-validation';
import { useRef, useEffect, useMemo } from 'react';
import type { ISheetDataValidationRule } from '@univerjs/core';

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

  /** Raw cellData with inline styles (bypasses buildSheetData styling) */
  rawCellData?: Record<number, Record<number, any>>;

  /** Data validation rules to inject after workbook creation, keyed by sheet ID */
  dataValidations?: Record<string, ISheetDataValidationRule[]>;

  /** Number of header rows to freeze (default 1, used for single-sheet mode) */
  freezeRows?: number;
  /** Read-only mode */
  readOnly?: boolean;
  /** Hide Univer's built-in toolbar ribbon (default false) */
  hideToolbar?: boolean;
  /** Hide Univer's built-in formula bar (default false) */
  hideFormulaBar?: boolean;
  /** Hide row/column headers (default false) */
  hideHeaders?: boolean;
  /** Hide gridlines (default false) */
  hideGridlines?: boolean;
  /** Container height */
  height?: number | string;
  /** Container width */
  width?: number | string;
  /** Data change callback — returns 2D array of active sheet */
  onChange?: (data: (string | number | null)[][], sheetId?: string) => void;
  /** Cell click callback */
  onCellClick?: (row: number, col: number) => void;
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
    bg: { rgb: '#f0f2f5' },
    cl: { rgb: '#1f2937' },
    ht: 2,
    vt: 2,
    bd: {
      b: { s: 1, cl: { rgb: 'rgba(0,0,0,0.08)' } },
      r: { s: 1, cl: { rgb: 'rgba(0,0,0,0.08)' } },
    },
  },
  'data-cell': {
    bg: { rgb: '#ffffff' },
    cl: { rgb: '#374151' },
    bd: {
      b: { s: 1, cl: { rgb: 'rgba(0,0,0,0.06)' } },
      r: { s: 1, cl: { rgb: 'rgba(0,0,0,0.06)' } },
    },
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function UniverSheet({
  data,
  columns,
  columnWidths,
  sheets,
  rawCellData,
  dataValidations,
  freezeRows = 1,
  readOnly = false,
  hideToolbar = false,
  hideFormulaBar = false,
  hideHeaders = false,
  hideGridlines = false,
  height = 400,
  width = '100%',
  onChange,
  onCellClick,
  onActiveSheetChange,
  className,
}: UniverSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const workbookRef = useRef<any>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;

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
          ...(hideToolbar ? { header: false, toolbar: false } : {}),
          ...(hideFormulaBar ? { formulaBar: false } : {}),
          footer: false,
          contextMenu: false,
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

    // Build workbook data — rawCellData, multi-sheet, or single-sheet
    const workbookData = rawCellData
      ? buildRawCellDataWorkbook(rawCellData, columnWidths, freezeRows, hideHeaders, hideGridlines)
      : sheets && sheets.length > 0
        ? buildMultiSheetWorkbook(sheets)
        : buildSingleSheetWorkbook(data, columns, columnWidths, freezeRows, hideHeaders, hideGridlines);

    const workbook = univerAPI.createUniverSheet(workbookData);
    workbookRef.current = workbook;

    if (readOnly && typeof (workbook as any).setEditable === 'function') {
      (workbook as any).setEditable(false);
    }

    // Inject data validation rules after workbook creation
    if (dataValidations) {
      const unitId = workbookData.id;
      for (const [sheetId, rules] of Object.entries(dataValidations)) {
        for (const rule of rules) {
          univerAPI.executeCommand(AddSheetDataValidationCommand.id, {
            unitId,
            subUnitId: sheetId,
            rule,
          });
        }
      }
    }

    // Listen for cell clicks
    let cellClickDisposable: { dispose: () => void } | undefined;
    if (onCellClick) {
      cellClickDisposable = univerAPI.addEvent(univerAPI.Event.CellClicked, (params: any) => {
        onCellClickRef.current?.(params.row, params.column);
      });
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
      if (cellClickDisposable) cellClickDisposable.dispose();
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
      style={{
        height, width,
        background: 'transparent',
        overflow: 'hidden',
        borderRadius: hideHeaders ? 12 : 6,
        border: hideHeaders ? 'none' : '1px solid rgba(0,0,0,0.06)',
      }}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSheetData(
  displayData: (string | number | null)[][],
  colWidths?: number[],
  freeze: number = 1,
  hideHeaders: boolean = false,
  hideGridlines: boolean = false,
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
    showGridlines: hideGridlines ? 0 : 1,
    ...(hideHeaders ? { rowHeader: { width: 0, hidden: 1 }, columnHeader: { height: 0, hidden: 1 } } : {}),
    freeze: { startRow: freeze, startColumn: 0, ySplit: freeze, xSplit: 0 },
  };
}

function buildSingleSheetWorkbook(
  data?: (string | number | null)[][],
  columns?: string[],
  columnWidths?: number[],
  freezeRows: number = 1,
  hideHeaders: boolean = false,
  hideGridlines: boolean = false,
) {
  let displayData: (string | number | null)[][] = [];
  if (data && data.length > 0) displayData = data;
  else if (columns && columns.length > 0) displayData = [columns];

  const sheetPayload = buildSheetData(displayData, columnWidths, freezeRows, hideHeaders, hideGridlines);
  return {
    id: 'workbook-01',
    styles: WORKBOOK_STYLES,
    sheets: { 'sheet-01': { id: 'sheet-01', name: 'BOM', ...sheetPayload } },
    sheetOrder: ['sheet-01'],
  };
}

function buildRawCellDataWorkbook(
  cellData: Record<number, Record<number, any>>,
  colWidths?: number[],
  freezeRows: number = 1,
  hideHeaders: boolean = false,
  hideGridlines: boolean = false,
) {
  const rowKeys = Object.keys(cellData).map(Number);
  const maxRow = rowKeys.length > 0 ? Math.max(...rowKeys) + 1 : 1;
  let maxCol = 1;
  for (const ri of rowKeys) {
    const colKeys = Object.keys(cellData[ri]!).map(Number);
    if (colKeys.length > 0) maxCol = Math.max(maxCol, Math.max(...colKeys) + 1);
  }

  const columnData: Record<number, { w: number }> = {};
  if (colWidths) {
    colWidths.forEach((w, i) => { columnData[i] = { w }; });
  }

  const rowData: Record<number, { h: number }> = {};
  for (let i = 0; i < freezeRows; i++) {
    rowData[i] = { h: 28 };
  }

  return {
    id: 'workbook-raw',
    sheets: {
      'sheet-raw': {
        id: 'sheet-raw',
        name: 'Sheet',
        cellData,
        rowCount: Math.max(maxRow, 20),
        columnCount: Math.max(maxCol, 10),
        columnData,
        rowData,
        showGridlines: hideGridlines ? 0 : 0,
        ...(hideHeaders ? { rowHeader: { width: 0, hidden: 1 }, columnHeader: { height: 0, hidden: 1 } } : {}),
        freeze: { startRow: freezeRows, startColumn: 0, ySplit: freezeRows, xSplit: 0 },
      },
    },
    sheetOrder: ['sheet-raw'],
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
