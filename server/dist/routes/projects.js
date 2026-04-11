import { Router } from 'express';
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
const importProjectSchema = z.object({
    schemaVersion: z.number().optional(),
    project: z.object({
        meta: z.object({
            projectCode: z.string().min(1),
            projectName: z.string().min(1),
            customer: z.string().min(1),
            platform: z.string().optional(),
            status: z.string().optional(),
        }),
        config: z.object({
            costRates: z.any().optional(),
            metalPrices: z.any().optional(),
            volumes: z.any().optional(),
        }).optional(),
    }),
    harnesses: z.array(z.any()).optional(),
    quotes: z.array(z.any()).optional(),
});
router.use(authMiddleware);
router.get('/', async (req, res, next) => {
    try {
        const query = listQuerySchema.parse({
            search: typeof req.query.search === 'string' ? req.query.search : undefined,
            status: typeof req.query.status === 'string' ? req.query.status : undefined,
        });
        const projects = await ProjectService.getAllProjects(query);
        res.json({ data: projects });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const validatedData = projectSchema.parse(req.body);
        const project = await ProjectService.createProject(validatedData, req.user.id);
        await AuditService.log({
            userId: req.user.id,
            projectId: project.id,
            action: 'CREATE',
            entity: 'project',
            entityId: project.id,
            details: validatedData,
        });
        res.status(201).json({ data: project });
    }
    catch (error) {
        next(error);
    }
});
router.post('/import', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const validatedData = importProjectSchema.parse(req.body);
        const project = await ProjectService.importProjectPackage(validatedData, req.user.id);
        await AuditService.log({
            userId: req.user.id,
            projectId: project.id,
            action: 'CREATE',
            entity: 'project',
            entityId: project.id,
            details: {
                importedFrom: validatedData.project.meta.projectCode,
                harnessCount: validatedData.harnesses?.length ?? 0,
                quoteCount: validatedData.quotes?.length ?? 0,
            },
        });
        res.status(201).json({ data: project });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/dashboard', async (req, res, next) => {
    try {
        const dashboard = await ProjectService.getProjectDashboard(req.params.id);
        res.json({ data: dashboard });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const project = await ProjectService.getProjectById(req.params.id);
        res.json({ data: project });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/audit-logs', async (req, res, next) => {
    try {
        const logs = await AuditService.getByProject(req.params.id);
        res.json({ data: logs });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const validatedData = projectSchema.partial().parse(req.body);
        const project = await ProjectService.updateProject(req.params.id, validatedData);
        await AuditService.log({
            userId: req.user.id,
            projectId: req.params.id,
            action: 'UPDATE',
            entity: 'project',
            entityId: req.params.id,
            details: validatedData,
        });
        res.json({ data: project });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', requireRole(['ADMIN']), async (req, res, next) => {
    try {
        await AuditService.log({
            userId: req.user.id,
            projectId: req.params.id,
            action: 'DELETE',
            entity: 'project',
            entityId: req.params.id,
        });
        await ProjectService.deleteProject(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
export default router;
