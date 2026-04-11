import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AlertEventService } from '../services/alertEventService.js';

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

projectAlertsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse({
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    const data = await AlertEventService.list({ ...query, projectId: req.params.id as string });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

alertsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse({
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    const data = await AlertEventService.list(query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

alertsRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const data = await AlertEventService.summary(projectId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

alertsRouter.get('/:eid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AlertEventService.getById(req.params.eid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

alertsRouter.put('/:eid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateSchema.parse(req.body);
    const data = await AlertEventService.update(req.params.eid as string, input);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { alertsRouter };
export default projectAlertsRouter;
