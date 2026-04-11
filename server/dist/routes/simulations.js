import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { SimulationService } from '../services/simulationService.js';
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
scenarioSimulationRouter.get('/', async (req, res, next) => {
    try {
        const data = await SimulationService.listByScenario(req.params.sid);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
scenarioSimulationRouter.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = simulationSchema.parse(req.body);
        const projectId = input.projectId;
        if (!projectId)
            throw Object.assign(new Error('projectId is required'), { status: 400 });
        const created = await SimulationService.create(projectId, req.params.sid, {
            ...input,
            projectId: undefined,
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        next(error);
    }
});
simulationRouter.get('/:simId', async (req, res, next) => {
    try {
        const data = await SimulationService.getById(req.params.simId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
simulationRouter.put('/:simId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const input = simulationSchema.partial().parse(req.body);
        const data = await SimulationService.update(req.params.simId, input);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
simulationRouter.post('/:simId/run', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await SimulationService.run(req.params.simId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
simulationRouter.post('/:simId/convert-to-scenario', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const data = await SimulationService.convertToScenario(req.params.simId);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export { simulationRouter };
export default scenarioSimulationRouter;
