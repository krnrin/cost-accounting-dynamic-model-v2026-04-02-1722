import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AnnualDropService } from '../services/annualDropService.js';
import { AuditService } from '../services/auditService.js'; // [PR-040]
const scenarioAnnualDropRouter = Router({ mergeParams: true });
const annualDropRouter = Router();
const annualDropSchema = z.object({
    projectId: z.string().optional(),
    name: z.string().min(1),
    status: z.string().optional(),
    year: z.number().int().positive(),
    dropRate: z.number().min(0).max(1),
    costBefore: z.number().nonnegative(),
    priceBefore: z.number().nonnegative(),
    createdBy: z.string().optional(),
});
scenarioAnnualDropRouter.use(authMiddleware);
annualDropRouter.use(authMiddleware);
scenarioAnnualDropRouter.get('/', async (req, res, next) => {
    try {
        const data = await AnnualDropService.listByScenario(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
scenarioAnnualDropRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = annualDropSchema.parse(req.body);
        const projectId = input.projectId;
        if (!projectId)
            throw Object.assign(new Error('projectId is required'), { status: 400 });
        const created = await AnnualDropService.create(projectId, req.params.sid, {
            ...input,
            projectId: undefined,
        });
        // [PR-040] 添加审计日志
        await AuditService.log({
            userId: req.user.id,
            projectId,
            action: 'CREATE',
            entity: 'annualDrop',
            entityId: created.id,
            details: { scenarioId: req.params.sid, year: input.year, dropRate: input.dropRate },
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
annualDropRouter.get('/:adId', async (req, res, next) => {
    try {
        const data = await AnnualDropService.getById(req.params.adId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
annualDropRouter.put('/:adId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = annualDropSchema.partial().parse(req.body);
        const data = await AnnualDropService.update(req.params.adId, input);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
annualDropRouter.get('/:adId/impact', async (req, res, next) => {
    try {
        const data = await AnnualDropService.getImpact(req.params.adId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { annualDropRouter };
export default scenarioAnnualDropRouter;
