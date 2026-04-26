import prisma from '../lib/prisma.js';
import { toJson } from '../lib/json.js';
export class AuditService {
    static async log(params) {
        return prisma.auditLog.create({
            data: {
                ...params,
                // [PR-040] 将扩展的 entity 类型转换为数据库支持的类型
                entity: params.entity,
                details: params.details ? toJson(params.details) : null,
            },
        });
    }
    static async getByProject(projectId) {
        return prisma.auditLog.findMany({
            where: { projectId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
}
