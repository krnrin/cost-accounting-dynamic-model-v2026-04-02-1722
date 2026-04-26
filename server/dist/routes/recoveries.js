import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { RecoveryService } from '../services/recoveryService.js';
import { AuditService } from '../services/auditService.js'; // [PR-040]
const router = Router({ mergeParams: true });
const recoverySchema = z.object({
    period: z.string(),
    cumulativeVolume: z.number().int().nonnegative(),
    installRatioSnapshot: z.number().positive().default(1),
    recoveredAmount: z.number().nonnegative(),
    status: z.string().optional(),
    remark: z.string().optional(),
});
router.use(authMiddleware);
router.get('/:aid/recovery-history', async (req, res, next) => {
    try {
        const data = await RecoveryService.listByAllocation(req.params.aid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:aid/recovery-records', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = recoverySchema.parse(req.body);
        const data = await RecoveryService.create(req.params.aid, input);
        // [PR-040] 添加审计日志
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'CREATE',
            entity: 'recovery',
            entityId: data.id,
            details: { allocationId: req.params.aid, period: input.period },
        });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:aid/recovery-forecast', async (req, res, next) => {
    try {
        const data = await RecoveryService.forecast(req.params.aid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:aid/complete', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await RecoveryService.complete(req.params.aid);
        // [PR-040] 添加审计日志
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'UPDATE',
            entity: 'recovery',
            entityId: req.params.aid,
            details: { action: 'complete', status: data.status },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export default router;
