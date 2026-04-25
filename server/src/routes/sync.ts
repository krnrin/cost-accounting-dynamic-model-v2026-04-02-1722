import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';
import { toJson } from '../lib/json.js';

const router = Router();

// SECURITY: /push mutates server-side state. VIEWER role is read-only and
// must NOT be allowed to push offline changes back. Restrict to roles
// that can edit data: ADMIN, MANAGER, ENGINEER.
const requireWriteRole = requireRole(['ADMIN', 'MANAGER', 'ENGINEER']);

// POST /api/sync/push — receive local changes
router.post('/push', authMiddleware, requireWriteRole, async (req, res, next) => {
  try {
    const { changes } = req.body;
    const userId = req.user!.id;
    const accepted: string[] = [];
    const errors: any[] = [];
    const conflicts: any[] = [];

    for (const item of changes || []) {
      try {
        const { entity, operation, entityId, payload } = item;

        if (entity === 'project') {
          if (operation === 'delete') {
            await prisma.project.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            const data = {
              id: entityId,
              projectCode: payload.meta?.projectCode || payload.projectCode || `PROJ-${entityId.slice(0, 6)}`,
              projectName: payload.projectName || payload.meta?.projectName || 'Untitled',
              customer: payload.meta?.customer || payload.customer || 'Unknown',
              platform: payload.meta?.platform || payload.platform,
              status: payload.meta?.status || payload.status || 'active',
              costRates: toJson(payload.costRates),
              metalPrices: toJson(payload.metalPrices),
              volumes: toJson(payload.volumes),
              createdBy: userId,
            };
            await prisma.project.upsert({
              where: { id: entityId },
              create: data,
              update: data,
            });
          }
        } else if (entity === 'harness') {
          if (operation === 'delete') {
            await prisma.harness.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            const data = {
              id: entityId,
              projectId: payload.projectId,
              scenarioId: payload.scenarioId || null,
              harnessId: payload.harnessId || entityId,
              harnessName: payload.harnessName || 'Unnamed',
              input: toJson(payload.input),
              result: payload.result ? toJson(payload.result) : null,
            };
            await prisma.harness.upsert({
              where: { id: entityId },
              create: data,
              update: data,
            });
          }
        } else if (entity === 'quote') {
          if (operation === 'delete') {
            await prisma.quote.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            const data = {
              id: entityId,
              projectId: payload.projectId,
              version: payload.version || 'v1',
              status: payload.status || 'draft',
              template: payload.template || 'geely',
              data: toJson(payload.data),
            };
            await prisma.quote.upsert({
              where: { id: entityId },
              create: data,
              update: data,
            });
          }
        } else if (entity === 'version') {
          if (operation === 'delete') {
            await prisma.version.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            const data = {
              id: entityId,
              projectId: payload.projectId,
              versionNumber: payload.versionNumber || 1,
              label: payload.label || 'v1',
              status: payload.status || 'draft',
              snapshot: toJson(payload.snapshot),
              notes: payload.notes,
              createdBy: userId,
            };
            await prisma.version.upsert({
              where: { id: entityId },
              create: data,
              update: data,
            });
          }
        }
        accepted.push(item.id || entityId);
      } catch (err) {
        errors.push({
          id: item.id || item.entityId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    res.json({ accepted, conflicts, errors });
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/pull?since=ISO — return changes since timestamp
// Note: read-only, so VIEWER may pull. authMiddleware only.
router.get('/pull', authMiddleware, async (req, res, next) => {
  try {
    const { since } = req.query;
    const sinceDate = since ? new Date(since as string) : new Date(0);

    const [projects, harnesses, quotes, versions] = await Promise.all([
      prisma.project.findMany({ where: { updatedAt: { gt: sinceDate } } }),
      prisma.harness.findMany({ where: { updatedAt: { gt: sinceDate } } }),
      prisma.quote.findMany({ where: { updatedAt: { gt: sinceDate } } }),
      prisma.version.findMany({ where: { createdAt: { gt: sinceDate } } }),
    ]);

    res.json({
      projects: projects.map((p) => ({ id: p.id, data: p, updatedAt: p.updatedAt.toISOString() })),
      harnesses: harnesses.map((h) => ({ id: h.id, data: h, updatedAt: h.updatedAt.toISOString() })),
      quotes: quotes.map((q) => ({ id: q.id, data: q, updatedAt: q.updatedAt.toISOString() })),
      versions: versions.map((v) => ({ id: v.id, data: v, updatedAt: v.createdAt.toISOString() })),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
