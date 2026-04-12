import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ManagerDashboardService } from '../services/managerDashboardService.js';

const router = Router();

router.use(authMiddleware);

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
