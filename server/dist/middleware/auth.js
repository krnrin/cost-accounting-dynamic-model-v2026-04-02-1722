import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import prisma from '../lib/prisma.js';
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
    }
};
/**
 * [PR-003] JWT版本校验中间件
 * 验证token中的tokenVersion与数据库中的一致
 * 若不一致说明用户角色已变更，需要重新登录
 */
export const authMiddlewareWithVersionCheck = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        // 查询用户当前的tokenVersion
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { tokenVersion: true },
        });
        if (!user) {
            res.status(401).json({ error: 'Unauthorized: User not found' });
            return;
        }
        // [PR-003] 版本不一致则拒绝访问
        if (decoded.tokenVersion !== user.tokenVersion) {
            res.status(401).json({ error: 'Unauthorized: Token revoked, please login again' });
            return;
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
    }
};
