import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ScenarioService } from '../services/scenarioService.js';

const router = Router({ mergeParams: true });
const compareRouter = Router();

const scenarioSchema = z.object({
  type: z.enum(['initial_quote', 'fixed_point', 'change', 'annual_drop']),
  name: z.string().min(2),
  status: z.string().optional(),
  lifecycleYears: z.number().int().positive().default(5),
  volume: z.number().int().nonnegative().default(0),
  installRatio: z.number().positive().default(1),
  rateSnapshot: z.any().default({}),
  bomVersionRef: z.string().optional(),
  quoteParamSnapshot: z.any().default({}),
  sourceScenarioId: z.string().optional(),
  compareBaselineId: z.string().optional(),
  notes: z.string().optional(),
});

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id || req.params.pid;
    const data = await ScenarioService.listByProject(projectId as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id || req.params.pid;
    const input = scenarioSchema.parse(req.body);
    const data = await ScenarioService.create(projectId as string, input);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:sid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ScenarioService.getById(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.put('/:sid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = scenarioSchema.partial().parse(req.body);
    const data = await ScenarioService.update(req.params.sid as string, input);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/:sid/freeze', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ScenarioService.freeze(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/:sid/release', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ScenarioService.release(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/:sid/clone', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ScenarioService.clone(req.params.sid as string);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:sid/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ScenarioService.getSummary(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

compareRouter.use(authMiddleware);
compareRouter.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean);
    const data = await ScenarioService.compare(ids);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { compareRouter };
export default router;
