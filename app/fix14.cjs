const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');

const lines = code.split('\n');

// Fix catch
lines[161] = "    } catch (err) {";

// Fix map closing and div closing
lines[307] = `        ))} `;

// The issue at 308 might be that the map is missing `}`
// Let's see... `filteredProjects.map((p) => (` ... `))`
// So `        ))} ` is correct.

// Wait, looking at the previous output:
// <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
//   {filteredProjects.map((p) => (
//     <div key={p.id} onClick={() => navigate(\`/project/\${p.id}\`)} style={{ cursor: 'pointer' }}>
//       <Card className="elite-card animate-fade-up"

// So we have `<div key...>`, then `<Card...>`, then `<div style...>`, then `</Card>`.
// So we need `</div>` before `))} `!

lines[306] = `          </Card>`;
lines[307] = `          </div>`;
lines[308] = `        ))} `;
lines[309] = `      </div>`;
lines[310] = `    </div>`;
lines[311] = `  );`;
lines[312] = `}`;

lines.length = 313;

fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
