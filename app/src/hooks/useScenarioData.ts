import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import {
  applyInstallationRatiosToHarnessRecords,
  resolveScenarioVehicleConfigs,
} from '@/engine/configuration_model';
import { ensureScenarioWorkspaceHydrated } from '@/data/serverScenarioSync';

export interface ScenarioData {
  project: ProjectRecord | null;
  scenario: ScenarioRecord | null;
  harnesses: HarnessRecord[];
  loading: boolean;
  projectId: string | undefined;
  scenarioId: string | undefined;
}

export function useScenarioData(): ScenarioData {
  const { id: projectId, sid: scenarioId } = useParams<{ id: string; sid?: string }>();

  const data = useLiveQuery(async () => {
    if (!projectId) return null;

    let project = await db.projects.get(projectId);
    if (!project) {
      if (scenarioId) {
        try {
          await ensureScenarioWorkspaceHydrated(projectId, scenarioId);
          project = await db.projects.get(projectId);
        } catch (error) {
          console.error('Failed to hydrate project from server:', error);
        }
      }
      if (!project) {
        return { project: null, scenario: null, harnesses: [] };
      }
    }

    let scenario = scenarioId ? await db.scenarios.get(scenarioId) : null;
    let harnesses = scenarioId
      ? await db.harnesses.where('scenarioId').equals(scenarioId).sortBy('harnessId')
      : await db.harnesses.where('projectId').equals(projectId).sortBy('harnessId');

    if (scenarioId && (!scenario || harnesses.length === 0)) {
      try {
        await ensureScenarioWorkspaceHydrated(projectId, scenarioId);
        scenario = await db.scenarios.get(scenarioId);
        harnesses = await db.harnesses.where('scenarioId').equals(scenarioId).sortBy('harnessId');
      } catch (error) {
        console.error('Failed to hydrate scenario workspace from server:', error);
      }
    }

    const effectiveHarnesses = scenario
      ? applyInstallationRatiosToHarnessRecords(
        harnesses,
        resolveScenarioVehicleConfigs(scenario),
        scenario.harnessConfigMappings ?? [],
      )
      : harnesses;

    return { project, scenario, harnesses: effectiveHarnesses };
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

export async function findHarnessInScenario(
  projectId: string,
  scenarioId: string | undefined,
  harnessId: string,
): Promise<HarnessRecord | undefined> {
  if (scenarioId) {
    return db.harnesses
      .where('[scenarioId+harnessId]')
      .equals([scenarioId, harnessId])
      .first();
  }

  return db.harnesses
    .where({ projectId, harnessId })
    .first();
}

export default useScenarioData;
