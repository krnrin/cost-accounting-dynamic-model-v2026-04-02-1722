import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { SettingsService } from '../services/settingsService.js';
const router = Router();
router.use(authMiddleware);
router.get('/', async (_req, res, next) => {
    try {
        const data = await SettingsService.getAll();
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/history', async (_req, res, next) => {
    try {
        const data = await SettingsService.history();
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/snapshot/:version', async (req, res, next) => {
    try {
        const data = await SettingsService.snapshot(req.params.version);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.post('/publish', requireRole(['ADMIN', 'MANAGER']), async (_req, res, next) => {
    try {
        const data = await SettingsService.publish();
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:category', async (req, res, next) => {
    try {
        const data = await SettingsService.getByCategory(req.params.category);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:category/:key', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    try {
        const body = z.object({ value: z.any() }).parse(req.body);
        const data = await SettingsService.upsert(req.params.category, req.params.key, body.value, req.user?.id);
        res.json({ data });
    }
    catch (error) {
        next(error);
    }
});
export default router;
