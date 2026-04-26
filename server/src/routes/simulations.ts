import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { SimulationService } from '../services/simulationService.js';
import { AuditService } from '../services/auditService.js'; // [PR-040]

const scenarioSimulationRouter = Router({ mergeParams: true });
const simulationRouter = Router();

const simulationSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
  status: z.string().optional(),
  parameterSnapshot: z.object({
    copperAdj: z.number().optional(),
    aluminumAdj: z.number().optional(),
    volumeAdj: z.number().optional(),
    dropRate: z.number().optional(),
    hoursAdj: z.number().optional(),
  }).default({}),
  resultSnapshot: z.any().optional(),
  baselineScenarioId: z.string().optional(),
  convertedScenarioId: z.string().optional(),
  createdBy: z.string().optional(),
});

scenarioSimulationRouter.use(authMiddleware);
simulationRouter.use(authMiddleware);

scenarioSimulationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SimulationService.listByScenario(req.params.sid as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioSimulationRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = simulationSchema.parse(req.body);
    const projectId = input.projectId;
    if (!projectId) throw Object.assign(new Error('projectId is required'), { status: 400 });
    const created = await SimulationService.create(projectId, req.params.sid as string, {
      ...input,
      projectId: undefined,
    });
    // [PR-040] 添加审计日志
    await AuditService.log({
      userId: req.user!.id,
      projectId,
      action: 'CREATE',
      entity: 'simulation',
      entityId: created.id,
      details: { scenarioId: req.params.sid, name: input.name },
    });
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

simulationRouter.get('/:simId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SimulationService.getById(req.params.simId as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

simulationRouter.put('/:simId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = simulationSchema.partial().parse(req.body);
    const data = await SimulationService.update(req.params.simId as string, input);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

simulationRouter.post('/:simId/run', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SimulationService.run(req.params.simId as string);
    // [PR-040] 添加审计日志
    await AuditService.log({
      userId: req.user!.id,
      projectId: data.projectId,
      action: 'UPDATE',
      entity: 'simulation',
      entityId: req.params.simId as string,
      details: { action: 'run', status: data.status },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

simulationRouter.post('/:simId/convert-to-scenario', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SimulationService.convertToScenario(req.params.simId as string);
    // [PR-040] 添加审计日志
    await AuditService.log({
      userId: req.user!.id,
      projectId: data.scenario.projectId,
      action: 'CREATE',
      entity: 'scenario',
      entityId: data.scenario.id,
      details: { action: 'convert_from_simulation', simulationId: req.params.simId },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { simulationRouter };
export default scenarioSimulationRouter;
