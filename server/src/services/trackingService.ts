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
    const title = `价格差异跟踪 - ${discrepancy.partNo}${discrepancy.partName ? ` / ${discrepancy.partName}` : ''}`;
    const details = {
      trackingType: mapDiscrepancyTrackingType(discrepancy.partCategory),
      title,
      sourceRef,
      currentStatus,
      severity: mapDiscrepancySeverity(discrepancy.discrepancyRate),
      owner: discrepancy.assignedTo ?? undefined,
      plannedAction: currentStatus === 'pending'
        ? '核对参考价与实际价格，推进协议价/谈判处理'
        : currentStatus === 'in_progress'
          ? '已升级处理，需尽快完成价格谈判或报价决策'
          : undefined,
      actualResult: discrepancy.resolutionNote ?? undefined,
      warningRef: `price-discrepancy:${discrepancy.id}`,
      closeReason: currentStatus === 'closed' ? (discrepancy.resolutionNote ?? '价格差异已接受/关闭') : undefined,
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
