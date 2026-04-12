import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { SettingsService } from '../services/settingsService.js';
import { AuditService } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SettingsService.getAll();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SettingsService.history();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/snapshot/:version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SettingsService.snapshot(req.params.version as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/publish', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SettingsService.publish(req.user?.id);
    await AuditService.log({
      userId: req.user!.id,
      action: 'STATUS_CHANGE',
      entity: 'setting',
      entityId: data.version,
      details: {
        status: data.status,
        version: data.version,
        publishedAt: data.publishedAt,
      },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await SettingsService.getByCategory(req.params.category as string);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.put('/:category/:key', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ value: z.any() }).parse(req.body);
    const data = await SettingsService.upsert(req.params.category as string, req.params.key as string, body.value, req.user?.id);
    await AuditService.log({
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'setting',
      entityId: `${req.params.category}:${req.params.key}`,
      details: {
        category: req.params.category,
        key: req.params.key,
      },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
