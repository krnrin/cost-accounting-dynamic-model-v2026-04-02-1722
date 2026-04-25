import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// SECURITY: 'role' is intentionally NOT in this schema. Allowing clients to
// pass role would let any anonymous registrant self-promote to ADMIN.
// Role assignment must happen server-side (default: VIEWER) and elevation
// must go through an authenticated admin endpoint.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await AuthService.register(validatedData);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await AuthService.login(validatedData);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const user = await AuthService.me(userId);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authMiddleware, async (_req, res) => {
  res.status(204).send();
});

export default router;
