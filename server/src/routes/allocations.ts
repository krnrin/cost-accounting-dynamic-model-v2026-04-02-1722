import { Router, Request, Response, NextFunction } from 'express';
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

scenarioAllocRouter.use(authMiddleware);
allocationRouter.use(authMiddleware);

scenarioAllocRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AllocationService.listByScenario(
      req.params.sid as string,
      typeof req.query.burden_side === 'string' ? req.query.burden_side : undefined,
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioAllocRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = allocationSchema.parse(req.body);
    const projectId = input.projectId;
    if (!projectId) throw Object.assign(new Error('projectId is required'), { status: 400 });
    const { projectId: pid, ...data } = input;
    const created = await AllocationService.create(pid, req.params.sid as string, data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

allocationRouter.get('/:aid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await AllocationService.getById(req.params.aid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

allocationRouter.put('/:aid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = allocationSchema.partial().parse(req.body);
    const data = await AllocationService.update(req.params.aid as string, input);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { allocationRouter };
export default scenarioAllocRouter;
