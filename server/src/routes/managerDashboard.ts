import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js'; // [PR-032]
import { ManagerDashboardService } from '../services/managerDashboardService.js';

const router = Router();

// [PR-032] Manager Dashboard 需要 MANAGER 或 ADMIN 权限
router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getOverview();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/profit-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getProfitSummary();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/recovery-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getRecoverySummary();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/alert-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getAlertSummary();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/scenario-comparison', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getScenarioComparison();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/anomaly-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getAnomalySummary();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/profit-waterfall', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ManagerDashboardService.getProfitWaterfall();
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
