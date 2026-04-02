const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'C:/Users/lyvee/.openclaw/workspace/成本核算动态模型/BOM核对/吉利E281报价核算.xlsx';
const workbook = XLSX.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

// 读取设备投资明细sheet
const sheetName = '设备投资明细';
if (workbook.SheetNames.includes(sheetName)) {
    const ws = workbook.Sheets[sheetName];

    console.log(`\n=== ${sheetName} ===`);

    // 获取单元格范围
    const range = XLSX.utils.decode_range(ws['!ref']);
    console.log(`Range: ${ws['!ref']}`);
    console.log(`Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);

    // 读取前50行，显示公式和值
    console.log('\n--- Formulas and Values (first 50 rows) ---');
    for (let r = 0; r < Math.min(50, range.e.r + 1); r++) {
        for (let c = 0; c < Math.min(15, range.e.c + 1); c++) {
            const cellRef = XLSX.utils.encode_cell({r, c});
            const cell = ws[cellRef];

            if (cell && cell.f) {  // 有公式
                console.log(`R${r+1}C${c+1} (${cellRef}): FORMULA = ${cell.f}`);
            } else if (cell && cell.v !== undefined) {  // 有值
                const val = cell.v;
                if (typeof val === 'number' && val > 1000) {
                    console.log(`R${r+1}C${c+1} (${cellRef}): VALUE = ${val}`);
                }
            }
        }
    }

    // 转换为JSON查看结构
    console.log('\n--- Sheet Data (as JSON) ---');
    const jsonData = XLSX.utils.sheet_to_json(ws, {header: 1});
    jsonData.slice(0, 20).forEach((row, i) => {
        console.log(`Row ${i+1}: ${JSON.stringify(row.slice(0, 10))}`);
    });
} else {
    console.log(`Sheet '${sheetName}' not found!`);
    console.log('Available sheets:', workbook.SheetNames);
}
