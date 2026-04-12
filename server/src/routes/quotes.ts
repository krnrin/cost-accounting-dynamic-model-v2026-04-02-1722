import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QuoteService } from '../services/extraServices.js';
import { AuditService } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const quoteSchema = z.object({
  projectId: z.string().optional(),
  scenarioId: z.string().optional(),
  harnessId: z.string().optional(),
  version: z.string(),
  status: z.string().optional(),
  template: z.string().optional(),
  data: z.any().default({}),
  quoteParams: z.any().optional(),
  quoteResult: z.any().optional(),
  internalCostBaseline: z.number().optional(),
  exWorksPrice: z.number().optional(),
  arrivalPrice: z.number().optional(),
  effectivePrice: z.number().optional(),
  effectivePriceMode: z.enum(['ex_works', 'arrival', 'custom']).optional(),
  customerBurdenMode: z.enum(['supplier_full', 'customer_full', 'shared', 'per_item']).optional(),
  recoveryCompletionBehavior: z.enum(['auto_switch_price', 'notify_only', 'manual_confirm']).optional(),
  customerAccepted: z.boolean().optional(),
  lockedFields: z.any().optional(),
  editableFields: z.any().optional(),
  approvalFields: z.any().optional(),
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

router.get('/scenario/:sid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotes = await QuoteService.getQuotesByScenario(req.params.sid as string);
    res.json({ data: quotes });
  } catch (error) {
    next(error);
  }
});

router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean);
    const data = await QuoteService.compareQuotes(ids);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await QuoteService.getQuoteById(req.params.id as string);
    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await QuoteService.compareQuote(req.params.id as string);
    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/effective-price', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await QuoteService.getEffectivePrice(req.params.id as string);
    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
});

router.post('/scenario/:sid', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = quoteSchema.parse({ ...req.body, scenarioId: req.params.sid as string });
    const projectId = validatedData.projectId;
    if (!projectId) throw Object.assign(new Error('projectId is required'), { status: 400 });
    const data = { ...validatedData, projectId: undefined };
    const quote = await QuoteService.createQuote(projectId, data);
    await AuditService.log({
      userId: req.user!.id,
      projectId,
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

router.post('/', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = quoteSchema.parse(req.body);
    const { projectId, ...data } = validatedData;
    if (!projectId) throw Object.assign(new Error('projectId is required'), { status: 400 });
    const quote = await QuoteService.createQuote(projectId, data);

    await AuditService.log({
      userId: req.user!.id,
      projectId,
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

router.post('/:id/confirm', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await QuoteService.confirmQuote(req.params.id as string, req.user?.id);
    await AuditService.log({
      userId: req.user!.id,
      projectId: quote.projectId,
      action: 'STATUS_CHANGE',
      entity: 'quote',
      entityId: quote.id,
      details: { customerAccepted: true, status: quote.status },
    });
    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/publish', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await QuoteService.publishQuote(req.params.id as string, req.user?.id);
    await AuditService.log({
      userId: req.user!.id,
      projectId: quote.projectId,
      action: 'STATUS_CHANGE',
      entity: 'quote',
      entityId: quote.id,
      details: { customerAccepted: true, status: quote.status, scenarioId: quote.scenarioId },
    });
    res.json({ data: quote });
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
