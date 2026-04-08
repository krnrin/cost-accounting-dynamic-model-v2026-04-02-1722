import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import prisma from '../lib/prisma.js';

const ROLES = ['ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  static async register(data: RegisterInput) {
    const { email, password, name, role } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const err: any = new Error('User already exists');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: (role && ROLES.includes(role as Role)) ? role : 'ENGINEER',
      },
    });

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  static async login(data: LoginInput) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const err: any = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const err: any = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      const err: any = new Error('User not found');
      err.status = 404;
      throw err;
    }
    return this.sanitizeUser(user);
  }

  private static generateToken(user: { id: string; email: string; role: string; name: string }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
    );
  }

  private static sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
