import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';

const JSON_FIELDS = ['costRates', 'metalPrices', 'volumes'] as const;

export class ProjectService {
  static async getAllProjects() {
    const projects = await prisma.project.findMany({
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

  static async deleteProject(id: string) {
    return prisma.project.delete({ where: { id } });
  }
}
