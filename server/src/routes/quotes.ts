import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QuoteService } from '../services/extraServices.js';
import { AuditService } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const quoteSchema = z.object({
  projectId: z.string(),
  version: z.string(),
  status: z.string().optional(),
  template: z.string().optional(),
  data: z.any(),
});

router.use(authMiddleware);

router.get('/project/:pid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotes = await QuoteService.getQuotesByProject(req.params.pid as string);
    res.json({ data: quotes });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = quoteSchema.parse(req.body);
    const { projectId, ...data } = validatedData;
    const quote = await QuoteService.createQuote(projectId, data);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: projectId,
      action: 'CREATE',
      entity: 'quote',
      entityId: quote.id,
      details: data,
    });

    res.status(201).json({ data: quote });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = quoteSchema.partial().parse(req.body);
    const quote = await QuoteService.updateQuote(req.params.id as string, validatedData);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: quote.projectId,
      action: 'UPDATE',
      entity: 'quote',
      entityId: quote.id,
      details: validatedData,
    });

    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await QuoteService.deleteQuote(req.params.id as string);
    
    await AuditService.log({
      userId: req.user!.id,
      projectId: quote.projectId,
      action: 'DELETE',
      entity: 'quote',
      entityId: req.params.id as string,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
