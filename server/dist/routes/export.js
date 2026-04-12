import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ExportService } from '../services/exportService.js';
const router = Router();
const exportRequestSchema = z.object({
    projectId: z.string().optional(),
    quoteId: z.string().optional(),
}).refine((value) => Boolean(value.projectId || value.quoteId), {
    message: 'projectId or quoteId is required',
});
router.use(authMiddleware);
async function handleExport(type, req, res, next) {
    try {
        const payload = exportRequestSchema.parse(req.body ?? {});
        const file = await ExportService.export(type, payload);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
        res.send(file.buffer);
    }
    catch (error) {
        next(error);
    }
}
router.post('/excel', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    await handleExport('excel', req, res, next);
});
router.post('/pdf', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req, res, next) => {
    await handleExport('pdf', req, res, next);
});
export default router;
