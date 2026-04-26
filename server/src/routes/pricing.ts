import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { PricingService } from '../services/pricingService.js';
import { AuditService } from '../services/auditService.js';
import { TrackingService } from '../services/trackingService.js';

const projectPricingRouter = Router({ mergeParams: true });
const scenarioPricingRouter = Router({ mergeParams: true });

const connectorSchema = z.object({
  partNo: z.string().min(1),
  partName: z.string().min(1),
  supplier: z.string().default(''),
  customerAgreedPrice: z.number().nonnegative().default(0),
  supplierQuotedPrice: z.number().nonnegative().default(0),
  finalNegotiatedPrice: z.number().nonnegative().default(0),
  status: z.enum(['pending', 'agreed', 'dispute', 'approved']).default('pending'),
  disputeReason: z.string().optional(),
  approvedBy: z.string().optional(),
});

const wireSchema = z.object({
  partNo: z.string().min(1),
  partName: z.string().min(1),
  supplier: z.string().default(''),
  wireSize: z.string().default(''),
  copperWeightG: z.number().nonnegative().default(0),
  aluminumWeightG: z.number().nonnegative().default(0),
  nonMetalCost: z.number().nonnegative().default(0),
  copperBasePrice: z.number().nonnegative().default(0),
  aluminumBasePrice: z.number().nonnegative().default(0),
  processingFee: z.number().nonnegative().default(0),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
});

const devPartSchema = z.object({
  partNo: z.string().min(1),
  partName: z.string().min(1),
  category: z.enum(['plastic', 'metal', 'rubber', 'other']),
  amortizationQty: z.number().int().nonnegative().default(0),
  unitPriceAfterAmortization: z.number().nonnegative().default(0),
  lifecycleTotalQty: z.number().int().nonnegative().default(0),
});

const devPartMoldSchema = z.object({
  moldType: z.enum(['sample', 'mass']),
  moldName: z.string().min(1),
  moldCost: z.number().nonnegative(),
  isAmortized: z.boolean().optional(),
});

const auxiliarySchema = z.object({
  partNo: z.string().min(1),
  partName: z.string().min(1),
  supplier: z.string().default(''),
  unitPrice: z.number().nonnegative().default(0),
});

const discrepancySchema = z.object({
  harnessId: z.string().optional(),
  partNo: z.string().min(1),
  partName: z.string().min(1),
  partCategory: z.enum(['connector', 'wire', 'dev_part', 'auxiliary', 'other']),
  referencePrice: z.number().nonnegative().default(0),
  actualPrice: z.number().nonnegative().default(0),
  status: z.enum(['open', 'escalated', 'resolved', 'accepted']).optional(),
  resolutionType: z.enum(['harness_price_up', 'supplier_price_down', 'accepted_loss']).optional(),
  resolutionNote: z.string().optional(),
  assignedTo: z.string().optional(),
});

function projectIdFromReq(req: Request) {
  return (req.params.id || req.params.pid) as string;
}

async function logPricingAudit(
  req: Request,
  params: {
    projectId: string;
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
    pricingType: string;
    details?: Record<string, unknown>;
  }
) {
  await AuditService.log({
    userId: req.user!.id,
    projectId: params.projectId,
    action: params.action,
    entity: 'pricing',
    entityId: params.entityId,
    details: {
      pricingType: params.pricingType,
      ...params.details,
    },
  });
}

projectPricingRouter.use(authMiddleware);
scenarioPricingRouter.use(authMiddleware);

