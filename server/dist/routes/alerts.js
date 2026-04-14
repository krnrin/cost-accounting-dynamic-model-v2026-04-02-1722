import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AlertEventService } from '../services/alertEventService.js';
import { AuditService } from '../services/auditService.js';
const projectAlertsRouter = Router({ mergeParams: true });
const alertsRouter = Router();
const categoryEnum = z.enum(['metal_price', 'allocation_recovery', 'cost_anomaly', 'execution', 'deadline']);
const severityEnum = z.enum(['info', 'warning', 'critical']);
const statusEnum = z.enum(['active', 'acknowledged', 'resolved', 'dismissed']);
const listQuerySchema = z.object({
    category: categoryEnum.optional(),
    severity: severityEnum.optional(),
    status: statusEnum.optional(),
});
const updateSchema = z.object({
    status: statusEnum.optional(),
    assignedTo: z.string().optional().nullable(),
    detail: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});
projectAlertsRouter.use(authMiddleware);
alertsRouter.use(authMiddleware);
projectAlertsRouter.get('/', async (req, res, next) => {
    try {
        const query = listQuerySchema.parse({
            category: typeof req.query.category === 'string' ? req.query.category : undefined,
            severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
            status: typeof req.query.status === 'string' ? req.query.status : undefined,
        });
        const data = await AlertEventService.list({ ...query, projectId: req.params.id });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
alertsRouter.get('/', async (req, res, next) => {
    try {
        const query = listQuerySchema.parse({
            category: typeof req.query.category === 'string' ? req.query.category : undefined,
            severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
            status: typeof req.query.status === 'string' ? req.query.status : undefined,
        });
        const data = await AlertEventService.list(query);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
alertsRouter.get('/summary', async (req, res, next) => {
    try {
        const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
        const data = await AlertEventService.summary(projectId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
alertsRouter.post('/detect', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (_req, res, next) => {
    try {
        const data = await AlertEventService.detectAndSync();
        const projectIds = Array.from(new Set((data.items || []).map((item) => item?.projectId).filter(Boolean)));
        await Promise.all(projectIds.map((projectId) => AuditService.log({
            userId: _req.user.id,
            projectId,
            action: 'STATUS_CHANGE',
            entity: 'alert',
            entityId: `detect:${new Date().toISOString()}`,
            details: {
                count: data.count,
                categories: Array.from(new Set((data.items || []).map((item) => item?.category).filter(Boolean))),
            },
        })));
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
alertsRouter.get('/:eid', async (req, res, next) => {
    try {
        const data = await AlertEventService.getById(req.params.eid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
alertsRouter.put('/:eid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = updateSchema.parse(req.body);
        const data = await AlertEventService.update(req.params.eid, input);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: input.status ? 'STATUS_CHANGE' : 'UPDATE',
            entity: 'alert',
            entityId: data.id,
            details: {
                updatedFields: Object.keys(input),
                status: data.status,
                assignedTo: data.assignedTo,
            },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { alertsRouter };
export default projectAlertsRouter;
