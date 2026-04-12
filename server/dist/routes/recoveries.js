import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { RecoveryService } from '../services/recoveryService.js';
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
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export default router;
