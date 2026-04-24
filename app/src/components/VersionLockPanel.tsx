import { useState } from 'react';
import { Button, Card, Input, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { VersionRecord } from '@/types/version';

const { Text } = Typography;

interface VersionLockPanelProps {
  version: VersionRecord | null;
  loading?: boolean;
  onLock: (reason?: string) => void | Promise<void>;
  onUnlock: () => void | Promise<void>;
  onSubmitApproval: (comment?: string) => void | Promise<void>;
  onApprove: (comment?: string) => void | Promise<void>;
  onReject: (comment?: string) => void | Promise<void>;
}

function approvalColor(status?: 'not_submitted' | 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'pending') return 'orange';
  return 'grey';
}

export default function VersionLockPanel({
  version,
  loading,
  onLock,
  onUnlock,
  onSubmitApproval,
  onApprove,
  onReject,
}: VersionLockPanelProps) {
  const [lockReason, setLockReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');

  if (!version) {
    return (
      <Card headerLine={false} title="版本治理">
        <Text type="tertiary">请选择一个版本查看治理信息。</Text>
      </Card>
    );
  }

  const approvalStatus = version.approvalInfo?.status ?? 'not_submitted';
  const isLocked = Boolean(version.lockInfo?.locked);

  return (
    <Card headerLine={false} title="版本治理">
      <Space vertical align="start" style={{ width: '100%' }}>
        <Space wrap>
          <Tag color={isLocked ? 'red' : 'green'}>{isLocked ? '已锁定' : '可编辑'}</Tag>
          <Tag color={approvalColor(approvalStatus)}>审批: {approvalStatus}</Tag>
          <Tag>{version.status}</Tag>
        </Space>

        <div>
          <Text strong>{version.label}</Text>
          <br />
          <Text type="tertiary">{new Date(version.createdAt).toLocaleString('zh-CN')}</Text>
        </div>

        {isLocked ? (
          <Text type="tertiary">
            锁定人: {version.lockInfo?.lockedBy || '-'} / 原因: {version.lockInfo?.reason || '-'}
          </Text>
        ) : null}

        {approvalStatus !== 'not_submitted' ? (
          <Text type="tertiary">
            提交: {version.approvalInfo?.submittedBy || '-'} / 审批: {version.approvalInfo?.reviewedBy || '-'}
          </Text>
        ) : null}

        <Input
          placeholder="锁定原因 / 审批意见"
          value={approvalComment || lockReason}
          onChange={(value) => {
            setApprovalComment(value);
            setLockReason(value);
          }}
        />

        <Space wrap>
          {isLocked ? (
            <Button loading={loading} onClick={() => void onUnlock()}>
              解锁
            </Button>
          ) : (
            <Button loading={loading} type="danger" onClick={() => void onLock(lockReason.trim() || undefined)}>
              锁定
            </Button>
          )}

          <Button loading={loading} onClick={() => void onSubmitApproval(approvalComment.trim() || undefined)}>
            提交审批
          </Button>
          <Button loading={loading} type="primary" onClick={() => void onApprove(approvalComment.trim() || undefined)}>
            审批通过
          </Button>
          <Button loading={loading} type="danger" theme="borderless" onClick={() => void onReject(approvalComment.trim() || undefined)}>
            驳回
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
