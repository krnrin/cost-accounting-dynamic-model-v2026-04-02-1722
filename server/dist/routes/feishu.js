import { Router } from 'express';
import { FeishuService } from '../services/feishuService.js';
import { authMiddleware } from '../middleware/auth.js';
const router = Router();
/** GET /api/feishu/status — 检查飞书是否已配置 */
router.get('/status', (_req, res) => {
    res.json({ configured: FeishuService.isConfigured() });
});
/**
 * POST /api/feishu/login — 飞书 SSO 登录
 * [PR-031] 实装 JWT 签发
 */
router.post('/login', async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ error: '缺少授权码' });
            return;
        }
        // [PR-031] 使用 loginWithFeishu 完成登录并签发 JWT
        const result = await FeishuService.loginWithFeishu(code);
        res.json({ data: result });
    }
    catch (err) {
        next(err);
    }
});
/** POST /api/feishu/proxy — 代理飞书 API 调用 (需要认证) */
router.post('/proxy', authMiddleware, async (req, res, next) => {
    try {
        const { path, method, body } = req.body;
        if (!path) {
            res.status(400).json({ error: '缺少 path 参数' });
            return;
        }
        const result = await FeishuService.proxyApiCall(path, { method, body });
        res.json({ data: result });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/feishu/webhook — 飞书事件订阅回调
 * [PR-031] 添加签名验证中间件
 */
router.post('/webhook', async (req, res, next) => {
    try {
        // [PR-031] 验证签名
        const timestamp = req.headers['x-lark-request-timestamp'];
        const nonce = req.headers['x-lark-request-nonce'];
        const signature = req.headers['x-lark-signature'];
        const bodyString = JSON.stringify(req.body);
        // url_verification 请求不需要签名验证
        if (req.body.type !== 'url_verification') {
            if (!timestamp || !nonce || !signature) {
                res.status(401).json({ error: '缺少签名参数' });
                return;
            }
            // 验证时间戳（防止重放攻击，允许5分钟误差）
            const timestampNum = parseInt(timestamp, 10);
            const now = Math.floor(Date.now() / 1000);
            if (Math.abs(now - timestampNum) > 300) {
                res.status(401).json({ error: '请求已过期' });
                return;
            }
            if (!FeishuService.verifyLarkSignature(timestamp, nonce, bodyString, signature)) {
                res.status(401).json({ error: '签名验证失败' });
                return;
            }
        }
        const result = await FeishuService.handleEvent(req.body);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
export default router;
