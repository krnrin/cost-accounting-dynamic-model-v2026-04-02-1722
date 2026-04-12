import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { ProfileService } from '../services/profileService.js';

const router = Router();
router.use(authMiddleware);

const profileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
}).refine((value) => value.name !== undefined || value.email !== undefined, {
  message: 'At least one profile field is required',
});

const preferencesSchema = z.object({
  themeMode: z.enum(['light', 'dark', 'system']),
  notifications: z.object({
    alerts: z.boolean(),
    system: z.boolean(),
    releases: z.boolean(),
  }),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ProfileService.getProfile(req.user!.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const data = await ProfileService.updateProfile(req.user!.id, validatedData);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ProfileService.getPermissions(req.user!.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = preferencesSchema.parse(req.body);
    const data = await ProfileService.updatePreferences(req.user!.id, validatedData);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
