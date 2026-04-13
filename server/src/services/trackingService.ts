import prisma from '../lib/prisma.js';

type DiscrepancyTrackingSource = {
  id: string;
  projectId: string;
  scenarioId?: string | null;
  partNo: string;
  partName: string;
  partCategory: string;
  discrepancy: number;
  discrepancyRate: number;
  status: string;
  resolutionNote?: string | null;
  assignedTo?: string | null;
};

function mapDiscrepancyStatus(status: string): 'pending' | 'in_progress' | 'completed' | 'closed' {
  switch (status) {
    case 'escalated':
      return 'in_progress';
    case 'resolved':
      return 'completed';
    case 'accepted':
      return 'closed';
    default:
      return 'pending';
  }
}

function mapDiscrepancySeverity(rate: number): 'low' | 'medium' | 'high' | 'critical' {
  const absRate = Math.abs(rate);
  if (absRate >= 0.2) return 'critical';
  if (absRate >= 0.1) return 'high';
  if (absRate >= 0.03) return 'medium';
  return 'low';
}

function mapDiscrepancyTrackingType(partCategory: string): 'agreed_price' | 'exception' {
  return partCategory === 'other' ? 'exception' : 'agreed_price';
}

export class TrackingService {
  static async listByScenario(scenarioId: string) {
    return prisma.trackingItem.findMany({ where: { scenarioId }, orderBy: { createdAt: 'desc' } });
  }

  static async getById(id: string) {
    const item = await prisma.trackingItem.findUnique({ where: { id } });
    if (!item) {
      const err: any = new Error('Tracking item not found');
      err.status = 404;
      throw err;
    }
    return item;
  }

  static async create(projectId: string, scenarioId: string, data: any) {
    return prisma.trackingItem.create({ data: { ...data, projectId, scenarioId } });
  }

  static async update(id: string, data: any) {
    return prisma.trackingItem.update({ where: { id }, data });
  }

  static async close(id: string, closeReason?: string) {
    return prisma.trackingItem.update({
      where: { id },
      data: {
        currentStatus: 'closed',
        closeReason,
        closedAt: new Date(),
      },
    });
  }

  static async upsertFromPriceDiscrepancy(discrepancy: DiscrepancyTrackingSource) {
    if (!discrepancy.scenarioId) {
      return null;
    }

    const sourceRef = `pricing:discrepancy:${discrepancy.id}`;
    const existing = await prisma.trackingItem.findFirst({
      where: {
        projectId: discrepancy.projectId,
        scenarioId: discrepancy.scenarioId,
        sourceRef,
      },
    });

    const currentStatus = mapDiscrepancyStatus(discrepancy.status);
    const title = `\u4ef7\u683c\u5dee\u5f02\u8ddf\u8e2a - ${discrepancy.partNo}${discrepancy.partName ? ` / ${discrepancy.partName}` : ''}`;
    const details = {
      trackingType: mapDiscrepancyTrackingType(discrepancy.partCategory),
      title,
      sourceRef,
      currentStatus,
      severity: mapDiscrepancySeverity(discrepancy.discrepancyRate),
      owner: discrepancy.assignedTo ?? undefined,
      plannedAction: currentStatus === 'pending'
        ? '\u6838\u5bf9\u53c2\u8003\u4ef7\u4e0e\u5b9e\u9645\u4ef7\u683c\uff0c\u63a8\u8fdb\u534f\u8bae\u4ef7/\u8c08\u5224\u5904\u7406'
        : currentStatus === 'in_progress'
          ? '\u5df2\u5347\u7ea7\u5904\u7406\uff0c\u9700\u5c3d\u5feb\u5b8c\u6210\u4ef7\u683c\u8c08\u5224\u6216\u62a5\u4ef7\u51b3\u7b56'
          : undefined,
      actualResult: discrepancy.resolutionNote ?? undefined,
      warningRef: `price-discrepancy:${discrepancy.id}`,
      closeReason: currentStatus === 'closed' ? (discrepancy.resolutionNote ?? '\u4ef7\u683c\u5dee\u5f02\u5df2\u63a5\u53d7/\u5173\u95ed') : undefined,
      closedAt: currentStatus === 'closed' ? new Date() : null,
    };

    if (existing) {
      const updated = await prisma.trackingItem.update({
        where: { id: existing.id },
        data: details,
      });
      return { action: 'UPDATE' as const, record: updated };
    }

    const created = await prisma.trackingItem.create({
      data: {
        projectId: discrepancy.projectId,
        scenarioId: discrepancy.scenarioId,
        ...details,
      },
    });
    return { action: 'CREATE' as const, record: created };
  }
}
