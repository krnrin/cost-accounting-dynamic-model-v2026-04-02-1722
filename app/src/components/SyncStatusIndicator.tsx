import React, { useMemo } from 'react';
import { Tag, Tooltip } from '@douyinfe/semi-ui';
import { IconSync, IconCloud } from '@douyinfe/semi-icons';
import { useSyncStore } from '@/store/syncStore';
import { syncEngine } from '@/sync/syncEngine';

const SyncStatusIndicator: React.FC = () => {
  const { isOnline, isSyncing, lastSyncAt, pendingCount, errors } = useSyncStore();

  const status = useMemo(() => {
    if (!isOnline) {
      return {
        color: 'red' as const,
        text: '离线',
        icon: <IconSync />,
      };
    }
    if (isSyncing) {
      return {
        color: 'yellow' as const,
        text: '同步中...',
        icon: <IconSync spin />,
      };
    }
    if (pendingCount > 0) {
      return {
        color: 'orange' as const,
        text: `${pendingCount} 条待同步`,
        icon: <IconSync />,
      };
    }
    return {
      color: 'green' as const,
      text: '已同步',
      icon: <IconCloud />,
    };
  }, [isOnline, isSyncing, pendingCount]);

  const lastSyncText = lastSyncAt 
    ? `上次同步: ${new Date(lastSyncAt).toLocaleString()}`
    : '尚未同步';

  const tooltipContent = (
    <div>
      <div>{lastSyncText}</div>
      {errors.length > 0 && (
        <div style={{ marginTop: 8, color: 'var(--semi-color-danger)' }}>
          <strong>最近错误:</strong>
          {errors.map((err, i) => <div key={i}>• {err}</div>)}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <Tag
        color={status.color}
        prefixIcon={status.icon}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => syncEngine.sync()}
      >
        {status.text}
      </Tag>
    </Tooltip>
  );
};

export default SyncStatusIndicator;
