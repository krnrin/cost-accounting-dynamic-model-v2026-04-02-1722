import { apiClient } from './apiClient';

export interface SimulationTaskRow {
  id: string;
  projectId: string;
  scenarioId: string;
  name: string;
  status: string;
  parameterSnapshot: {
    copperAdj?: number;
    aluminumAdj?: number;
    volumeAdj?: number;
    dropRate?: number;
    hoursAdj?: number;
  };
  resultSnapshot: any;
  baselineScenarioId?: string | null;
  convertedScenarioId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualDropRow {
  id: string;
  projectId: string;
  scenarioId: string;
  name: string;
  status: string;
  year: number;
  dropRate: number;
  costBefore: number;
  costAfter: number;
  priceBefore: number;
  priceAfter: number;
  profitBefore: number;
  profitAfter: number;
  impactSummary: {
    deltaCost: number;
    deltaPrice: number;
    deltaProfit: number;
    dropRate: number;
    formula: string;
  };
  createdAt: string;
  updatedAt: string;
}

export async function fetchSimulations(scenarioId: string) {
  return apiClient<SimulationTaskRow[]>(`/scenarios/${scenarioId}/simulations`);
}

export async function createSimulationTask(scenarioId: string, payload: Partial<SimulationTaskRow> & { projectId: string; name: string }) {
  return apiClient<SimulationTaskRow>(`/scenarios/${scenarioId}/simulations`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateSimulationTask(simId: string, payload: Partial<SimulationTaskRow>) {
  return apiClient<SimulationTaskRow>(`/simulations/${simId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function runSimulationTask(simId: string) {
  return apiClient<SimulationTaskRow>(`/simulations/${simId}/run`, {
    method: 'POST',
  });
}

export async function convertSimulationTask(simId: string) {
  return apiClient<{ task: SimulationTaskRow; scenario: { id: string; name: string } }>(`/simulations/${simId}/convert-to-scenario`, {
    method: 'POST',
  });
}

export async function fetchAnnualDrops(scenarioId: string) {
  return apiClient<AnnualDropRow[]>(`/scenarios/${scenarioId}/annual-drops`);
}

export async function createAnnualDrop(scenarioId: string, payload: Partial<AnnualDropRow> & { projectId: string; name: string; year: number; dropRate: number; costBefore: number; priceBefore: number }) {
  return apiClient<AnnualDropRow>(`/scenarios/${scenarioId}/annual-drops`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateAnnualDrop(adId: string, payload: Partial<AnnualDropRow>) {
  return apiClient<AnnualDropRow>(`/annual-drops/${adId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function fetchAnnualDropImpact(adId: string) {
  return apiClient<AnnualDropRow>(`/annual-drops/${adId}/impact`);
}
