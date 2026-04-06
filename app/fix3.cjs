const fs = require('fs');
let lines = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8').split('\n');

lines[135] = '          description="点击创建第一个项目"';
lines[163] = '      Toast.success("删除成功");';
lines[219] = '              /* removed background */';
lines[257] = '                      content="删除不可恢复"';

fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
