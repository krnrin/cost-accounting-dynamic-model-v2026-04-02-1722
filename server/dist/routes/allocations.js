import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AllocationService } from '../services/allocationService.js';
const scenarioAllocRouter = Router({ mergeParams: true });
const allocationRouter = Router();
const allocationSchema = z.object({
    projectId: z.string().optional(),
    harnessId: z.string(),
    expenseType: z.enum(['tooling', 'mold', 'testing', 'rnd', 'other']),
    expenseName: z.string().min(1),
    totalAmount: z.number().nonnegative(),
    allocationBasis: z.string().optional(),
    baselineVolume: z.number().int().positive(),
    plannedRecovery: z.number().nonnegative().optional(),
    actualRecovered: z.number().nonnegative().optional(),
    burdenSide: z.enum(['supplier', 'customer', 'shared']),
    pricingEffect: z.enum(['included_in_price', 'separate_invoice', 'internal_only']),
    recoveryCompletionBehavior: z.enum(['trigger_price_adjust', 'notify_only', 'archive']),
    priceAdjustReminder: z.boolean().optional(),
    targetRecoveryDate: z.string().optional(),
    completedAt: z.string().optional(),
    status: z.string().optional(),
    sourceVersionId: z.string().optional(),
});
const allocationSyncRowSchema = z.object({
    harnessId: z.string().min(1),
    harnessName: z.string().min(1),
    vehicleRatio: z.number().nonnegative(),
    toolingCost: z.number().nonnegative(),
    testingCost: z.number().nonnegative(),
    rndCost: z.number().nonnegative(),
    allocBase: z.number().int().positive(),
    paymentMode: z.enum(['amortized', 'lumpsum', 'mixed']).default('amortized'),
    cumProduced: z.number().int().nonnegative().default(0),
});
const bulkSyncSchema = z.object({
    projectId: z.string().min(1),
    rows: z.array(allocationSyncRowSchema),
});
scenarioAllocRouter.use(authMiddleware);
allocationRouter.use(authMiddleware);
scenarioAllocRouter.get('/', async (req, res, next) => {
    try {
        const data = await AllocationService.listByScenario(req.params.sid, typeof req.query.burden_side === 'string' ? req.query.burden_side : undefined);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
scenarioAllocRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = allocationSchema.parse(req.body);
        const projectId = input.projectId;
        if (!projectId)
            throw Object.assign(new Error('projectId is required'), { status: 400 });
        const data = { ...input, projectId: undefined };
        const created = await AllocationService.create(projectId, req.params.sid, data);
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
scenarioAllocRouter.post('/bulk-sync', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = bulkSyncSchema.parse(req.body);
        const data = await AllocationService.bulkSyncHarnessRows(input.projectId, req.params.sid, input.rows);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
allocationRouter.get('/:aid', async (req, res, next) => {
    try {
        const data = await AllocationService.getById(req.params.aid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
allocationRouter.put('/:aid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = allocationSchema.partial().parse(req.body);
        const data = await AllocationService.update(req.params.aid, input);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { allocationRouter };
export default scenarioAllocRouter;
