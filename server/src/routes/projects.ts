import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/projectService.js';
import { AuditService } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const projectStatusEnum = z.enum(['draft', 'quoted', 'awarded', 'production', 'eol']);

const projectSchema = z.object({
  projectCode: z.string().min(2),
  projectName: z.string().min(2),
  customer: z.string().min(2),
  platform: z.string().optional(),
  status: projectStatusEnum.optional(),
  costRates: z.any().default({}),
  metalPrices: z.any().default({}),
  volumes: z.any().optional(),
});

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: projectStatusEnum.optional(),
});

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    const projects = await ProjectService.getAllProjects(query);
    res.json({ data: projects });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = projectSchema.parse(req.body);
    const project = await ProjectService.createProject(validatedData, req.user!.id);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: project.id,
      action: 'CREATE',
      entity: 'project',
      entityId: project.id,
      details: validatedData,
    });

    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await ProjectService.getProjectDashboard(req.params.id as string);
    res.json({ data: dashboard });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await ProjectService.getProjectById(req.params.id as string);
    res.json({ data: project });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await AuditService.getByProject(req.params.id as string);
    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = projectSchema.partial().parse(req.body);
    const project = await ProjectService.updateProject(req.params.id as string, validatedData);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: req.params.id as string,
      action: 'UPDATE',
      entity: 'project',
      entityId: req.params.id as string,
      details: validatedData,
    });

    res.json({ data: project });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AuditService.log({
      userId: req.user!.id,
      projectId: req.params.id as string,
      action: 'DELETE',
      entity: 'project',
      entityId: req.params.id as string,
    });
    
    await ProjectService.deleteProject(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
