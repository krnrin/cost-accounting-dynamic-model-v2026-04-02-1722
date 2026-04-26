import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import prisma from '../lib/prisma.js';
const ROLES = ['ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER'];
export class AuthService {
    static async register(data) {
        const { email, password, name } = data;
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const err = new Error('User already exists');
            err.status = 409;
            throw err;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'ENGINEER', // Always assign ENGINEER role on registration
                tokenVersion: 0, // [PR-003] 初始版本号
            },
        });
        const token = this.generateToken(user);
        return { user: this.sanitizeUser(user), token };
    }
    static async login(data) {
        const { email, password } = data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            const err = new Error('Invalid email or password');
            err.status = 401;
            throw err;
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            const err = new Error('Invalid email or password');
            err.status = 401;
            throw err;
        }
        const token = this.generateToken(user);
        return { user: this.sanitizeUser(user), token };
    }
    static async me(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        return this.sanitizeUser(user);
    }
    /**
     * [PR-003] 递增用户的tokenVersion，使所有现有token失效
     * 用于角色变更时强制用户重新登录
     */
    static async revokeUserTokens(userId) {
        await prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
        });
    }
    static generateToken(user) {
        return jwt.sign(
        // [PR-003] 包含tokenVersion用于版本校验
        { id: user.id, email: user.email, role: user.role, name: user.name, tokenVersion: user.tokenVersion }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
    }
    static sanitizeUser(user) {
        const { password, ...sanitized } = user;
        return sanitized;
    }
}
