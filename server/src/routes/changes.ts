import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ChangeService } from '../services/changeService.js';

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

scenarioChangeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChangeService.listByScenario(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioChangeRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = changeSchema.parse(req.body);
    const projectId = input.projectId;
    if (!projectId) throw Object.assign(new Error('projectId is required'), { status: 400 });
    const { projectId: pid, ...data } = input;
    const created = await ChangeService.create(pid, req.params.sid as string, data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

changeRouter.get('/:cid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChangeService.getById(req.params.cid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

changeRouter.put('/:cid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = changeSchema.partial().parse(req.body);
    const data = await ChangeService.update(req.params.cid as string, input);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

changeRouter.get('/:cid/impact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChangeService.getById(req.params.cid as string);
    res.json({ data: { costImpact: data.costImpact, quoteImpact: data.quoteImpact, residualImpact: data.residualImpact, status: data.status } });
  } catch (error) {
    next(error);
  }
});

changeRouter.post('/:cid/calculate-impact', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ChangeService.calculateImpact(req.params.cid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { changeRouter };
export default scenarioChangeRouter;
