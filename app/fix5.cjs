const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');

// Normalise newlines
code = code.replace(/\r\n/g, '\n');

// Empty
code = code.replace(/<Empty[^>]+>/, `<Empty title="还没有项目" description="点击创建第一个项目" />`);

// Popconfirm
code = code.replace(/<Popconfirm[^>]+>/g, `<Popconfirm title="确定删除此项目吗？" content="删除不可恢复" onConfirm={(e) => handleDelete(p.id, e as unknown as React.MouseEvent)} onCancel={(e) => e?.stopPropagation()} position="bottomRight">`);

// RoleGuard
code = code.replace(/<RoleGuard[^>]+>/g, (match) => {
  if (match.includes('field')) return match;
  return `<RoleGuard field="deleteProject">`;
});

// Any weird hanging `/>` after Empty?
code = code.replace(/<Empty title="还没有项目" description="点击创建第一个项目" \/>\s*\/>/g, `<Empty title="还没有项目" description="点击创建第一个项目" />`);

fs.writeFileSync('src/pages/ProjectListPage.tsx', code, 'utf8');
