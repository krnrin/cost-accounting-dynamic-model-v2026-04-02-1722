import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { BomService } from '../services/bomService.js';

const scenarioBomRouter = Router({ mergeParams: true });
const bomRowRouter = Router();

const bomRowSchema = z.object({
  partNo: z.string().min(1),
  partName: z.string().min(1),
  itemCategory: z.string(),
  qty: z.number(),
  unit: z.string().default('个'),
  unitPrice: z.number().default(0),
  amount: z.number().default(0),
  sapNo: z.string().optional(),
  spec: z.string().optional(),
  supplier: z.string().optional(),
  functionText: z.string().optional(),
  metalType: z.string().optional(),
  metalWeight: z.number().optional(),
});

scenarioBomRouter.use(authMiddleware);
bomRowRouter.use(authMiddleware);

scenarioBomRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await BomService.listScenarioBomRows(req.params.sid as string, {
      harness: typeof req.query.harness === 'string' ? req.query.harness : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioBomRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const harnessId = String(req.body.harnessId || '');
    const bomRow = bomRowSchema.parse(req.body.bomRow || req.body);
    const data = await BomService.createBomRow(req.params.sid as string, harnessId, bomRow);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioBomRouter.post('/import', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const harnessId = String(req.body.harnessId || '');
    const rows = z.array(bomRowSchema).parse(req.body.rows || []);
    const data = await BomService.importBomRows(req.params.sid as string, harnessId, rows);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioBomRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await BomService.summarizeScenarioBom(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioBomRouter.get('/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseScenarioId = String(req.query.base || '');
    const data = await BomService.diffScenarioBom(req.params.sid as string, baseScenarioId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioBomRouter.get('/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseScenarioId = String(req.query.base || '');
    const data = await BomService.diffScenarioBom(req.params.sid as string, baseScenarioId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

bomRowRouter.put('/:rowId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.body.projectId || req.query.projectId || '');
    const patch = bomRowSchema.partial().parse(req.body.patch || req.body);
    const data = await BomService.updateBomRow(projectId, req.params.rowId as string, patch);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

bomRowRouter.delete('/:rowId', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.body.projectId || req.query.projectId || '');
    await BomService.deleteBomRow(projectId, req.params.rowId as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { bomRowRouter };
export default scenarioBomRouter;
