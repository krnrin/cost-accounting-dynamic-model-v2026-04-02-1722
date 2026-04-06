const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');

const lines = code.split('\n');

// 161
lines[160] = "      Toast.success('删除成功');";
lines[161] = "";

// 217: /* removed solid background */, -> /* removed solid background */
lines[216] = "              /* removed solid background */";

// 291: <Text type="tertiary" size="small">褰撳墠鐘讹拷?/Text>
lines[290] = '                <Text type="tertiary" size="small">当前状态</Text>';

// 302: <Text type="tertiary" size="small">鏈€鍚庢洿锟�?/Text>
lines[301] = '                <Text type="tertiary" size="small">最后更新</Text>';

// Write back
fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
