const fs = require('fs');
let code = fs.readFileSync('src/pages/ProjectListPage.tsx', 'utf8');

const lines = code.split('\n');

// Restore lines 291-315
lines[291] = `                <Text type="tertiary" size="small">当前状态</Text>`;
lines[292] = `                <Tag color={`
lines[293] = `                  p.meta.status === 'draft' ? 'grey' :`;
lines[294] = `                  p.meta.status === 'quoted' ? 'blue' :`;
lines[295] = `                  p.meta.status === 'awarded' ? 'green' :`;
lines[296] = `                  p.meta.status === 'production' ? 'cyan' : 'red'`;
lines[297] = `                } size="small" style={{ width: 'fit-content' }}>`;
lines[298] = `                  {statusMap[p.meta.status]}`;
lines[299] = `                </Tag>`;
lines[300] = `              </div>`;
lines[301] = `              <div style={{ display: 'flex', flexDirection: 'column' }}>`;
lines[302] = `                <Text type="tertiary" size="small">最后更新</Text>`;
lines[303] = `                <Text size="small">{new Date(p.meta.updatedAt).toLocaleDateString('zh-CN')}</Text>`;
lines[304] = `              </div>`;
lines[305] = `            </div>`;
lines[306] = `          </Card>`;
lines[307] = `        ))} `;
lines[308] = `      </div>`;
lines[309] = `    </div>`;
lines[310] = `  );`;
lines[311] = `}`;
// truncate the rest
lines.length = 312;

fs.writeFileSync('src/pages/ProjectListPage.tsx', lines.join('\n'), 'utf8');
