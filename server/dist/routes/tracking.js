import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { TrackingService } from '../services/trackingService.js';
import { AuditService } from '../services/auditService.js';
import { PricingService } from '../services/pricingService.js';
const scenarioTrackingRouter = Router({ mergeParams: true });
const trackingRouter = Router();
const trackingSchema = z.object({
    projectId: z.string().optional(),
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
});
function getLinkedDiscrepancyId(sourceRef) {
    const match = /^pricing:discrepancy:(.+)$/.exec(sourceRef || '');
    return match?.[1] ?? null;
}
function mapTrackingStatusToDiscrepancy(status) {
    switch (status) {
        case 'in_progress':
        case 'to_confirm':
            return 'escalated';
        case 'completed':
            return 'resolved';
        case 'closed':
            return 'accepted';
        default:
            return 'open';
    }
}
async function syncLinkedDiscrepancyFromTracking(trackingItem) {
    const discrepancyId = getLinkedDiscrepancyId(trackingItem.sourceRef);
    if (!discrepancyId) {
        return null;
    }
    return PricingService.updateDiscrepancy(trackingItem.projectId, trackingItem.scenarioId, discrepancyId, {
        status: mapTrackingStatusToDiscrepancy(trackingItem.currentStatus),
        assignedTo: trackingItem.owner ?? undefined,
        resolutionNote: trackingItem.closeReason || trackingItem.actualResult || undefined,
    });
}
scenarioTrackingRouter.use(authMiddleware);
trackingRouter.use(authMiddleware);
scenarioTrackingRouter.get('/', async (req, res, next) => {
    try {
        const data = await TrackingService.listByScenario(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
scenarioTrackingRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = trackingSchema.parse(req.body);
        const projectId = input.projectId;
        if (!projectId)
            throw Object.assign(new Error('projectId is required'), { status: 400 });
        const data = { ...input, projectId: undefined };
        const created = await TrackingService.create(projectId, req.params.sid, data);
        await AuditService.log({
            userId: req.user.id,
            projectId: created.projectId,
            action: 'CREATE',
            entity: 'tracking',
            entityId: created.id,
            details: data,
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
trackingRouter.get('/:tid', async (req, res, next) => {
    try {
        const data = await TrackingService.getById(req.params.tid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
trackingRouter.put('/:tid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = trackingSchema.partial().parse(req.body);
        const data = await TrackingService.update(req.params.tid, input);
        const syncedDiscrepancy = await syncLinkedDiscrepancyFromTracking(data);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'UPDATE',
            entity: 'tracking',
            entityId: data.id,
            details: input,
        });
        if (syncedDiscrepancy) {
            await AuditService.log({
                userId: req.user.id,
                projectId: data.projectId,
                action: 'UPDATE',
                entity: 'pricing',
                entityId: syncedDiscrepancy.id,
                details: {
                    source: 'tracking',
                    discrepancyId: syncedDiscrepancy.id,
                    status: syncedDiscrepancy.status,
                    assignedTo: syncedDiscrepancy.assignedTo,
                },
            });
        }
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
trackingRouter.post('/:tid/close', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const { closeReason } = z.object({ closeReason: z.string().optional() }).parse(req.body || {});
        const data = await TrackingService.close(req.params.tid, closeReason);
        const syncedDiscrepancy = await syncLinkedDiscrepancyFromTracking(data);
        await AuditService.log({
            userId: req.user.id,
            projectId: data.projectId,
            action: 'STATUS_CHANGE',
            entity: 'tracking',
            entityId: data.id,
            details: { currentStatus: 'closed', closeReason },
        });
        if (syncedDiscrepancy) {
            await AuditService.log({
                userId: req.user.id,
                projectId: data.projectId,
                action: 'UPDATE',
                entity: 'pricing',
                entityId: syncedDiscrepancy.id,
                details: {
                    source: 'tracking',
                    discrepancyId: syncedDiscrepancy.id,
                    status: syncedDiscrepancy.status,
                    resolutionNote: syncedDiscrepancy.resolutionNote,
                },
            });
        }
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { trackingRouter };
export default scenarioTrackingRouter;
