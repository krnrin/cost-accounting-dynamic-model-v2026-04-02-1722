/**
 * audit_trace 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAuditId,
  createAuditRecord,
  getAuditLog,
  buildAuditChain,
  clearAuditLog,
} from '../audit_trace';

describe('audit_trace', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe('generateAuditId', () => {
    it('应生成正确格式的ID', () => {
      const id = generateAuditId('FREEZE');
      expect(id).toMatch(/^AUD-FREEZE-\d{8}-[a-z0-9]{5}$/);
    });

    it('不同调用应生成不同ID', () => {
      const id1 = generateAuditId('FREEZE');
      const id2 = generateAuditId('FREEZE');
      expect(id1).not.toBe(id2);
    });
  });

  describe('createAuditRecord', () => {
    it('应创建并存储审计记录', () => {
      const record = createAuditRecord('FREEZE', '场景冻结', {
        projectId: 'proj-001',
        scenarioId: 'sc-001',
      });

      expect(record.id).toMatch(/^AUD-FREEZE-/);
      expect(record.scope).toBe('FREEZE');
      expect(record.action).toBe('场景冻结');
      expect(record.projectId).toBe('proj-001');

      // 应在日志中
      const log = getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].id).toBe(record.id);
    });
  });

  describe('getAuditLog', () => {
    it('应按时间倒序返回', () => {
      createAuditRecord('FREEZE', 'first');
      createAuditRecord('ECN', 'second');
      createAuditRecord('METAL', 'third');

      const log = getAuditLog();
      expect(log).toHaveLength(3);
      expect(log[0].action).toBe('third');
      expect(log[2].action).toBe('first');
    });

    it('应按 scope 过滤', () => {
      createAuditRecord('FREEZE', 'a');
      createAuditRecord('ECN', 'b');
      createAuditRecord('FREEZE', 'c');

      const log = getAuditLog({ scope: 'FREEZE' });
      expect(log).toHaveLength(2);
    });

    it('应按 projectId 过滤', () => {
      createAuditRecord('FREEZE', 'a', { projectId: 'p1' });
      createAuditRecord('ECN', 'b', { projectId: 'p2' });

      const log = getAuditLog({ projectId: 'p1' });
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('a');
    });

    it('应限制返回数量', () => {
      for (let i = 0; i < 10; i++) {
        createAuditRecord('FREEZE', `record-${i}`);
      }

      const log = getAuditLog({ limit: 3 });
      expect(log).toHaveLength(3);
    });
  });

  describe('buildAuditChain', () => {
    it('应构建完整审计链', () => {
      const r1 = createAuditRecord('FREEZE', '冻结场景');
      const r2 = createAuditRecord('SNAPSHOT', '创建快照', {
        relatedAuditIds: [r1.id],
      });
      const r3 = createAuditRecord('QUOTE', '生成报价', {
        relatedAuditIds: [r1.id, r2.id],
      });

      const chain = buildAuditChain(r1.id);
      expect(chain).not.toBeNull();
      expect(chain!.rootId).toBe(r1.id);
      expect(chain!.records).toHaveLength(3);
      expect(chain!.summary).toContain('3条记录');
    });

    it('不存在的 rootId 应返回 null', () => {
      const chain = buildAuditChain('non-existent');
      expect(chain).toBeNull();
    });

    it('单个记录也能构建链', () => {
      const r1 = createAuditRecord('MANUAL', '手动操作');
      const chain = buildAuditChain(r1.id);
      expect(chain).not.toBeNull();
      expect(chain!.records).toHaveLength(1);
    });
  });
});
