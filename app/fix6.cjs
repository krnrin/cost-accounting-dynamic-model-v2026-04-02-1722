const fs = require('fs');
let lines = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8').split('\n');

lines[251] = '                    title="导出ZIP"';
lines[253] = '                    <Popconfirm';
lines[254] = '                      title="确定删除此项目吗？"';
lines[255] = '                      content="删除不可恢复"';
lines[256] = '                      onConfirm={(e) => handleDelete(p.id, e as unknown as React.MouseEvent)}';
lines.splice(257, 1); // remove the broken line

fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
