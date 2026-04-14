import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ChangeService } from '../services/changeService.js';
import { AuditService } from '../services/auditService.js';
const scenarioChangeRouter = Router({ mergeParams: true });
const changeRouter = Router();
const changeSchema = z.object({
    projectId: z.string().optional(),
    changeType: z.enum(['add', 'replace', 'cancel', 'adjust']),
    reason: z.string().optional(),
    affectedHarnessIds: z.array(z.string()).default([]),
    affectedBomRows: z.array(z.any()).default([]),
    costImpact: z.number().optional(),
    quoteImpact: z.number().optional(),
    residualImpact: z.number().optional(),
    baselineVersionId: z.string().optional(),
    compareVersionId: z.string().optional(),
    status: z.string().optional(),
    createdBy: z.string().optional(),
});
scenarioChangeRouter.use(authMiddleware);
changeRouter.use(authMiddleware);
scenarioChangeRouter.get('/', async (req, res, next) => {
    try {
        const data = await ChangeService.listByScenario(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
scenarioChangeRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = changeSchema.parse(req.body);
        const projectId = input.projectId;
        if (!projectId)
            throw Object.assign(new Error('projectId is required'), { status: 400 });
        const data = { ...input, projectId: undefined };
        const created = await ChangeService.create(projectId, req.params.sid, data);
        await AuditService.log({
            userId: req.user.id,
            projectId,
            action: 'CREATE',
            entity: 'change',
            entityId: created.id,
            details: {
                scenarioId: req.params.sid,
                changeType: created.changeType,
                harnessCount: created.affectedHarnessIds.length,
            },
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
changeRouter.get('/:cid', async (req, res, next) => {
    try {
        const data = await ChangeService.getById(req.params.cid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
changeRouter.put('/:cid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = changeSchema.partial().parse(req.body);
        const data = await ChangeService.update(req.params.cid, input);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'UPDATE',
            entity: 'change',
            entityId: data.id,
            details: {
                updatedFields: Object.keys(input),
                status: data.status,
            },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
changeRouter.get('/:cid/impact', async (req, res, next) => {
    try {
        const data = await ChangeService.getById(req.params.cid);
        res.json({ data: { costImpact: data.costImpact, quoteImpact: data.quoteImpact, residualImpact: data.residualImpact, status: data.status } });
    }
    catch (error) {
        next(error);
    }
});
changeRouter.post('/:cid/calculate-impact', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await ChangeService.calculateImpact(req.params.cid);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'STATUS_CHANGE',
            entity: 'change',
            entityId: data.id,
            details: {
                status: data.status,
                costImpact: data.costImpact,
                quoteImpact: data.quoteImpact,
                residualImpact: data.residualImpact,
            },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { changeRouter };
export default scenarioChangeRouter;
