import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';

const JSON_FIELDS = ['costRates', 'metalPrices', 'volumes'] as const;

export class ProjectService {
  static async getAllProjects(filters?: { search?: string; status?: string }) {
    const search = filters?.search?.trim();
    const status = filters?.status?.trim();

    const projects = await prisma.project.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { projectCode: { contains: search } },
                { projectName: { contains: search } },
                { customer: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return projects.map((p) => hydrateJsonFields(p, [...JSON_FIELDS]));
  }

  static async getProjectById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        harnesses: true,
        quotes: true,
        versions: true,
      },
    });
    if (!project) {
      const err: any = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    return hydrateJsonFields(project, [...JSON_FIELDS]);
  }

  static async createProject(data: any, userId: string) {
    const dbData = dehydrateJsonFields(
      { ...data, createdBy: userId },
      [...JSON_FIELDS]
    );
    const project = await prisma.project.create({ data: dbData });
    return hydrateJsonFields(project, [...JSON_FIELDS]);
  }

  static async updateProject(id: string, data: any) {
    const dbData = dehydrateJsonFields(data, [...JSON_FIELDS]);
    const project = await prisma.project.update({ where: { id }, data: dbData });
    return hydrateJsonFields(project, [...JSON_FIELDS]);
  }

  static async getProjectDashboard(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        harnesses: true,
        quotes: { orderBy: { updatedAt: 'desc' }, take: 1 },
        versions: true,
      },
    });
    if (!project) {
      const err: any = new Error('Project not found');
      err.status = 404;
      throw err;
    }

    const hydrated = hydrateJsonFields(project, [...JSON_FIELDS]);
    const latestQuote = hydrated.quotes?.[0];
    const quoteData = latestQuote ? hydrateJsonFields(latestQuote as any, ['data']) : null;
    const quoteTotal = quoteData?.data?.totals?.deliveredPrice ?? null;

    return {
      id: hydrated.id,
      projectCode: hydrated.projectCode,
      projectName: hydrated.projectName,
      customer: hydrated.customer,
      platform: hydrated.platform,
      status: hydrated.status,
      harnessCount: hydrated.harnesses?.length ?? 0,
      quoteCount: hydrated.quotes?.length ?? 0,
      versionCount: hydrated.versions?.length ?? 0,
      latestQuoteTotal: quoteTotal,
      updatedAt: hydrated.updatedAt,
    };
  }

  static async deleteProject(id: string) {
    return prisma.project.delete({ where: { id } });
  }
}
