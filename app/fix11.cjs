const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');

code = code.replace(/Toast\.success\('é¡¹ç\x9B®å·²å\sé\?/g, `Toast.success('删除成功'`);
code = code.replace(/Toast\.error\('å\sé¤å¤±è´¥'\)/g, `Toast.error('删除失败')`);

// Remove `,` after `/* removed solid background */`
code = code.replace(/\/\* removed solid background \*\//g, `/* removed solid background */`);
code = code.replace(/,\s*border: '1px solid var\(--semi-color-border\)',/g, `border: '1px solid var(--semi-color-border)',`);

// Texts
code = code.replace(/<Text type="tertiary" size="small">å½å\x89\x8Dç\x8A¶æ\x80\?\/Text>/g, `<Text type="tertiary" size="small">当前状态</Text>`);
code = code.replace(/<Text type="tertiary" size="small">æ\x9C\x80å\x90\x8Eæ\x9B´æ\x96\?\/Text>/g, `<Text type="tertiary" size="small">最后更新</Text>`);

fs.writeFileSync('src/pages/ProjectListPage.tsx', code, 'utf8');
