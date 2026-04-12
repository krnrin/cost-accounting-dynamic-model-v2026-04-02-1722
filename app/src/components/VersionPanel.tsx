import React, { useEffect, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconLock, IconPlus } from '@douyinfe/semi-icons';
import { apiClient } from '@/lib/apiClient';
import {
  type VersionDiff,
  type VersionRecord,
  type VersionStatus,
  VERSION_STATUS_LABELS,
  VERSION_TRANSITIONS,
  validateTransition,
} from '@/types/version';
import { computeVersionDiff } from '@/engine/version_diff';
import {
  buildVersionSnapshot,
  type HarnessVersionSource,
  type ProjectVersionSource,
} from '@/lib/versionSnapshot';
import { VersionDiffView } from './VersionDiffView';

const { Text } = Typography;

interface Props {
  projectId: string;
}

const statusColors: Record<VersionStatus, 'grey' | 'blue' | 'orange' | 'green' | 'purple'> = {
  draft: 'grey',
  bom_ready: 'blue',
  reviewed: 'orange',
  locked: 'green',
  published: 'green',
  archived: 'purple',
};

export const VersionPanel: React.FC<Props> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [projectSource, setProjectSource] = useState<ProjectVersionSource | null>(null);
  const [harnessSource, setHarnessSource] = useState<HarnessVersionSource[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newVersion, setNewVersion] = useState({ label: '', notes: '' });
  const [diffModal, setDiffModal] = useState<{ visible: boolean; diff?: VersionDiff }>({ visible: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadPanelData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [versionRows, projectRow, harnessRows] = await Promise.all([
        apiClient<VersionRecord[]>(`/versions/project/${projectId}`),
        apiClient<ProjectVersionSource>(`/projects/${projectId}`),
        apiClient<HarnessVersionSource[]>(`/projects/${projectId}/harnesses`),
      ]);
      setVersions(Array.isArray(versionRows) ? versionRows : []);
      setProjectSource(projectRow);
      setHarnessSource(Array.isArray(harnessRows) ? harnessRows : []);
    } catch (err) {
      console.error('Failed to load version panel data:', err);
      setError(err instanceof Error ? err.message : '版本数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPanelData();
  }, [projectId]);

  const handleCreate = async (customLabel?: string) => {
    const label = (customLabel || newVersion.label).trim();
    if (!label) {
      Toast.error('请输入版本标签');
      return;
    }

    if (!projectSource) {
      Toast.error('项目快照源未加载完成');
      return;
    }

    try {
      const nextVersionNumber = versions.reduce((max, item) => Math.max(max, item.versionNumber), 0) + 1;
      const snapshot = buildVersionSnapshot(projectSource, harnessSource);
      await apiClient('/versions', {
        method: 'POST',
        body: {
          projectId,
          versionNumber: nextVersionNumber,
          label,
          status: 'draft',
          notes: customLabel ? '从设变自动创建' : newVersion.notes,
          snapshot,
        },
      });

      Toast.success(`版本 v${nextVersionNumber} 创建成功`);
      setIsCreating(false);
      setNewVersion({ label: '', notes: '' });
      await loadPanelData();
    } catch (err) {
      console.error('Failed to create version:', err);
      Toast.error(err instanceof Error ? err.message : '创建版本失败');
    }
  };

  const handleCreateChangeVersion = async () => {
    const nextVersionNumber = versions.reduce((max, item) => Math.max(max, item.versionNumber), 0) + 1;
    await handleCreate(`设变 v${nextVersionNumber}`);
  };

  const handleStatusChange = async (id: string, currentStatus: VersionStatus, nextStatus: VersionStatus) => {
    const validation = validateTransition(currentStatus, nextStatus);
    if (!validation.valid) {
      Toast.error(validation.reason || '非法状态流转');
      return;
    }

    const submit = async () => {
      await apiClient(`/versions/${id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      Toast.success('状态已更新');
      await loadPanelData();
    };

    if (nextStatus === 'locked') {
      Modal.confirm({
        title: '确认锁定',
        content: '锁定后版本数据将不可修改，确认继续？',
        onOk: submit,
      });
      return;
    }

    await submit();
  };

  const handleDelete = async (id: string) => {
    await apiClient(`/versions/${id}`, {
      method: 'DELETE',
    });
    Toast.success('版本已删除');
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    await loadPanelData();
  };

  const handleCompare = () => {
    if (selectedIds.length !== 2) {
      Toast.warning('请选择两个版本进行对比');
      return;
    }

    const left = versions.find((item) => item.id === selectedIds[0]);
    const right = versions.find((item) => item.id === selectedIds[1]);
    if (!left || !right) {
      Toast.error('未找到待对比版本');
      return;
    }

    const [before, after] = left.versionNumber < right.versionNumber ? [left, right] : [right, left];
    const diff = computeVersionDiff(before.snapshot, after.snapshot);
    diff.beforeVersion = `v${before.versionNumber} (${before.label})`;
    diff.afterVersion = `v${after.versionNumber} (${after.label})`;
    setDiffModal({ visible: true, diff });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(-2)));
  };

  return (
    <Card
      title="版本管理"
      headerExtraContent={(
        <Space>
          <Button disabled={selectedIds.length !== 2} onClick={handleCompare}>
            对比
          </Button>
          <Button icon={<IconPlus />} onClick={() => void handleCreateChangeVersion()}>
            从设变创建版本
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={() => setIsCreating(true)}>
            创建快照
          </Button>
        </Space>
      )}
      style={{ marginTop: 24, background: 'var(--semi-color-bg-2)' }}
    >
      {error && <Banner fullMode={false} type="danger" description={error} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Empty description="暂无版本记录，点击右上角创建第一个版本快照" />
        </div>
      ) : (
        <List
          dataSource={versions}
          renderItem={(item: VersionRecord) => (
            <List.Item
              style={{
                padding: '12px 16px',
                border: selectedIds.includes(item.id) ? '1px solid var(--semi-color-primary)' : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 8,
                transition: 'all 0.2s',
              }}
              onClick={() => toggleSelect(item.id)}
              extra={(
                <Space>
                  {VERSION_TRANSITIONS[item.status].map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      size="small"
                      theme="light"
                      icon={nextStatus === 'locked' ? <IconLock /> : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleStatusChange(item.id, item.status, nextStatus);
                      }}
                    >
                      转为 {VERSION_STATUS_LABELS[nextStatus]}
                    </Button>
                  ))}
                  <Popconfirm title="确定删除此版本吗？" onConfirm={() => void handleDelete(item.id)}>
                    <Button
                      icon={<IconDelete />}
                      type="danger"
                      theme="borderless"
                      onClick={(event) => event.stopPropagation()}
                    />
                  </Popconfirm>
                </Space>
              )}
            >
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Text strong>v{item.versionNumber}</Text>
                  <Text>{item.label}</Text>
                  <Tag color={statusColors[item.status]}>{VERSION_STATUS_LABELS[item.status]}</Tag>
                </div>
                <div>
                  <Text size="small" type="tertiary">
                    创建时间: {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </Text>
                  {item.notes && (
                    <Text size="small" type="secondary" style={{ marginLeft: 8 }}>
                      {item.notes}
                    </Text>
                  )}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}

      <Modal
        title="创建版本快照"
        visible={isCreating}
        onOk={() => void handleCreate()}
        onCancel={() => setIsCreating(false)}
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ marginBottom: 4, display: 'block' }}>版本标签</Text>
            <Input
              value={newVersion.label}
              onChange={(value) => setNewVersion((prev) => ({ ...prev, label: value }))}
              placeholder="例如：RFQ 第一轮 / 设变后 BOM"
            />
          </div>
          <div>
            <Text style={{ marginBottom: 4, display: 'block' }}>备注</Text>
            <TextArea
              value={newVersion.notes}
              onChange={(value) => setNewVersion((prev) => ({ ...prev, notes: value }))}
              placeholder="输入版本更新说明..."
              rows={3}
            />
          </div>
          <Banner
            fullMode={false}
            type="info"
            description={`快照将保存当前项目的版本事实源。项目：${projectSource?.projectName || projectId}，线束数：${harnessSource.length}`}
          />
        </div>
      </Modal>

      <Modal
        title="版本差异对比"
        visible={diffModal.visible}
        onCancel={() => setDiffModal({ visible: false })}
        width={900}
        footer={null}
      >
        {diffModal.diff && <VersionDiffView diff={diffModal.diff} />}
      </Modal>
    </Card>
  );
};
