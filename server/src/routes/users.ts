import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AuthService } from '../services/authService.js';
import prisma from '../lib/prisma.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER']),
});

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

/**
 * [PR-003] 更新用户角色
 * 角色变更后自动撤销用户的所有token，强制重新登录
 */
router.patch('/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = updateRoleSchema.parse(req.body);

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 更新角色
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
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

    // [PR-003] 角色变更后撤销所有token
    await AuthService.revokeUserTokens(id);

    res.json({ data: updatedUser });
  } catch (error) {
    next(error);
  }
});

export default router;
