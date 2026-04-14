/**
 * C6: 快照恢复对话框
 *
 * 允许用户选择一个历史参数快照，预览差异后确认恢复。
 */
import { useState, useMemo } from 'react';
import { Modal, Table, Tag, Typography, Select, Button, Banner } from '@douyinfe/semi-ui';
import { useSnapshotIntegration } from '@/hooks/useSnapshotIntegration';
import { useSettingsSnapshotStore, type SettingsSnapshot } from '@/store/settingsSnapshotStore';
import type { CSSProperties } from 'react';

const { Text } = Typography;

const S: Record<string, CSSProperties> = {
  select: { width: '100%', marginBottom: 16 },
  diffSection: { marginTop: 16, marginBottom: 16 },
};

interface SnapshotRestoreDialogProps {
  visible: boolean;
  currentSettings: SettingsSnapshot['data'];
  onCancel: () => void;
  onRestored: () => void;
}

export default function SnapshotRestoreDialog({
  visible,
  currentSettings,
  onCancel,
  onRestored,
}: SnapshotRestoreDialogProps) {
  const { settingsHistory, restore, isLoading } = useSnapshotIntegration();
  const { compareSnapshots } = useSettingsSnapshotStore();
  const [selectedId, setSelectedId] = useState<string>('');
  const [restoring, setRestoring] = useState(false);

  const selectedSnapshot = useMemo(
    () => settingsHistory.find((s) => s.id === selectedId),
    [selectedId, settingsHistory]
  );

  // 创建一个虚拟的"当前"快照用于对比
  const currentAsSnapshot: SettingsSnapshot = useMemo(
    () => ({
      id: '__current__',
      timestamp: new Date().toISOString(),
      reason: 'manual',
      data: currentSettings,
      summary: '当前参数',
    }),
    [currentSettings]
  );

  const diffs = useMemo(() => {
    if (!selectedSnapshot) return [];
    return compareSnapshots(currentAsSnapshot, selectedSnapshot);
  }, [selectedSnapshot, currentAsSnapshot, compareSnapshots]);

  const handleRestore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      const success = await restore(selectedId);
      if (success) {
        onRestored();
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      title="从快照恢复参数"
      visible={visible}
      onCancel={onCancel}
      width={700}
      footer={
        <div>
          <Button onClick={onCancel} style={{ marginRight: 8}}>取消</Button>
          <Button
            type="warning"
            onClick={handleRestore}
            loading={restoring || isLoading}
            disabled={!selectedId || diffs.length === 0}
          >
            确认恢复
          </Button>
        </div>
      }
    >
      <Banner
        type="warning"
        description="恢复操作将把全局参数回退到选中快照的状态，当前参数将被覆盖。建议先手动保存当前参数快照。"
        style={{ marginBottom: 16}}/>

      <Select
        placeholder="选择要恢复的快照"
        style={S.select}
        onChange={(v) => setSelectedId(v as string)}
        optionList={settingsHistory.map((s) => ({
          value: s.id,
          label: `${new Date(s.timestamp).toLocaleString('zh-CN')} — ${s.reason} — ${s.summary}`,
        }))}
      />

      {diffs.length > 0 && (
        <div style={S.diffSection}>
          <Text strong>将发生以下变更 ({diffs.length}项):</Text>
          <Table
            dataSource={diffs}
            columns={[
              { title: '参数', dataIndex: 'label', width: 120 },
              {
                title: '当前值',
                dataIndex: 'newValue',
                render: (v: unknown) => <Text type="danger">{String(v)}</Text>,
              },
              {
                title: '恢复为',
                dataIndex: 'oldValue',
                render: (v: unknown) => <Text type="success">{String(v)}</Text>,
              },
            ]}
            rowKey="field"
            pagination={false}
            size="small"
          />
        </div>
      )}

      {selectedId && diffs.length === 0 && (
        <Banner type="info" description="选中快照与当前参数完全一致，无需恢复。" />
      )}
    </Modal>
  );
}
