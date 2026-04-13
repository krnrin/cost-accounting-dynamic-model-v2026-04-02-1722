/**
 * 审计追踪 React Hook (Issue #74)
 *
 * 封装 audit_trace 引擎，提供：
 * - 查询审计日志
 * - 构建审计链
 * - 创建审计记录
 */
import { useState, useCallback } from 'react';
import {
  getAuditLog,
  buildAuditChain,
  createAuditRecord,
  type AuditRecord,
  type AuditChain,
  type AuditScope,
} from '@/engine/audit_trace';

export interface UseAuditTraceReturn {
  /** 当前查询结果 */
  records: AuditRecord[];
  /** 当前审计链 */
  chain: AuditChain | null;
  /** 加载状态 */
  isLoading: boolean;

  /** 查询审计日志 */
  query: (filter?: {
    scope?: AuditScope;
    projectId?: string;
    scenarioId?: string;
    since?: string;
    limit?: number;
  }) => void;

  /** 构建审计链 */
  traceChain: (rootId: string) => AuditChain | null;

  /** 创建审计记录 */
  record: typeof createAuditRecord;
}

export function useAuditTrace(): UseAuditTraceReturn {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [chain, setChain] = useState<AuditChain | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const query = useCallback((filter?: Parameters<typeof getAuditLog>[0]) => {
    setIsLoading(true);
    try {
      const result = getAuditLog(filter);
      setRecords(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const traceChain = useCallback((rootId: string) => {
    const result = buildAuditChain(rootId);
    setChain(result);
    return result;
  }, []);

  return {
    records,
    chain,
    isLoading,
    query,
    traceChain,
    record: createAuditRecord,
  };
}
