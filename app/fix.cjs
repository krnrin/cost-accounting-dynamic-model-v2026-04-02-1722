const fs = require('fs');
let code = fs.readFileSync('projectlist.txt', 'latin1');

// Fix strings
code = code.replace(/draft: '.*?,/, `draft: '草稿',`);
code = code.replace(/quoted: '.*?,/, `quoted: '已报价',`);
code = code.replace(/awarded: '.*?,/, `awarded: '已定点',`);
code = code.replace(/production: '.*?,/, `production: '量产中',`);
code = code.replace(/eol: '.*?,/, `eol: '已归档',`);

// Fix Toast and description
code = code.replace(/description=\"[^\"]*?/, `description="点击创建"`);
code = code.replace(/Toast\.success\('.*?\);/, `Toast.success('操作成功');`);

// Fix Radio tags
code = code.replace(/<Radio value="ongoing">.*?\/Radio>/, `<Radio value="ongoing">进行中</Radio>`);
code = code.replace(/<Radio value="completed">.*?\/Radio>/, `<Radio value="completed">已完成</Radio>`);
code = code.replace(/<Radio value="archived">.*?\/Radio>/, `<Radio value="archived">已归档</Radio>`);

// Fix other broken things
code = code.replace(/content=\"[^\"]*?/, `content="删除后不可恢复"`);
code = code.replace(/<Text type=\"tertiary\" size=\"small\">.*?(?=<\/Text>)/g, `<Text type="tertiary" size="small">状态更新`);

// Write back
fs.writeFileSync('src/pages/ProjectListPage.tsx', code, 'utf8');
