import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';

const PREFERENCE_CATEGORY = 'user_preferences';

const ROLE_LEVEL = {
  VIEWER: 0,
  ENGINEER: 1,
  MANAGER: 2,
  ADMIN: 3,
} as const;

const FIELD_MIN_ROLE = {
  profit: 'MANAGER',
  profitRate: 'MANAGER',
  mgmtFee: 'MANAGER',
  mgmtRate: 'MANAGER',
  costRates: 'ADMIN',
  metalPrice: 'ENGINEER',
  internalCost: 'MANAGER',
  bomEdit: 'ENGINEER',
  quoteExport: 'ENGINEER',
  simulation: 'ENGINEER',
  changeExport: 'ENGINEER',
  versionLock: 'MANAGER',
  auditLog: 'MANAGER',
  auditPublish: 'ADMIN',
  deleteProject: 'ADMIN',
  deleteHarness: 'MANAGER',
} as const;

type PermissionField = keyof typeof FIELD_MIN_ROLE;
type UserRole = keyof typeof ROLE_LEVEL;

export interface UserPreferences {
  themeMode: 'light' | 'dark' | 'system';
  notifications: {
    alerts: boolean;
    system: boolean;
    releases: boolean;
  };
}

const DEFAULT_PREFERENCES: UserPreferences = {
  themeMode: 'system',
  notifications: {
    alerts: true,
    system: true,
    releases: false,
  },
};

function sanitizeUser(user: any) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function normalizePreferences(value: any): UserPreferences {
  return {
    themeMode: value?.themeMode === 'light' || value?.themeMode === 'dark' ? value.themeMode : 'system',
    notifications: {
      alerts: value?.notifications?.alerts ?? DEFAULT_PREFERENCES.notifications.alerts,
      system: value?.notifications?.system ?? DEFAULT_PREFERENCES.notifications.system,
      releases: value?.notifications?.releases ?? DEFAULT_PREFERENCES.notifications.releases,
    },
  };
}

function buildPermissionMatrix(role: string | null | undefined) {
  const userRole = (role && role in ROLE_LEVEL ? role : 'VIEWER') as UserRole;
  const userLevel = ROLE_LEVEL[userRole];

  return Object.entries(FIELD_MIN_ROLE).map(([field, minRole]) => ({
    field,
    minRole,
    allowed: userLevel >= ROLE_LEVEL[minRole],
  }));
}

export class ProfileService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err: any = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const preferenceRow = await prisma.setting.findUnique({
      where: { category_key: { category: PREFERENCE_CATEGORY, key: userId } },
    });

    return {
      ...sanitizeUser(user),
      preferences: normalizePreferences(fromJson(preferenceRow?.value, DEFAULT_PREFERENCES)),
    };
  }

  static async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const payload: Record<string, string> = {};
    if (typeof data.name === 'string') payload.name = data.name.trim();
    if (typeof data.email === 'string') payload.email = data.email.trim().toLowerCase();

    const user = await prisma.user.update({
      where: { id: userId },
      data: payload,
    });

    return this.getProfile(user.id);
  }

  static async getPermissions(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err: any = new Error('User not found');
      err.status = 404;
      throw err;
    }

    return {
      userId: user.id,
      role: user.role,
      permissions: buildPermissionMatrix(user.role),
    };
  }

  static async updatePreferences(userId: string, preferences: UserPreferences) {
    const normalized = normalizePreferences(preferences);
    await prisma.setting.upsert({
      where: { category_key: { category: PREFERENCE_CATEGORY, key: userId } },
      update: { value: toJson(normalized), updatedBy: userId },
      create: {
        category: PREFERENCE_CATEGORY,
        key: userId,
        value: toJson(normalized),
        isGlobal: false,
        updatedBy: userId,
      },
    });

    return normalized;
  }
}
