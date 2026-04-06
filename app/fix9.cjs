const fs = require('fs');

let text = fs.readFileSync('projectlist.txt', 'utf16le');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const bytes = Buffer.from(text, 'latin1');
let code = bytes.toString('utf8');

// Strip the extra newline added by console.log at the very end
if (code.endsWith('\r\n')) code = code.slice(0, -2);
else if (code.endsWith('\n')) code = code.slice(0, -1);

// Replace status map
code = code.replace(/const statusMap: Record<string, string> = {[\s\S]*?};/, `const statusMap: Record<string, string> = {
  draft: '草稿',
  quoted: '已报价',
  awarded: '已定点',
  production: '量产中',
  eol: '已归档',
};`);

// Replace Empty state
code = code.replace(/<Empty[\s\S]*?\/>/, `<Empty title="还没有项目" description="点击下方按钮创建" />`);

// Replace Buttons text
code = code.replace(/瀵煎叆椤圭洰/g, `导入项目`);
code = code.replace(/鏂板缓椤圭洰/g, `新建项目`);

// Replace Search placeholder
code = code.replace(/鎼滅储椤圭洰鍚嶇О銆佺紪鍙锋垨瀹㈡埛\.\.\./g, `搜索项目名称、编号或客户...`);

// Replace Radio group text
code = code.replace(/<Radio value="all">鍏ㄩ儴<\/Radio>/g, `<Radio value="all">全部</Radio>`);
code = code.replace(/<Radio value="ongoing">.*?\/Radio>/g, `<Radio value="ongoing">进行中</Radio>`);
code = code.replace(/<Radio value="completed">.*?\/Radio>/g, `<Radio value="completed">已完成</Radio>`);
code = code.replace(/<Radio value="archived">.*?\/Radio>/g, `<Radio value="archived">已归档</Radio>`);

// Replace list title
code = code.replace(/椤圭洰鍒楄〃/g, `项目列表`);

// Replace popconfirm
code = code.replace(/<Popconfirm[\s\S]*?onConfirm=/g, `<Popconfirm title="确定删除此项目吗？" content="删除后数据将不可恢复" onConfirm=`);

// Replace info titles
code = code.replace(/绾挎潫鏁伴噺/g, `线束数量`);
code = code.replace(/鎶ヤ环閲戦/g, `报价金额`);
code = code.replace(/鍐呴儴鏍哥畻 \(瀹炵哗\)/g, `内部核算(实绩)`);

// Fix labels
code = code.replace(/褰撳墠鐘讹拷\?\/Text>/g, `当前状态</Text>`);
code = code.replace(/鏈€鍚庢洿锟�\?\/Text>/g, `最后更新</Text>`);
code = code.replace(/<Text size="small">\{new Date.*?<\/Text>/, (match) => { return match; });

// Fix Toast
code = code.replace(/Toast\.success\('.*?'\);/g, `Toast.success('操作成功');`);
code = code.replace(/Toast\.error\('å\sé¤å¤±è´¥'\);/g, `Toast.error('删除失败');`);
code = code.replace(/Toast\.error\('.*?鍒犻櫎.*?失败'\);/g, `Toast.error('删除失败');`);

// Fix download and export tooltips
code = code.replace(/title="瀵煎嚭ZIP"/g, `title="导出ZIP"`);

// Add glassmorphism classes to the main card
code = code.replace(/<Card\s+style=\{\{/g, `<Card className="elite-card animate-fade-up" style={{`);

// Ensure valid JSX around empty
code = code.replace(/<Empty title="还没有项目" description="点击下方按钮创建" \/>\s*\/>/g, `<Empty title="还没有项目" description="点击下方按钮创建" />`);

// Write back
fs.writeFileSync('src/pages/ProjectListPage.tsx', code, 'utf8');
