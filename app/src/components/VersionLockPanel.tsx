/**
 * VersionLockPanel (C23 — Issue #74)
 * 
 * 版本锁定/审批面板
 * - 显示版本状态和锁定信息
 * - 锁定/解锁操作
 * - 审批流操作(提交/审批/驳回)
 * - 回退预览
 * 
 * Usage:
 *   <VersionLockPanel
 *     version={currentVersion}
 *     canModify={canModify}
 *     modifyReason={modifyReason}
 *     onLock={(reason, expires) => lock(versionId, userId, reason, expires)}
 *     onUnlock={() => unlock(versionId)}
 *     onSubmitApproval={(approvers) => submitForApproval(versionId, userId, approvers)}
 *     onApprove={(comment) => approve(versionId, userId, comment)}
 *     onReject={(comment) => reject(versionId, userId, comment)}
 *   />
 */

import React, { useState } from 'react';
import type { VersionEntry } from '@/engine/version_governance';

interface VersionLockPanelProps {
  version: VersionEntry | null;
  canModify: boolean;
  modifyReason?: string;
  onLock: (reason: string, expiresAt: string | null) => void;
  onUnlock: () => void;
  onSubmitApproval: (approvers: string[]) => void;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#8c8c8c' },
  pending_approval: { label: '审批中', color: '#faad14' },
  approved: { label: '已审批', color: '#52c41a' },
  published: { label: '已发布', color: '#1890ff' },
  locked: { label: '已锁定', color: '#f5222d' },
  deprecated: { label: '已废弃', color: '#bfbfbf' },
};

const S = {
  panel: { padding: '16px', border: '1px solid #e8e8e8', borderRadius: '8px', background: '#fafafa' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as React.CSSProperties,
  title: { fontSize: '15px', fontWeight: 600 } as React.CSSProperties,
  badge: (color: string) => ({ padding: '2px 10px', borderRadius: '4px', fontSize: '12px', color: '#fff', background: color }) as React.CSSProperties,
  info: { fontSize: '13px', color: '#595959', lineHeight: 1.8 } as React.CSSProperties,
  actions: { display: 'flex', gap: '8px', marginTop: '12px' } as React.CSSProperties,
  btn: (bg: string) => ({ padding: '6px 16px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }) as React.CSSProperties,
  input: { width: '100%', padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '13px', marginTop: '4px' } as React.CSSProperties,
  warn: { padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '6px', fontSize: '13px', color: '#ad6800', marginTop: '8px' } as React.CSSProperties,
};

export const VersionLockPanel: React.FC<VersionLockPanelProps> = ({
  version, canModify, modifyReason, onLock, onUnlock, onSubmitApproval, onApprove, onReject,
}) => {
  const [lockReason, setLockReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvers, setApprovers] = useState('');

  if (!version) {
    return <div style={S.panel}><div style={S.info}>未选择版本</div></div>;
  }

  const statusInfo = STATUS_MAP[version.status] || { label: version.status, color: '#8c8c8c' };

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <div style={S.title}>版本: {version.label}</div>
        <span style={S.badge(statusInfo.color)}>{statusInfo.label}</span>
      </div>

      <div style={S.info}>
        <div>版本 ID: {version.versionId}</div>
        <div>创建时间: {new Date(version.createdAt).toLocaleString('zh-CN')}</div>
        <div>创建人: {version.createdBy}</div>
      </div>

      {!canModify && modifyReason && (
        <div style={S.warn}>⚠️ {modifyReason}</div>
      )}

      {version.lockInfo && (
        <div style={S.info}>
          <div>🔒 锁定人: {version.lockInfo.lockedBy}</div>
          <div>锁定原因: {version.lockInfo.reason}</div>
          {version.lockInfo.expiresAt && (
            <div>过期时间: {new Date(version.lockInfo.expiresAt).toLocaleString('zh-CN')}</div>
          )}
        </div>
      )}

      {version.approvalInfo && version.status === 'pending_approval' && (
        <div style={S.info}>
          <div>📋 审批状态: {version.approvalInfo.status}</div>
          <div>发起人: {version.approvalInfo.requestedBy}</div>
          <div>审批人: {version.approvalInfo.approvers.join(', ')}</div>
        </div>
      )}

      <div style={S.actions}>
        {version.status === 'draft' && (
          <>
            <input
              style={S.input}
              placeholder="锁定原因"
              value={lockReason}
              onChange={e => setLockReason(e.target.value)}
            />
            <button style={S.btn('#f5222d')} onClick={() => { onLock(lockReason, null); setLockReason(''); }}>
              🔒 锁定
            </button>
            <input
              style={S.input}
              placeholder="审批人 (逗号分隔)"
              value={approvers}
              onChange={e => setApprovers(e.target.value)}
            />
            <button style={S.btn('#1890ff')} onClick={() => { onSubmitApproval(approvers.split(',').map(s => s.trim())); setApprovers(''); }}>
              📋 提交审批
            </button>
          </>
        )}

        {version.status === 'locked' && (
          <button style={S.btn('#52c41a')} onClick={onUnlock}>🔓 解锁</button>
        )}

        {version.status === 'pending_approval' && (
          <>
            <input
              style={S.input}
              placeholder="审批意见"
              value={approvalComment}
              onChange={e => setApprovalComment(e.target.value)}
            />
            <button style={S.btn('#52c41a')} onClick={() => { onApprove(approvalComment); setApprovalComment(''); }}>
              ✅ 通过
            </button>
            <button style={S.btn('#f5222d')} onClick={() => { onReject(approvalComment); setApprovalComment(''); }}>
              ❌ 驳回
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VersionLockPanel;
