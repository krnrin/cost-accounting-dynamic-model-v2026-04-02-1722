import { createUniver } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import '@univerjs/sheets-drawing-ui/lib/index.css';
import '@univerjs/drawing-ui/lib/index.css';
import '@univerjs/sheets-filter-ui/lib/index.css';
import '@univerjs/sheets-sort-ui/lib/index.css';
import '@univerjs/sheets-conditional-formatting-ui/lib/index.css';

const DEFAULT_LOCALE = 'zhCN';

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeTemplateValue(value) {
  if (value == null) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  return String(value);
}

function ensureRange(worksheet, rangeOrAddress) {
  return typeof rangeOrAddress === 'string'
    ? worksheet.getRange(rangeOrAddress)
    : worksheet.getRange(
        rangeOrAddress.startRow,
        rangeOrAddress.startColumn,
        rangeOrAddress.numRows,
        rangeOrAddress.numColumns
      );
}

function applyStyleOperation(univerAPI, worksheet, operation = {}) {
  const range = ensureRange(worksheet, operation.range);
  if (operation.background) range.setBackground(operation.background);
  if (operation.wrap !== undefined) range.setWrap(Boolean(operation.wrap));
  if (operation.fontWeight) range.setFontWeight(operation.fontWeight);
  if (operation.fontSize) range.setFontSize(operation.fontSize);
  if (operation.horizontalAlignment) {
    try {
      range.setHorizontalAlignment(operation.horizontalAlignment);
    } catch (error) {
      // Ignore unsupported alignment tokens and keep the sheet usable.
    }
  }
  if (operation.verticalAlignment) {
    try {
      range.setVerticalAlignment(operation.verticalAlignment);
    } catch (error) {
      // Ignore unsupported alignment tokens and keep the sheet usable.
    }
  }
  if (operation.border) {
    range.setBorder(
      univerAPI.Enum.BorderType[operation.border.type] || univerAPI.Enum.BorderType.ALL,
      univerAPI.Enum.BorderStyleTypes[operation.border.style] || univerAPI.Enum.BorderStyleTypes.THIN,
      operation.border.color || '#dbe4ee'
    );
  }
}

class UniverTemplateEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.currentWorkbookId = '';
    const corePreset = UniverSheetsCorePreset({
      container,
      header: true,
      toolbar: true,
      formulaBar: true,
      footer: true,
      contextMenu: true,
    });

    const { univer, univerAPI } = createUniver({
      locale: DEFAULT_LOCALE,
      locales: {
        [DEFAULT_LOCALE]: sheetsCoreZhCN,
      },
      presets: [
        corePreset,
        UniverSheetsDrawingPreset({ collaboration: false }),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsFilterPreset({ enableSyncSwitch: true }),
        UniverSheetsSortPreset(),
      ],
    });
    this.univer = univer;
    this.univerAPI = univerAPI;
  }

  getActiveWorkbook() {
    return this.univerAPI.getActiveWorkbook() || null;
  }

  getActiveSheet() {
    return this.getActiveWorkbook()?.getActiveSheet?.() || null;
  }

  getActiveRange() {
    return this.getActiveWorkbook()?.getActiveRange?.() || this.getActiveSheet()?.getActiveRange?.() || null;
  }

  focus() {
    const target = this.container?.querySelector('[data-u-comp="workbench-layout"]');
    target?.focus?.();
  }

  activateRibbonTab(label) {
    const tab = Array.from(this.container?.querySelectorAll('[data-u-comp="ribbon-header-menu"] [role="tab"]') || [])
      .find((node) => node.textContent?.trim() === label);
    tab?.click?.();
    return Boolean(tab);
  }

  triggerToolbarCommand(commandId, tabLabel) {
    if (tabLabel) {
      this.activateRibbonTab(tabLabel);
    }
    const clickCommand = () => {
      const trigger = this.container?.querySelector(`[data-u-command="${commandId}"]`);
      trigger?.click?.();
      return Boolean(trigger);
    };
    if (clickCommand()) return true;
    this.container?.ownerDocument?.defaultView?.requestAnimationFrame(() => {
      clickCommand();
    });
    return true;
  }

  disposeWorkbook() {
    const workbook = this.getActiveWorkbook();
    const workbookId = workbook?.getId?.() || this.currentWorkbookId;
    if (workbookId) {
      this.univerAPI.disposeUnit(workbookId);
    }
    this.currentWorkbookId = '';
  }

  loadTemplate(template = {}) {
    this.disposeWorkbook();
    const workbook = template.workbookSnapshot
      ? this.univerAPI.createWorkbook(clonePlain(template.workbookSnapshot))
      : this.univerAPI.createWorkbook({
          id: template.workbookId || `template_${Date.now().toString(36)}`,
          name: template.workbookName || template.sheetName || 'Version Template',
        });
    const worksheet = workbook.getActiveSheet();
    this.currentWorkbookId = workbook.getId();

    if (!template.workbookSnapshot) {
      const matrix = Array.isArray(template.matrix) ? template.matrix : [];
      if (matrix.length) {
        const rowCount = matrix.length;
        const columnCount = Math.max(...matrix.map((row) => row.length), 0);
        if (columnCount > 0) {
          worksheet
            .getRange(0, 0, rowCount, columnCount)
            .setValues(
              matrix.map((row) =>
                Array.from({ length: columnCount }, (_, index) => normalizeTemplateValue(row[index]))
              )
            );
        }
      }

      (template.columnWidths || []).forEach((width, index) => {
        if (typeof width === 'number' && width > 0) {
          worksheet.setColumnWidth(index, width);
        }
      });

      (template.rowHeights || []).forEach((height, index) => {
        if (typeof height === 'number' && height > 0) {
          worksheet.setRowHeight(index, height);
        }
      });

      if (typeof template.frozenRows === 'number') {
        worksheet.setFrozenRows(template.frozenRows);
      }
      if (typeof template.frozenColumns === 'number') {
        worksheet.setFrozenColumns(template.frozenColumns);
      }

      (template.styles || []).forEach((operation) => {
        applyStyleOperation(this.univerAPI, worksheet, operation);
      });
    }

    if (template.activeRange) {
      worksheet.setActiveRange(worksheet.getRange(template.activeRange));
      worksheet.setActiveSelection(worksheet.getRange(template.activeRange));
    }

    return {
      workbookId: this.currentWorkbookId,
      sheetName: worksheet.getSheetName(),
    };
  }

  getFieldState(fields = []) {
    const workbook = this.getActiveWorkbook();
    const worksheet = workbook?.getActiveSheet();
    if (!worksheet) return {};
    return fields.reduce((acc, field) => {
      if (!field?.address) return acc;
      const range = worksheet.getRange(field.address);
      acc[field.key] = {
        address: field.address,
        value: range.getValue(),
        formula: range.getFormula(),
        cellData: range.getCellData(),
      };
      return acc;
    }, {});
  }

  applyFieldInputs(fields = [], rawInputs = {}, fallbackValues = {}) {
    const workbook = this.getActiveWorkbook();
    const worksheet = workbook?.getActiveSheet();
    if (!worksheet) return;
    fields.forEach((field) => {
      if (!field?.address) return;
      const hasRawInput = Object.prototype.hasOwnProperty.call(rawInputs, field.key);
      const nextValue = hasRawInput ? rawInputs[field.key] : fallbackValues[field.key];
      if (nextValue === undefined) return;
      worksheet.getRange(field.address).setValues([[normalizeTemplateValue(nextValue)]]);
    });
  }

  getSelectionSnapshot() {
    const range = this.getActiveRange();
    if (!range) return null;
    return {
      a1: range.getA1Notation?.() || '',
      row: range.getRow?.() || 0,
      column: range.getColumn?.() || 0,
      height: range.getHeight?.() || 1,
      width: range.getWidth?.() || 1,
    };
  }

  appendSheet() {
    const button = this.container?.querySelector('[data-u-comp="sheet-bar-append-button"]');
    if (button) {
      button.click();
      this.focus();
      return true;
    }
    const workbook = this.getActiveWorkbook();
    if (!workbook) return false;
    const name = `工作表${(workbook.getNumSheets?.() || 0) + 1}`;
    workbook.create?.(name, 200, 40);
    this.focus();
    return true;
  }

  insertRowsAfterSelection(count = 1) {
    const sheet = this.getActiveSheet();
    const range = this.getActiveRange();
    if (!sheet || !range) return false;
    const afterPosition = range.getRow() + Math.max(range.getHeight(), 1) - 1;
    sheet.insertRowsAfter(afterPosition, Math.max(count, 1));
    this.focus();
    return true;
  }

  insertColumnsAfterSelection(count = 1) {
    const sheet = this.getActiveSheet();
    const range = this.getActiveRange();
    if (!sheet || !range) return false;
    const afterPosition = range.getColumn() + Math.max(range.getWidth(), 1) - 1;
    sheet.insertColumnsAfter(afterPosition, Math.max(count, 1));
    this.focus();
    return true;
  }

  mergeSelection() {
    const range = this.getActiveRange();
    if (!range) return false;
    range.merge({ defaultMerge: false });
    this.focus();
    return true;
  }

  unmergeSelection() {
    const range = this.getActiveRange();
    if (!range) return false;
    range.breakApart();
    this.focus();
    return true;
  }

  toggleFilter() {
    return this.triggerToolbarCommand('sheet.command.smart-toggle-filter', '数据');
  }

  openConditionalFormattingPanel() {
    return this.triggerToolbarCommand('sheet.operation.open.conditional.formatting.panel', '数据');
  }

  openImageMenu() {
    return this.triggerToolbarCommand('sheet.menu.image', '插入');
  }

  saveSnapshot() {
    const workbook = this.getActiveWorkbook();
    return workbook ? clonePlain(workbook.save()) : null;
  }

  destroy() {
    this.disposeWorkbook();
    this.univer.dispose();
  }
}

window.G281UniverTemplateEditor = {
  create(container, options) {
    return new UniverTemplateEditor(container, options);
  },
};

export {};