projectPricingRouter.get('/connectors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await PricingService.listConnectors(projectIdFromReq(req));
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.post('/connectors', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = connectorSchema.parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.createConnector(projectId, input, req.user?.id);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'CREATE',
      pricingType: 'connector',
      details: { partNo: data.partNo, status: data.status },
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.put('/connectors/:pricingId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = connectorSchema.partial().parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.updateConnector(projectId, req.params.pricingId as string, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'UPDATE',
      pricingType: 'connector',
      details: { partNo: data.partNo, updatedFields: Object.keys(input) },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.get('/wires', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await PricingService.listWires(projectIdFromReq(req));
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.post('/wires', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = wireSchema.parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.createWire(projectId, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'CREATE',
      pricingType: 'wire',
      details: { partNo: data.partNo },
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.put('/wires/:pricingId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = wireSchema.partial().parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.updateWire(projectId, req.params.pricingId as string, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'UPDATE',
      pricingType: 'wire',
      details: { partNo: data.partNo, updatedFields: Object.keys(input) },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.post('/wires/recalculate', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    const input = z.object({
      copperBasePrice: z.number().nonnegative(),
      aluminumBasePrice: z.number().nonnegative(),
    }).parse(req.body);
    const data = await PricingService.recalculateWiresByMetalBasePrice(
      projectId,
      input.copperBasePrice,
      input.aluminumBasePrice
    );
    await logPricingAudit(req, {
      projectId,
      entityId: `wire-recalc:${new Date().toISOString()}`,
      action: 'UPDATE',
      pricingType: 'wire',
      details: {
        recalculatedCount: data.length,
        copperBasePrice: input.copperBasePrice,
        aluminumBasePrice: input.aluminumBasePrice,
      },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.get('/devparts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await PricingService.listDevParts(projectIdFromReq(req));
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.post('/devparts', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = devPartSchema.parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.createDevPart(projectId, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'CREATE',
      pricingType: 'dev_part',
      details: { partNo: data.partNo, category: data.category },
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.put('/devparts/:pricingId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = devPartSchema.partial().parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.updateDevPart(projectId, req.params.pricingId as string, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'UPDATE',
      pricingType: 'dev_part',
      details: { partNo: data.partNo, updatedFields: Object.keys(input) },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.post('/devparts/:pricingId/molds', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = devPartMoldSchema.parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.addDevPartMold(projectId, req.params.pricingId as string, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data?.id ?? (req.params.pricingId as string),
      action: 'UPDATE',
      pricingType: 'dev_part_mold',
      details: { moldName: input.moldName, moldType: input.moldType, moldCost: input.moldCost },
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.get('/auxiliary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await PricingService.listAuxiliary(projectIdFromReq(req));
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.post('/auxiliary', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = auxiliarySchema.parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.createAuxiliary(projectId, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'CREATE',
      pricingType: 'auxiliary',
      details: { partNo: data.partNo },
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.put('/auxiliary/:pricingId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = auxiliarySchema.partial().parse(req.body);
    const projectId = projectIdFromReq(req);
    const data = await PricingService.updateAuxiliary(projectId, req.params.pricingId as string, input);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'UPDATE',
      pricingType: 'auxiliary',
      details: { partNo: data.partNo, updatedFields: Object.keys(input) },
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// [PR-040] DELETE endpoints for pricing resources
projectPricingRouter.delete('/connectors/:pricingId', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    await PricingService.deleteConnector(projectId, req.params.pricingId as string);
    await logPricingAudit(req, {
      projectId,
      entityId: req.params.pricingId as string,
      action: 'DELETE',
      pricingType: 'connector',
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.delete('/wires/:pricingId', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    await PricingService.deleteWire(projectId, req.params.pricingId as string);
    await logPricingAudit(req, {
      projectId,
      entityId: req.params.pricingId as string,
      action: 'DELETE',
      pricingType: 'wire',
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.delete('/devparts/:pricingId', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    await PricingService.deleteDevPart(projectId, req.params.pricingId as string);
    await logPricingAudit(req, {
      projectId,
      entityId: req.params.pricingId as string,
      action: 'DELETE',
      pricingType: 'dev_part',
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

projectPricingRouter.delete('/auxiliary/:pricingId', requireRole(['ADMIN', 'MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    await PricingService.deleteAuxiliary(projectId, req.params.pricingId as string);
    await logPricingAudit(req, {
      projectId,
      entityId: req.params.pricingId as string,
      action: 'DELETE',
      pricingType: 'auxiliary',
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

scenarioPricingRouter.get('/discrepancies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    const scenarioId = req.params.sid as string;
    const data = await PricingService.listDiscrepancies(projectId, scenarioId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioPricingRouter.post('/discrepancies', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    const scenarioId = req.params.sid as string;
    const input = discrepancySchema.parse(req.body);
    const data = await PricingService.createDiscrepancy(projectId, scenarioId, input);
    const trackingSync = await TrackingService.upsertFromPriceDiscrepancy(data);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'CREATE',
      pricingType: 'discrepancy',
      details: { scenarioId, partNo: data.partNo, status: data.status },
    });
    if (trackingSync?.record) {
      await AuditService.log({
        userId: req.user!.id,
        projectId,
        action: trackingSync.action,
        entity: 'tracking',
        entityId: trackingSync.record.id,
        details: {
          source: 'price_discrepancy',
          discrepancyId: data.id,
          scenarioId,
          currentStatus: trackingSync.record.currentStatus,
        },
      });
    }
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

scenarioPricingRouter.put('/discrepancies/:discrepancyId', requireRole(['ADMIN', 'MANAGER', 'ENGINEER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = projectIdFromReq(req);
    const scenarioId = req.params.sid as string;
    const input = discrepancySchema.partial().parse(req.body);
    const data = await PricingService.updateDiscrepancy(projectId, scenarioId, req.params.discrepancyId as string, input);
    const trackingSync = await TrackingService.upsertFromPriceDiscrepancy(data);
    await logPricingAudit(req, {
      projectId,
      entityId: data.id,
      action: 'UPDATE',
      pricingType: 'discrepancy',
      details: { scenarioId, partNo: data.partNo, updatedFields: Object.keys(input) },
    });
    if (trackingSync?.record) {
      await AuditService.log({
        userId: req.user!.id,
        projectId,
        action: trackingSync.action,
        entity: 'tracking',
        entityId: trackingSync.record.id,
        details: {
          source: 'price_discrepancy',
          discrepancyId: data.id,
          scenarioId,
          currentStatus: trackingSync.record.currentStatus,
          updatedFields: Object.keys(input),
        },
      });
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export { scenarioPricingRouter };
export default projectPricingRouter;
