import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AlertRuleService } from '../services/alertRuleService.js';
const router = Router();
router.use(authMiddleware);
const categoryEnum = z.enum(['metal_price', 'allocation_recovery', 'cost_anomaly', 'execution', 'deadline']);
const severityEnum = z.enum(['info', 'warning', 'critical']);
const conditionSchema = z.object({
    metric: z.string().min(1),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains']).default('gte'),
    threshold: z.union([z.string(), z.number(), z.boolean()]),
    unit: z.string().optional(),
    window: z.string().optional(),
    targetField: z.string().optional(),
});
const createSchema = z.object({
    name: z.string().min(1),
    category: categoryEnum,
    severity: severityEnum,
    enabled: z.boolean().optional(),
    description: z.string().optional(),
    condition: conditionSchema,
});
const updateSchema = createSchema.partial();
router.get('/', async (_req, res, next) => {
    try {
        const data = await AlertRuleService.list();
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = createSchema.parse(req.body);
        const data = await AlertRuleService.create({ ...input, createdBy: req.user?.id });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:rid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = updateSchema.parse(req.body);
        const data = await AlertRuleService.update(req.params.rid, input);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:rid', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
    try {
        await AlertRuleService.remove(req.params.rid);
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});
export default router;
