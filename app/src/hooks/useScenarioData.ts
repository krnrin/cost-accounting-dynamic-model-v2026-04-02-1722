/**
 * useScenarioData — Shared hook to load project + scenario + scoped harnesses.
 *
 * Solves three recurring problems across pages:
 * 1. Reading deprecated `project.config` instead of `scenario.config`
 * 2. Missing harnesses with empty scenarioId (legacy v7 migration data)
 * 3. Inconsistent scenario loading logic duplicated across pages
 *
 * Usage:
 *   const { project, scenario, harnesses, loading } = useScenarioData();
 *   const config = scenario?.config; // ✅ Always use scenario config
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { ProjectRecord, ScenarioRecord, HarnessRecord } from '@/data/db';

export interface ScenarioData {
  /** Project record */
  project: ProjectRecord | null;
  /** Scenario record (config lives here since v7) */
  scenario: ScenarioRecord | null;
  /** Harnesses scoped to this scenario (includes legacy empty-scenarioId fallback) */
  harnesses: HarnessRecord[];
  /** True while initial data is loading */
  loading: boolean;
  /** Project ID from URL */
  projectId: string | undefined;
  /** Scenario ID from URL */
  scenarioId: string | undefined;
}

/**
 * Load project, scenario, and harnesses from URL params.
 * Handles legacy data where scenarioId may be empty.
 */
export function useScenarioData(): ScenarioData {
  const { id: projectId, sid: scenarioId } = useParams<{ id: string; sid?: string }>();

  const data = useLiveQuery(async () => {
    if (!projectId) return null;

    const project = await db.projects.get(projectId);
    if (!project) return { project: null, scenario: null, harnesses: [] };

    const scenario = scenarioId ? await db.scenarios.get(scenarioId) : null;

    // Load harnesses: exact scenarioId match + legacy empty scenarioId fallback
    let harnesses: HarnessRecord[];
    if (scenarioId) {
      const exactMatch = await db.harnesses
        .where('scenarioId')
        .equals(scenarioId)
        .toArray();

      // Include legacy harnesses with empty/missing scenarioId from same project
      const projectHarnesses = await db.harnesses
        .where('projectId')
        .equals(projectId)
        .toArray();
      const legacyMatch = projectHarnesses.filter(
        h => !h.scenarioId || h.scenarioId === ''
      );

      // Deduplicate by id
      const seen = new Set<string>();
      harnesses = [];
      for (const h of [...exactMatch, ...legacyMatch]) {
        if (!seen.has(h.id)) {
          seen.add(h.id);
          harnesses.push(h);
        }
      }
    } else {
      harnesses = await db.harnesses
        .where('projectId')
        .equals(projectId)
        .toArray();
    }

    harnesses.sort((a, b) => a.harnessId.localeCompare(b.harnessId));
    return { project, scenario, harnesses };
  }, [projectId, scenarioId]);

  return useMemo(() => ({
    project: data?.project ?? null,
    scenario: data?.scenario ?? null,
    harnesses: data?.harnesses ?? [],
    loading: data === undefined,
    projectId,
    scenarioId,
  }), [data, projectId, scenarioId]);
}

/**
 * Find a single harness by harnessId within a scenario.
 * Handles legacy empty scenarioId fallback.
 */
export async function findHarnessInScenario(
  projectId: string,
  scenarioId: string | undefined,
  harnessId: string,
): Promise<HarnessRecord | undefined> {
  if (scenarioId) {
    // Try compound index first
    const exact = await db.harnesses
      .where('[scenarioId+harnessId]')
      .equals([scenarioId, harnessId])
      .first();
    if (exact) return exact;

    // Fallback: legacy data with empty scenarioId
    return db.harnesses
      .where({ projectId, harnessId })
      .filter(h => !h.scenarioId || h.scenarioId === '')
      .first();
  }

  return db.harnesses
    .where({ projectId, harnessId })
    .first();
}

export default useScenarioData;
