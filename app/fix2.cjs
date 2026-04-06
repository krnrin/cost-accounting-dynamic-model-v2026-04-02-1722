const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');

// The original file is structurally mostly correct but has corrupted Chinese literals.
// Some of them lost their closing quotes or brackets.
// Let's manually replace the known bad segments.

code = code.replace(/const statusMap: Record<string, string> = {[\s\S]*?};/, `const statusMap: Record<string, string> = {
  draft: '草稿',
  quoted: '已报价',
  awarded: '已定点',
  production: '量产中',
  eol: '已归档',
};`);

code = code.replace(/description=\"[^\n]*\n\s*\/>/g, `description="点击创建第一个项目"\n        />`);
code = code.replace(/Toast\.success\('([^']*?);\n/g, `Toast.success('操作成功');\n`);

code = code.replace(/<Radio value="ongoing">.*?\/Radio>/, `<Radio value="ongoing">进行中</Radio>`);
code = code.replace(/<Radio value="completed">.*?\/Radio>/, `<Radio value="completed">已完成</Radio>`);
code = code.replace(/<Radio value="archived">.*?\/Radio>/, `<Radio value="archived">已归档</Radio>`);

code = code.replace(/content=\"[^\"]*\"\n\s*onConfirm/g, `content="删除后不可恢复"\n                      onConfirm`);

code = code.replace(/<Text type=\"tertiary\" size=\"small\">.*?<\/Text>/g, `<Text type="tertiary" size="small">标签</Text>`);
code = code.replace(/<Text type=\"tertiary\" size=\"small\">[^<]*\n/g, `<Text type="tertiary" size="small">时间</Text>\n`);

fs.writeFileSync('src/pages/ProjectListPage.tsx', code, 'utf8');
