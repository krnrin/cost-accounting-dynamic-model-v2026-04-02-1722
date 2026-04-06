const fs = require('fs');

let text = fs.readFileSync('projectlist.txt', 'utf16le');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const bytes = Buffer.from(text, 'latin1');
let utf8str = bytes.toString('utf8');

// Strip the extra newline added by console.log at the very end
if (utf8str.endsWith('\r\n')) utf8str = utf8str.slice(0, -2);
else if (utf8str.endsWith('\n')) utf8str = utf8str.slice(0, -1);

let lines = utf8str.split('\n');

// Clean all broken lines manually by replacing them
lines[19] = "  draft: '草稿',";
lines[20] = "  quoted: '已报价',";
lines[21] = "  awarded: '已定点',";
lines[22] = "  production: '量产中',";
lines[23] = "  eol: '已归档',";

lines[135] = '          title="还没有项目"';
lines[136] = '          description="点击下方按钮创建第一个项目"';

lines[141] = '            导入项目';
lines[147] = '            新建项目';

lines[163] = "      Toast.success('删除成功');";
lines[166] = "      Toast.error('删除失败');";

lines[173] = "        <Title heading={4} style={{ color: 'var(--semi-color-text-0)', margin: 0 }}>项目列表</Title>";
lines[180] = "            导入项目";
lines[187] = "            新建项目";

lines[194] = '          placeholder="搜索项目名称、编号或客户..."';
lines[207] = '          <Radio value="all">全部</Radio>';
lines[208] = '          <Radio value="ongoing">进行中</Radio>';
lines[209] = '          <Radio value="completed">已完成</Radio>';
lines[210] = '          <Radio value="archived">已归档</Radio>';

lines[251] = '                    title="导出ZIP"';

lines[254] = '                      title="确定删除此项目吗？"';
lines[255] = '                      content="删除后项目及数据将不可恢复"';

lines[275] = '                <Text type="tertiary" size="small">线束数量</Text>';
lines[279] = '                <Text type="tertiary" size="small">报价金额</Text>';
lines[288] = '                  <Text type="tertiary" size="small">内部核算(实绩)</Text>';

lines[297] = '                <Text type="tertiary" size="small">当前状态</Text>';
lines[308] = '                <Text type="tertiary" size="small">最后更新</Text>';

// Write the fixed file
fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
