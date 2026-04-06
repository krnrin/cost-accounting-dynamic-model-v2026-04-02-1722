const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');
const lines = code.split('\n');

// 161: Toast.success('é¡¹ç®å·²å é?); -> Toast.success('删除成功');
lines[161] = "      Toast.success('删除成功');";

// 217: /* removed solid background */, -> /* removed solid background */
lines[217] = "              /* removed solid background */";

// 291: <Text type="tertiary" size="small">å½åç¶æ?/Text> -> <Text type="tertiary" size="small">当前状态</Text>
lines[291] = '                <Text type="tertiary" size="small">当前状态</Text>';

// 302: <Text type="tertiary" size="small">æåæ´æ?/Text> -> <Text type="tertiary" size="small">最后更新</Text>
lines[302] = '                <Text type="tertiary" size="small">最后更新</Text>';

fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
