import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HarnessService } from '../services/harnessService.js';
import { AuditService } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router({ mergeParams: true });

const harnessSchema = z.object({
  harnessId: z.string().min(3),
  harnessName: z.string().min(3),
  input: z.any(),
  result: z.any().optional(),
});

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = req.params.pid as string;
    const harnesses = await HarnessService.getHarnessesByProject(pid);
    res.json({ data: harnesses });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = req.params.pid as string;
    const validatedData = harnessSchema.parse(req.body);
    const harness = await HarnessService.createHarness(pid, validatedData);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: pid,
      action: 'CREATE',
      entity: 'harness',
      entityId: harness.id,
      details: validatedData,
    });

    res.status(201).json({ data: harness });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = req.params.pid as string;
    const validatedData = harnessSchema.partial().parse(req.body);
    const harness = await HarnessService.updateHarness(req.params.id as string, validatedData);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: pid,
      action: 'UPDATE',
      entity: 'harness',
      entityId: req.params.id as string,
      details: validatedData,
    });

    res.json({ data: harness });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = req.params.pid as string;
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: pid,
      action: 'DELETE',
      entity: 'harness',
      entityId: req.params.id as string,
    });

    await HarnessService.deleteHarness(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
