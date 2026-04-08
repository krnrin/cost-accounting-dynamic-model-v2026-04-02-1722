import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { VersionService } from '../services/extraServices.js';
import { AuditService } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const versionSchema = z.object({
  projectId: z.string(),
  versionNumber: z.number().int(),
  label: z.string(),
  status: z.string().optional(),
  snapshot: z.any(),
  notes: z.string().optional(),
});

router.use(authMiddleware);

router.get('/project/:pid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await VersionService.getVersionsByProject(req.params.pid as string);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = versionSchema.parse(req.body);
    const { projectId, ...data } = validatedData;
    const version = await VersionService.createVersion(projectId, {
      ...data,
      createdBy: req.user!.id,
    });
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: projectId,
      action: 'CREATE',
      entity: 'version',
      entityId: version.id,
      details: data,
    });

    res.status(201).json({ data: version });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const version = await VersionService.updateStatus(req.params.id as string, status);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: version.projectId,
      action: 'STATUS_CHANGE',
      entity: 'version',
      entityId: version.id,
      details: { status },
    });

    res.json({ data: version });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await VersionService.deleteVersion(req.params.id as string);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: version.projectId,
      action: 'DELETE',
      entity: 'version',
      entityId: req.params.id as string,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
