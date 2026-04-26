/**
 * C6: 快照对比面板
 *
 * 可嵌入 VersionManager 或独立使用，展示两个快照之间的参数和结果差异。
 * 支持参数快照对比和报价快照对比两种模式。
 */
import { useState, useMemo } from 'react';
import { Table, Tag, Typography, Select, Tabs, TabPane, Empty } from '@douyinfe/semi-ui';
import { useSnapshotIntegration } from '@/hooks/useSnapshotIntegration';
import type { SnapshotDiff } from '@/store/settingsSnapshotStore';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

const S: Record<string, CSSProperties> = {
  container: { padding: 16 },
  select: { width: '100%', marginBottom: 12 },
  diffTable: { marginTop: 12 },
  changeTag: { fontFamily: 'monospace' },
};

interface SnapshotComparePanelProps {
  scenarioId: string;
}

export default function SnapshotComparePanel({ scenarioId: _scenarioId }: SnapshotComparePanelProps) {
  const { settingsHistory, quoteHistory, compareSettings, compareQuotes } = useSnapshotIntegration();
  const [settingsA, setSettingsA] = useState<string>('');
  const [settingsB, setSettingsB] = useState<string>('');
  const [quoteA, setQuoteA] = useState<string>('');
  const [quoteB, setQuoteB] = useState<string>('');

  // 参数快照对比
  const settingsDiffs = useMemo<SnapshotDiff[]>(() => {
    if (!settingsA || !settingsB) return [];
    const a = settingsHistory.find((s) => s.id === settingsA);
    const b = settingsHistory.find((s) => s.id === settingsB);
    if (!a || !b) return [];
    return compareSettings(a, b);
  }, [settingsA, settingsB, settingsHistory, compareSettings]);

  // 报价快照对比
  const quoteDiffs = useMemo(() => {
    if (!quoteA || !quoteB) return null;
    const a = quoteHistory.find((s) => s.id === quoteA);
    const b = quoteHistory.find((s) => s.id === quoteB);
    if (!a || !b) return null;
    return compareQuotes(a, b);
  }, [quoteA, quoteB, quoteHistory, compareQuotes]);

  const settingsDiffColumns = [
    { title: '参数', dataIndex: 'label', width: 150 },
    {
      title: '快照A',
      dataIndex: 'oldValue',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      title: '快照B',
      dataIndex: 'newValue',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      title: '变化',
      render: (_: unknown, row: SnapshotDiff) => {
        const a = Number(row.oldValue);
        const b = Number(row.newValue);
        if (isNaN(a) || isNaN(b)) return <Tag>changed</Tag>;
        const delta = b - a;
        return (
          <Tag color={delta > 0 ? 'red' : delta < 0 ? 'green' : 'grey'} style={S.changeTag}>
            {delta > 0 ? '+' : ''}{delta.toFixed(4)}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={S.container}>
      <Tabs>
        <TabPane tab="参数对比" itemKey="settings">
          <Select
            placeholder="选择快照A"
            style={S.select}
            onChange={(v) => setSettingsA(v as string)}
          >
            {settingsHistory.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                {new Date(s.timestamp).toLocaleString('zh-CN')} — {s.reason} — {s.summary}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="选择快照B"
            style={S.select}
            onChange={(v) => setSettingsB(v as string)}
          >
            {settingsHistory.filter((s) => s.id !== settingsA).map((s) => (
              <Select.Option key={s.id} value={s.id}>
                {new Date(s.timestamp).toLocaleString('zh-CN')} — {s.reason} — {s.summary}
              </Select.Option>
            ))}
          </Select>
          {settingsDiffs.length > 0 ? (
            <Table
              dataSource={settingsDiffs}
              columns={settingsDiffColumns}
              rowKey={(row?: SnapshotDiff) => `${row?.section ?? 'settings'}::${row?.field ?? 'unknown'}`}
              pagination={false}
              size="small"
              style={S.diffTable}
            />
          ) : (
            <Empty description="选择两个快照进行对比" />
          )}
        </TabPane>

        <TabPane tab="报价对比" itemKey="quotes">
          <Select
            placeholder="选择报价快照A"
            style={S.select}
            onChange={(v) => setQuoteA(v as string)}
          >
            {quoteHistory.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                v{s.version} — {s.label || new Date(s.createdAt).toLocaleString('zh-CN')}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="选择报价快照B"
            style={S.select}
            onChange={(v) => setQuoteB(v as string)}
          >
            {quoteHistory.filter((s) => s.id !== quoteA).map((s) => (
              <Select.Option key={s.id} value={s.id}>
                v{s.version} — {s.label || new Date(s.createdAt).toLocaleString('zh-CN')}
              </Select.Option>
            ))}
          </Select>
          {quoteDiffs ? (
            <div>
              <Title heading={6}>参数差异 ({quoteDiffs.paramDiffs.length}项)</Title>
              <Table
                dataSource={quoteDiffs.paramDiffs}
                columns={[
                  { title: '参数', dataIndex: 'label' },
                  { title: 'A', dataIndex: 'valueA', render: (v: unknown) => String(v) },
                  { title: 'B', dataIndex: 'valueB', render: (v: unknown) => String(v) },
                ]}
                rowKey={(row: any) => `${row.section ?? 'quote'}::${row.field}`}
                pagination={false}
                size="small"
              />
              <Title heading={6} style={{ marginTop: 12}}>结果差异 ({quoteDiffs.resultDiffs.length}项)</Title>
              <Table
                dataSource={quoteDiffs.resultDiffs}
                columns={[
                  { title: '线束', dataIndex: 'harnessId' },
                  { title: '指标', dataIndex: 'label' },
                  { title: 'A', dataIndex: 'valueA', render: (v: number) => `¥${v.toFixed(2)}` },
                  { title: 'B', dataIndex: 'valueB', render: (v: number) => `¥${v.toFixed(2)}` },
                  {
                    title: '变化率',
                    dataIndex: 'changeRate',
                    render: (v: number) => (
                      <Tag color={v > 0 ? 'red' : 'green'}>
                        {(v * 100).toFixed(2)}%
                      </Tag>
                    ),
                  },
                ]}
                rowKey={(r: any) => `${r.harnessId}-${r.field}`}
                pagination={false}
                size="small"
              />
            </div>
          ) : (
            <Empty description="选择两个报价快照进行对比" />
          )}
        </TabPane>
      </Tabs>
    </div>
  );
}
