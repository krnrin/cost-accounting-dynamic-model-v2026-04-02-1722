import React, { useState } from 'react';
import { 
  Card, Button, Tag, Modal, Input, Popconfirm, 
  Typography, Space, List, Toast, Banner, TextArea
} from '@douyinfe/semi-ui';
import { 
  IconPlus, IconDelete, IconLock
} from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { versionRepo } from '@/data/repositories';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { 
  VersionRecord, VersionStatus, VERSION_STATUS_LABELS, 
  VERSION_TRANSITIONS, VersionDiff, validateTransition
} from '@/types/version';
import { computeVersionDiff } from '@/engine/version_diff';
import { VersionDiffView } from './VersionDiffView';

const { Text } = Typography;

interface Props {
  projectId: string;
}

const statusColors: Record<VersionStatus, any> = {
  draft: 'grey',
  bom_ready: 'blue',
  reviewed: 'orange',
  locked: 'green',
  archived: 'purple',
};

export const VersionPanel: React.FC<Props> = ({ projectId }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newVersion, setNewVersion] = useState({ label: '', notes: '' });
  const [diffModal, setDiffModal] = useState<{ visible: boolean; diff?: VersionDiff }>({ visible: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const versions = useLiveQuery(() => versionRepo.listByProject(projectId), [projectId]);

  const handleCreate = async (customLabel?: string) => {
    const label = customLabel || newVersion.label;
    if (!label.trim()) {
      Toast.error('请输入版本标签');
      return;
    }

    try {
      const project = await db.projects.get(projectId);
      const harnesses = await db.harnesses.where('projectId').equals(projectId).toArray();
      
      if (!project) return;

      const versionNumber = await versionRepo.getNextVersionNumber(projectId);
      
      const results = harnesses.map(h => computeHarnessCost(h.input, project.config!.costRates, project.config!.metalPrices));
      const projSummary = computeProjectFromHarnesses(results);

      const record: VersionRecord = {
        id: crypto.randomUUID(),
        projectId,
        versionNumber,
        label,
        status: 'draft',
        createdAt: new Date().toISOString(),
        notes: customLabel ? '从设变自动创建' : newVersion.notes,
        snapshot: {
          harnesses: harnesses.map(h => ({
            harnessId: h.harnessId,
            harnessName: h.harnessName,
            input: h.input,
          })),
          config: project.config!,
          summary: {
            vehicleCost: projSummary.vehicleCost,
            totalMaterial: projSummary.weightedMaterial,
            totalLabor: projSummary.weightedLabor,
            harnessCount: harnesses.length,
          }
        }
      };

      await versionRepo.create(record);
      Toast.success(`版本 v${versionNumber} 创建成功`);
      setIsCreating(false);
      setNewVersion({ label: '', notes: '' });
    } catch (err) {
      console.error(err);
      Toast.error('创建版本失败');
    }
  };

  const handleCreateChangeVersion = async () => {
    const nextNum = await versionRepo.getNextVersionNumber(projectId);
    await handleCreate(`设变 v${nextNum}`);
  };

  const handleStatusChange = async (id: string, currentStatus: VersionStatus, nextStatus: VersionStatus) => {
    const validation = validateTransition(currentStatus, nextStatus);
    if (!validation.valid) {
      Toast.error(validation.reason || '非法状态流转');
      return;
    }

    const performUpdate = async () => {
      await versionRepo.updateStatus(id, nextStatus);
      Toast.success('状态已更新');
    };

    if (nextStatus === 'locked') {
      Modal.confirm({
        title: '确认锁定',
        content: '锁定后版本数据将无法修改，确认锁定？',
        onOk: performUpdate
      });
    } else {
      await performUpdate();
    }
  };

  const handleCompare = () => {
    if (selectedIds.length !== 2) {
      Toast.warning('请选择两个版本进行对比');
      return;
    }

    const v1 = versions?.find(v => v.id === selectedIds[0]);
    const v2 = versions?.find(v => v.id === selectedIds[1]);

    if (v1 && v2) {
      const [before, after] = v1.versionNumber < v2.versionNumber ? [v1, v2] : [v2, v1];
      const diff = computeVersionDiff(before.snapshot, after.snapshot);
      diff.beforeVersion = `v${before.versionNumber} (${before.label})`;
      diff.afterVersion = `v${after.versionNumber} (${after.label})`;
      
      setDiffModal({ visible: true, diff });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].slice(-2)
    );
  };

  return (
    <Card 
      title="版本管理" 
      headerExtraContent={
        <Space>
          <Button 
            disabled={selectedIds.length !== 2}
            onClick={handleCompare}
          >
            对比
          </Button>
          <Button 
            icon={<IconPlus />} 
            onClick={handleCreateChangeVersion}
          >
            从设变创建版本
          </Button>
          <Button 
            type="primary" 
            icon={<IconPlus />} 
            onClick={() => setIsCreating(true)}
          >
            创建快照
          </Button>
        </Space>
      }
      style={{ marginTop: 24, background: 'var(--semi-color-bg-2)' }}
    >
      {!versions || versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="tertiary">暂无版本记录，点击右上角创建第一个版本快照。</Text>
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
                transition: 'all 0.2s'
              }}
              onClick={() => toggleSelect(item.id)}
              extra={
                <Space>
                  {VERSION_TRANSITIONS[item.status].map(nextStatus => (
                    <Button 
                      key={nextStatus}
                      size="small" 
                      theme="light"
                      icon={nextStatus === 'locked' ? <IconLock /> : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(item.id, item.status, nextStatus);
                      }}
                    >
                      转为 {VERSION_STATUS_LABELS[nextStatus]}
                    </Button>
                  ))}
                  <Popconfirm
                    title="确定删除此版本吗？"
                    onConfirm={() => versionRepo.remove(item.id)}
                  >
                    <Button 
                      icon={<IconDelete />} 
                      type="danger" 
                      theme="borderless" 
                      onClick={e => e.stopPropagation()} 
                    />
                  </Popconfirm>
                </Space>
              }
            >
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Text strong>v{item.versionNumber}</Text>
                  <Text>{item.label}</Text>
                  <Tag color={statusColors[item.status]}>{VERSION_STATUS_LABELS[item.status]}</Tag>
                </div>
                <div>
                  <Text size="small" type="tertiary">创建时间: {new Date(item.createdAt).toLocaleString()}</Text>
                  {item.notes && <Text size="small" type="secondary" style={{ marginLeft: 8 }}>{item.notes}</Text>}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}

      {/* Create Version Modal */}
      <Modal
        title="创建版本快照"
        visible={isCreating}
        onOk={() => handleCreate()}
        onCancel={() => setIsCreating(false)}
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ marginBottom: 4, display: 'block' }}>版本标签 (如: RFQ第一轮, 优化后BOM)</Text>
            <Input 
              value={newVersion.label} 
              onChange={v => setNewVersion(prev => ({ ...prev, label: v }))}
              placeholder="请输入版本标签"
            />
          </div>
          <div>
            <Text style={{ marginBottom: 4, display: 'block' }}>备注 (可选)</Text>
            <TextArea 
              value={newVersion.notes} 
              onChange={v => setNewVersion(prev => ({ ...prev, notes: v }))}
              placeholder="输入版本更新说明..."
              rows={3}
            />
          </div>
          <Banner 
            fullMode={false} 
            type="info" 
            description="快照将保存当前项目的所有线束输入和成本配置，锁定后不可修改。" 
          />
        </div>
      </Modal>

      {/* Diff Modal */}
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
