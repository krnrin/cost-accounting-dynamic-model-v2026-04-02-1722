import prisma from '../lib/prisma.js';
import { toJson } from '../lib/json.js';

export class AuditService {
  static async log(params: {
    userId: string;
    projectId?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
    // [PR-040] 扩展 entity 类型支持更多实体
    entity: 'project' | 'harness' | 'bom' | 'quote' | 'version' | 'scenario' | 'change' | 'tracking' | 'pricing' | 'setting' | 'alert' | 'alertRule' | 'simulation' | 'annualDrop' | 'recovery';
    entityId: string;
    details?: any;
  }) {
    return prisma.auditLog.create({
      data: {
        ...params,
        // [PR-040] 将扩展的 entity 类型转换为数据库支持的类型
        entity: params.entity as 'project' | 'harness' | 'bom' | 'quote' | 'version' | 'scenario' | 'change' | 'tracking' | 'pricing' | 'setting' | 'alert',
        details: params.details ? toJson(params.details) : null,
      },
    });
  }

  static async getByProject(projectId: string) {
    return prisma.auditLog.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
