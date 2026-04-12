import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        feishuId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
});

export default router;
