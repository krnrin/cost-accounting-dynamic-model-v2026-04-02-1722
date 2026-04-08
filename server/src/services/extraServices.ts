import prisma from '../lib/prisma.js';
import { hydrateJsonFields, dehydrateJsonFields } from '../lib/json.js';

export class QuoteService {
  static async getQuotesByProject(projectId: string) {
    const quotes = await prisma.quote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return quotes.map((q) => hydrateJsonFields(q, ['data']));
  }

  static async createQuote(projectId: string, data: any) {
    const dbData = dehydrateJsonFields({ ...data, projectId }, ['data']);
    const quote = await prisma.quote.create({ data: dbData });
    return hydrateJsonFields(quote, ['data']);
  }

  static async updateQuote(id: string, data: any) {
    const dbData = dehydrateJsonFields(data, ['data']);
    const quote = await prisma.quote.update({ where: { id }, data: dbData });
    return hydrateJsonFields(quote, ['data']);
  }

  static async deleteQuote(id: string) {
    return prisma.quote.delete({ where: { id } });
  }
}

export class VersionService {
  static async getVersionsByProject(projectId: string) {
    const versions = await prisma.version.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map((v) => hydrateJsonFields(v, ['snapshot']));
  }

  static async createVersion(projectId: string, data: any) {
    const dbData = dehydrateJsonFields({ ...data, projectId }, ['snapshot']);
    const version = await prisma.version.create({ data: dbData });
    return hydrateJsonFields(version, ['snapshot']);
  }

  static async updateVersion(id: string, data: any) {
    const dbData = dehydrateJsonFields(data, ['snapshot']);
    const version = await prisma.version.update({ where: { id }, data: dbData });
    return hydrateJsonFields(version, ['snapshot']);
  }

  static async updateStatus(id: string, status: string) {
    return prisma.version.update({
      where: { id },
      data: { status },
    });
  }

  static async deleteVersion(id: string) {
    return prisma.version.delete({ where: { id } });
  }
}
