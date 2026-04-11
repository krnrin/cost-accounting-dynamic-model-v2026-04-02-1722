import prisma from '../lib/prisma.js';
import { fromJson, toJson } from '../lib/json.js';

function normalizeEvent(event: any) {
  return {
    ...event,
    metadata: fromJson(event.metadata, {}),
  };
}

export class AlertEventService {
  static async list(filters: {
    projectId?: string;
    category?: string;
    severity?: string;
    status?: string;
  } = {}) {
    const rows = await prisma.alertEvent.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [
        { occurredAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return rows.map(normalizeEvent);
  }

  static async getById(id: string) {
    const row = await prisma.alertEvent.findUnique({ where: { id } });
    if (!row) {
      const err: any = new Error('Alert event not found');
      err.status = 404;
      throw err;
    }
    return normalizeEvent(row);
  }

  static async update(id: string, data: any) {
    const current = await this.getById(id);
    const nextStatus = data.status ?? current.status;

    const payload = {
      ...data,
      ...(data.metadata !== undefined ? { metadata: toJson(data.metadata) } : {}),
      acknowledgedAt: nextStatus === 'acknowledged'
        ? (current.acknowledgedAt ?? new Date())
        : data.status === 'active'
          ? null
          : current.acknowledgedAt,
      resolvedAt: nextStatus === 'resolved' || nextStatus === 'dismissed'
        ? (current.resolvedAt ?? new Date())
        : data.status === 'active' || data.status === 'acknowledged'
          ? null
          : current.resolvedAt,
    };

    const row = await prisma.alertEvent.update({
      where: { id },
      data: payload,
    });

    return normalizeEvent(row);
  }

  static async summary(projectId?: string) {
    const rows = await prisma.alertEvent.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
      },
      select: {
        id: true,
        severity: true,
        status: true,
        impactAmount: true,
      },
    });

    const active = rows.filter((row) => row.status === 'active').length;
    const acknowledged = rows.filter((row) => row.status === 'acknowledged').length;
    const resolved = rows.filter((row) => row.status === 'resolved').length;
    const dismissed = rows.filter((row) => row.status === 'dismissed').length;
    const critical = rows.filter((row) => row.severity === 'critical' && (row.status === 'active' || row.status === 'acknowledged')).length;
    const warning = rows.filter((row) => row.severity === 'warning' && (row.status === 'active' || row.status === 'acknowledged')).length;
    const totalImpact = rows.reduce((sum, row) => sum + Number(row.impactAmount || 0), 0);

    return {
      total: rows.length,
      active,
      acknowledged,
      resolved,
      dismissed,
      critical,
      warning,
      totalImpact,
    };
  }
}
