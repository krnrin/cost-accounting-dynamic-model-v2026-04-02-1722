import { Router } from 'express';
import { FeishuService } from '../services/feishuService.js';

const router = Router();

/** GET /api/feishu/status — 检查飞书是否已配置 */
router.get('/status', (_req, res) => {
  res.json({ configured: FeishuService.isConfigured() });
});

/** POST /api/feishu/login — 飞书 SSO 登录 */
router.post('/login', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: '缺少授权码' }); return; }
    const userInfo = await FeishuService.exchangeCode(code);
    // TODO: 查找或创建用户，签发 JWT
    res.json({ data: userInfo });
  } catch (err) { next(err); }
});

/** POST /api/feishu/webhook — 飞书事件订阅回调 */
router.post('/webhook', async (req, res, next) => {
  try {
    const result = await FeishuService.handleEvent(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
