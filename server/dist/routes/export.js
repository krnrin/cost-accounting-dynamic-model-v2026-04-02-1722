import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ExportService } from '../services/exportService.js';
import prisma from '../lib/prisma.js';
const router = Router();
const exportRequestSchema = z.object({
    projectId: z.string().optional(),
    quoteId: z.string().optional(),
}).refine((value) => Boolean(value.projectId || value.quoteId), {
    message: 'projectId or quoteId is required',
});
router.use(authMiddleware);
/**
 * [PR-033] 项目成员校验中间件
 * 确保用户只能导出自己有权限访问的项目
 */
async function checkProjectMembership(req, res, next) {
    try {
        const payload = exportRequestSchema.parse(req.body ?? {});
        const userId = req.user.id;
        let projectId;
        if (payload.projectId) {
            projectId = payload.projectId;
        }
        else if (payload.quoteId) {
            // 通过 quote 反查 projectId
            const quote = await prisma.quote.findUnique({
                where: { id: payload.quoteId },
                select: { projectId: true },
            });
            if (!quote) {
                res.status(404).json({ error: 'Quote not found' });
                return;
            }
            projectId = quote.projectId;
        }
        if (!projectId) {
            res.status(400).json({ error: 'Cannot determine project' });
            return;
        }
        // ADMIN 有全局权限
        if (req.user.role === 'ADMIN') {
            next();
            return;
        }
        // 检查项目创建者
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { createdBy: true },
        });
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        if (project.createdBy === userId) {
            next();
            return;
        }
        // TODO: 检查 ProjectMember 表（如果存在）
        // 目前仅允许创建者和 ADMIN 访问
        res.status(403).json({ error: 'You do not have permission to export this project' });
    }
    catch (err) {
        next(err);
    }
}
/**
 * [PR-033] 简易 rate limit 中间件
 * 限制每个用户每分钟最多 10 次导出
 */
const exportRateLimit = (() => {
    const counts = new Map();
    const LIMIT = 10;
    const WINDOW_MS = 60 * 1000;
    return (req, res, next) => {
        const userId = req.user.id;
        const now = Date.now();
        let record = counts.get(userId);
        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + WINDOW_MS };
            counts.set(userId, record);
        }
        if (record.count >= LIMIT) {
            res.status(429).json({
                error: `导出频率超限，请 ${Math.ceil((record.resetAt - now) / 1000)} 秒后重试`,
            });
            return;
        }
        record.count++;
        next();
    };
})();
async function handleExport(type, req, res, next) {
    try {
        const payload = exportRequestSchema.parse(req.body ?? {});
        const file = await ExportService.export(type, payload);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
        res.send(file.buffer);
    }
    catch (error) {
        next(error);
    }
}
// [PR-033] 添加项目成员校验 + rate limit
router.post('/excel', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), exportRateLimit, checkProjectMembership, async (req, res, next) => {
    await handleExport('excel', req, res, next);
});
router.post('/pdf', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), exportRateLimit, checkProjectMembership, async (req, res, next) => {
    await handleExport('pdf', req, res, next);
});
export default router;
