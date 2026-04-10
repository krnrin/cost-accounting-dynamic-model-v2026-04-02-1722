import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { TrackingService } from '../services/trackingService.js';

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

scenarioTrackingRouter.use(authMiddleware);
trackingRouter.use(authMiddleware);

scenarioTrackingRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await TrackingService.listByScenario(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioTrackingRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = trackingSchema.parse(req.body);
    const projectId = input.projectId;
    if (!projectId) throw Object.assign(new Error('projectId is required'), { status: 400 });
    const data = { ...input, projectId: undefined };
    const created = await TrackingService.create(projectId, req.params.sid as string, data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

trackingRouter.get('/:tid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await TrackingService.getById(req.params.tid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

trackingRouter.put('/:tid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = trackingSchema.partial().parse(req.body);
    const data = await TrackingService.update(req.params.tid as string, input);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

trackingRouter.post('/:tid/close', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { closeReason } = z.object({ closeReason: z.string().optional() }).parse(req.body || {});
    const data = await TrackingService.close(req.params.tid as string, closeReason);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { trackingRouter };
export default scenarioTrackingRouter;
