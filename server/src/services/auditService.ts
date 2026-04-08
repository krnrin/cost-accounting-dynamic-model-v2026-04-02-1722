import prisma from '../lib/prisma.js';
import { toJson } from '../lib/json.js';

export class AuditService {
  static async log(params: {
    userId: string;
    projectId?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
    entity: 'project' | 'harness' | 'quote' | 'version';
    entityId: string;
    details?: any;
  }) {
    return prisma.auditLog.create({
      data: {
        ...params,
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
