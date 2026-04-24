import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ScenarioService } from '../services/scenarioService.js';
import { ScenarioImportService } from '../services/scenarioImportService.js';
import { AuditService } from '../services/auditService.js';
const router = Router({ mergeParams: true });
const compareRouter = Router();
const scenarioSchema = z.object({
    type: z.enum(['initial_quote', 'fixed_point', 'change', 'annual_drop', 'final_quote']),
    name: z.string().min(2),
    status: z.string().optional(),
    lifecycleYears: z.number().int().positive().default(5),
    volume: z.number().int().nonnegative().default(0),
    installRatio: z.number().positive().default(1),
    config: z.any().optional(),
    vehicleConfigs: z.array(z.any()).optional(),
    configSkus: z.array(z.any()).optional(),
    harnessConfigMappings: z.array(z.any()).optional(),
    vehicleConfigMeta: z.any().optional(),
    rateSnapshot: z.any().default({}),
    rateSnapshotVersion: z.string().optional(),
    bomVersionRef: z.string().optional(),
    quoteParamSnapshot: z.any().default({}),
    sourceScenarioId: z.string().optional(),
    compareBaselineId: z.string().optional(),
    notes: z.string().optional(),
});
const importBaselineSchema = z.object({
    overwriteProjectMeta: z.boolean().optional(),
    project: z.object({
        meta: z.object({
            projectCode: z.string().min(1),
            projectName: z.string().min(1),
            customer: z.string().min(1),
            platform: z.string().optional().nullable(),
            lifecycleYears: z.number().int().positive(),
            status: z.string().optional(),
        }),
        config: z.any(),
    }),
    scenario: z.object({
        lifecycleYears: z.number().int().positive(),
        config: z.any(),
        note: z.string().default(''),
        vehicleConfigMeta: z.any(),
        configSkus: z.array(z.any()),
        harnessConfigMappings: z.array(z.any()),
        vehicleConfigs: z.array(z.any()),
    }),
    harnesses: z.array(z.object({
        harnessId: z.string().min(1),
        harnessName: z.string().min(1),
        input: z.any(),
        result: z.any().optional(),
        eopYear: z.number().int().nullable().optional(),
    })).min(1),
    allocationRows: z.array(z.object({
        harnessId: z.string().min(1),
        harnessName: z.string().min(1),
        vehicleRatio: z.number().nonnegative(),
        toolingCost: z.number().nonnegative(),
        testingCost: z.number().nonnegative(),
        rndCost: z.number().nonnegative(),
        allocBase: z.number().int().positive(),
        paymentMode: z.enum(['amortized', 'lumpsum', 'mixed']).default('amortized'),
        cumProduced: z.number().int().nonnegative().default(0),
    })),
    trackingItems: z.array(z.object({
        trackingType: z.enum(['agreed_price', 'progress_price', 'allocation_recovery', 'residual', 'exception']),
        title: z.string().min(1),
        sourceRef: z.string().optional(),
        currentStatus: z.enum(['pending', 'in_progress', 'to_confirm', 'completed', 'closed']).optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        owner: z.string().optional(),
        plannedAction: z.string().optional(),
        actualResult: z.string().optional(),
        closeReason: z.string().optional(),
        warningRef: z.string().optional(),
    })).default([]),
});
router.use(authMiddleware);
router.get('/', async (req, res, next) => {
    try {
        const projectId = req.params.id || req.params.pid;
        const data = await ScenarioService.listByProject(projectId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const projectId = req.params.id || req.params.pid;
        const input = scenarioSchema.parse(req.body);
        const data = await ScenarioService.create(projectId, input);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'CREATE',
            entity: 'scenario',
            entityId: data.id,
            details: input,
        });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:sid/import-baseline', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const projectId = req.params.id || req.params.pid;
        const input = importBaselineSchema.parse(req.body);
        const data = await ScenarioImportService.importBaseline(projectId, req.params.sid, input);
        await AuditService.log({
            userId: req.user.id,
            projectId: projectId,
            action: 'UPDATE',
            entity: 'scenario',
            entityId: req.params.sid,
            details: {
                baseline: 'custom',
                harnessCount: input.harnesses.length,
                allocationRowCount: input.allocationRows.length,
                trackingCount: input.trackingItems.length,
            },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:sid', async (req, res, next) => {
    try {
        const data = await ScenarioService.getById(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:sid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = scenarioSchema.partial().parse(req.body);
        const data = await ScenarioService.update(req.params.sid, input);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'UPDATE',
            entity: 'scenario',
            entityId: data.id,
            details: input,
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:sid/freeze', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await ScenarioService.freeze(req.params.sid, req.user?.id);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'STATUS_CHANGE',
            entity: 'scenario',
            entityId: data.id,
            details: { status: 'frozen' },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:sid/release', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await ScenarioService.release(req.params.sid, req.user?.id);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'STATUS_CHANGE',
            entity: 'scenario',
            entityId: data.id,
            details: { status: 'released' },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:sid/clone', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await ScenarioService.clone(req.params.sid);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'CREATE',
            entity: 'scenario',
            entityId: data.id,
            details: {
                sourceScenarioId: req.params.sid,
                clonedFrom: req.params.sid,
            },
        });
        res.status(201).json({ data });
    }
    catch (error) {
        next(error);
    }
});
compareRouter.delete('/:sid', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
    try {
        const data = await ScenarioService.delete(req.params.sid);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'DELETE',
            entity: 'scenario',
            entityId: data.id,
            details: {
                status: data.status,
                sourceScenarioId: data.sourceScenarioId,
            },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:sid/summary', async (req, res, next) => {
    try {
        const data = await ScenarioService.getSummary(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
compareRouter.use(authMiddleware);
compareRouter.get('/compare', async (req, res, next) => {
    try {
        const ids = String(req.query.ids || '').split(',').filter(Boolean);
        const data = await ScenarioService.compare(ids);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
compareRouter.get('/:sid', async (req, res, next) => {
    try {
        const data = await ScenarioService.getById(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
compareRouter.put('/:sid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = scenarioSchema.partial().parse(req.body);
        const data = await ScenarioService.update(req.params.sid, input);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'UPDATE',
            entity: 'scenario',
            entityId: data.id,
            details: input,
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
// Delete scenario with cascade (from phase12 delta)
compareRouter.delete('/:sid', requireRole(['ADMIN', 'MANAGER']), async (req, res, next) => {
    try {
        const data = await ScenarioService.delete(req.params.sid);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'DELETE',
            entity: 'scenario',
            entityId: data.id,
            details: {
                status: data.status,
                sourceScenarioId: data.sourceScenarioId,
            },
        });
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { compareRouter };
export default router;
