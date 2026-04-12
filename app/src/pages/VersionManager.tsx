/**
 * B12: 版本管理页面
 * 报价快照历史、参数变更时间线、快照对比
 */
import { useState, useEffect } from 'react';
import { Table, Button, Tag, Typography, Modal, Timeline, Select, Space } from '@douyinfe/semi-ui';
import { useSettingsSnapshotStore, type SettingsSnapshot } from '@/store/settingsSnapshotStore';
import { loadQuoteSnapshots, type QuoteSnapshot, compareQuoteSnapshots } from '@/engine/quote_snapshot';
import type { CSSProperties } from 'react';

const { Title, Text } = Typography;

const S: Record<string, CSSProperties> = {
  container: { maxWidth: 1200, margin: '0 auto', padding: 24 },
  sectionTitle: { marginTop: 24 },
  textMl8: { marginLeft: 8 },
  modalSelect: { width: '100%', marginBottom: 16 },
  diffSection: { marginTop: 16 },
};

const paginationConfig = { pageSize: 20 };

export default function VersionManager() {
  const { snapshots, loadSnapshots } = useSettingsSnapshotStore();
  const [quoteSnapshots, setQuoteSnapshots] = useState<QuoteSnapshot[]>([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [selectedA, setSelectedA] = useState<string>('');
  const [selectedB, setSelectedB] = useState<string>('');

  useEffect(() => {
    loadSnapshots({ limit: 100 });
    loadQuoteSnapshots({ limit: 50 }).then(setQuoteSnapshots);
  }, []);

  const columns = [
    { title: '时间', dataIndex: 'createdAt', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
    { title: '版本号', dataIndex: 'version', render: (v: number) => `v${v}` },
    { title: '标签', dataIndex: 'label' },
    { title: '到厂价汇总', dataIndex: 'results', render: (r: QuoteSnapshot['results']) => r ? `\u00a5${(r as any).totalDeliveredPrice?.toFixed(2) ?? '-'}` : '-' },
    {
      title: '操作',
      render: (_: unknown, record: QuoteSnapshot) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedA(record.id); setCompareModalVisible(true); }}>对比</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={S.container}>
      <Title heading={3}>📋 版本管理</Title>

      <Title heading={5} style={S.sectionTitle}>报价快照历史</Title>
      <Table columns={columns} dataSource={quoteSnapshots} rowKey="id" pagination={paginationConfig} />

      <Title heading={5} style={S.sectionTitle}>参数变更时间线</Title>
      <Timeline>
        {snapshots.slice(0, 20).map((snap: SettingsSnapshot) => (
          <Timeline.Item key={snap.id} time={new Date(snap.timestamp).toLocaleString('zh-CN')}>
            <Tag color={snap.reason === 'manual' ? 'blue' : 'green'} size="small">{snap.reason}</Tag>
            <Text style={S.textMl8}>{snap.summary}</Text>
          </Timeline.Item>
        ))}
      </Timeline>

      <Modal
        title="快照对比"
        visible={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        width={800}
        footer={null}
      >
        <Select
          placeholder="选择对比目标"
          style={S.modalSelect}
          onChange={(v) => setSelectedB(v as string)}
        >
          {quoteSnapshots.filter(s => s.id !== selectedA).map(s => (
            <Select.Option key={s.id} value={s.id}>
              v{s.version} - {s.label || new Date(s.createdAt).toLocaleString('zh-CN')}
            </Select.Option>
          ))}
        </Select>
        {selectedA && selectedB && (() => {
          const snapA = quoteSnapshots.find(s => s.id === selectedA);
          const snapB = quoteSnapshots.find(s => s.id === selectedB);
          if (!snapA || !snapB) return null;
          const { paramDiffs, resultDiffs } = compareQuoteSnapshots(snapA, snapB);
          return (
            <div>
              <Title heading={6}>参数差异</Title>
              <Table
                dataSource={paramDiffs}
                columns={[
                  { title: '参数', dataIndex: 'label' },
                  { title: `v${snapA.version}`, dataIndex: 'valueA', render: (v: unknown) => String(v) },
                  { title: `v${snapB.version}`, dataIndex: 'valueB', render: (v: unknown) => String(v) },
                ]}
                rowKey="field"
                pagination={false}
                size="small"
              />
              <Title heading={6} style={S.diffSection}>结果差异</Title>
              <Table
                dataSource={resultDiffs}
                columns={[
                  { title: '线束', dataIndex: 'harnessId' },
                  { title: '指标', dataIndex: 'label' },
                  { title: `v${snapA.version}`, dataIndex: 'valueA', render: (v: number) => `\u00a5${v.toFixed(2)}` },
                  { title: `v${snapB.version}`, dataIndex: 'valueB', render: (v: number) => `\u00a5${v.toFixed(2)}` },
                  { title: '变化', dataIndex: 'change', render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v > 0 ? '+' : ''}{v.toFixed(2)}</Tag> },
                ]}
                rowKey={(r: any) => `${r.harnessId}-${r.field}`}
                pagination={false}
                size="small"
              />
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
