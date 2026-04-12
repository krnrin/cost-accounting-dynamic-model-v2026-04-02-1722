import { db } from '@/data/db';
import type { ProjectRecord, HarnessRecord, QuoteRecord } from '@/data/db';

export interface ProjectPackage {
  /** Schema version for forward compatibility */
  schemaVersion: 1;
  exportedAt: string;
  /** Source app version */
  appVersion: string;
  project: ProjectRecord;
  harnesses: HarnessRecord[];
  quotes: QuoteRecord[];
}

/**
 * Export a complete project as a JSON package
 */
export async function exportProjectPackage(projectId: string): Promise<ProjectPackage> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  
  const harnesses = await db.harnesses.where('projectId').equals(projectId).toArray();
  const quotes = await db.quotes.where('projectId').equals(projectId).toArray();
  
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '0.1.0',
    project,
    harnesses,
    quotes,
  };
}

/**
 * Download project package as JSON file
 */
export async function downloadProjectPackage(projectId: string): Promise<void> {
  const pkg = await exportProjectPackage(projectId);
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pkg.project.meta.projectName}_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

/**
 * Validate a project package
 */
export function validateProjectPackage(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') errors.push('无效的数据格式');
  if (data?.schemaVersion !== 1) errors.push('不支持的版本');
  if (!data?.project?.id) errors.push('缺少项目数据');
  if (!Array.isArray(data?.harnesses)) errors.push('缺少线束数据');
  return { valid: errors.length === 0, errors };
}

/**
 * Import a project package. Generates new IDs to avoid conflicts.
 */
export async function importProjectPackage(pkg: ProjectPackage): Promise<string> {
  // Generate new project ID
  const newProjectId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  // Clone project with new ID
  const newProject: ProjectRecord = {
    ...pkg.project,
    id: newProjectId,
    meta: {
      ...pkg.project.meta,
      projectName: `${pkg.project.meta.projectName} (导入)`,
      createdAt: now,
      updatedAt: now,
    },
  };
  
  // Clone harnesses with new IDs, linked to new project
  const newHarnesses: HarnessRecord[] = pkg.harnesses.map(h => ({
    ...h,
    id: crypto.randomUUID(),
    projectId: newProjectId,
    updatedAt: now,
  }));
  
  // Clone quotes with new IDs
  const newQuotes: QuoteRecord[] = pkg.quotes.map(q => ({
    ...q,
    id: crypto.randomUUID(),
    projectId: newProjectId,
  }));
  
  // Write to database in a transaction
  await db.transaction('rw', [db.projects, db.harnesses, db.quotes], async () => {
    await db.projects.put(newProject);
    await db.harnesses.bulkPut(newHarnesses);
    if (newQuotes.length > 0) {
      await db.quotes.bulkPut(newQuotes);
    }
  });
  
  return newProjectId;
}

/**
 * Copy harnesses from one project to another
 */
export async function copyHarnessesToProject(
  sourceProjectId: string,
  targetProjectId: string,
  harnessIds?: string[]
): Promise<number> {
  const sourceHarnesses = await db.harnesses.where('projectId').equals(sourceProjectId).toArray();
  const toCopy = harnessIds 
    ? sourceHarnesses.filter(h => harnessIds.includes(h.harnessId))
    : sourceHarnesses;
  
  const newHarnesses = toCopy.map(h => ({
    ...h,
    id: crypto.randomUUID(),
    projectId: targetProjectId,
    updatedAt: new Date().toISOString(),
  }));
  
  await db.harnesses.bulkPut(newHarnesses);
  return newHarnesses.length;
}
