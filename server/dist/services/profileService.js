import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';
const PREFERENCE_CATEGORY = 'user_preferences';
const ROLE_LEVEL = {
    VIEWER: 0,
    ENGINEER: 1,
    MANAGER: 2,
    ADMIN: 3,
};
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
};
const DEFAULT_PREFERENCES = {
    themeMode: 'system',
    notifications: {
        alerts: true,
        system: true,
        releases: false,
    },
};
function sanitizeUser(user) {
    const { password, ...safeUser } = user;
    return safeUser;
}
function normalizePreferences(value) {
    return {
        themeMode: value?.themeMode === 'light' || value?.themeMode === 'dark' ? value.themeMode : 'system',
        notifications: {
            alerts: value?.notifications?.alerts ?? DEFAULT_PREFERENCES.notifications.alerts,
            system: value?.notifications?.system ?? DEFAULT_PREFERENCES.notifications.system,
            releases: value?.notifications?.releases ?? DEFAULT_PREFERENCES.notifications.releases,
        },
    };
}
function buildPermissionMatrix(role) {
    const userRole = (role && role in ROLE_LEVEL ? role : 'VIEWER');
    const userLevel = ROLE_LEVEL[userRole];
    return Object.entries(FIELD_MIN_ROLE).map(([field, minRole]) => ({
        field,
        minRole,
        allowed: userLevel >= ROLE_LEVEL[minRole],
    }));
}
export class ProfileService {
    static async getProfile(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            const err = new Error('User not found');
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
    static async updateProfile(userId, data) {
        const payload = {};
        if (typeof data.name === 'string')
            payload.name = data.name.trim();
        if (typeof data.email === 'string')
            payload.email = data.email.trim().toLowerCase();
        const user = await prisma.user.update({
            where: { id: userId },
            data: payload,
        });
        return this.getProfile(user.id);
    }
    static async getPermissions(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
        }
        return {
            userId: user.id,
            role: user.role,
            permissions: buildPermissionMatrix(user.role),
        };
    }
    static async updatePreferences(userId, preferences) {
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
