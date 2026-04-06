const fs = require('fs');
let lines = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8').split('\n');

lines[134] = '          title="还没有项目"';
lines[256] = '                      title="确定删除此项目吗？"';

fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
