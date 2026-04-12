import { apiClient } from './apiClient';
import type {
  AuxiliaryPartPayload,
  AuxiliaryPartRecord,
  ConnectorPricingPayload,
  ConnectorPricingRecord,
  DevPartMoldPayload,
  DevPartPricingPayload,
  DevPartPricingRecord,
  PriceDiscrepancyPayload,
  PriceDiscrepancyRecord,
  WirePricingPayload,
  WirePricingRecord,
} from '@/types/pricing';

export async function fetchConnectorPricing(projectId: string) {
  return apiClient<ConnectorPricingRecord[]>(`/projects/${projectId}/pricing/connectors`);
}

export async function createConnectorPricing(projectId: string, payload: ConnectorPricingPayload) {
  return apiClient<ConnectorPricingRecord>(`/projects/${projectId}/pricing/connectors`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateConnectorPricing(projectId: string, pricingId: string, payload: Partial<ConnectorPricingPayload>) {
  return apiClient<ConnectorPricingRecord>(`/projects/${projectId}/pricing/connectors/${pricingId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function fetchWirePricing(projectId: string) {
  return apiClient<WirePricingRecord[]>(`/projects/${projectId}/pricing/wires`);
}

export async function createWirePricing(projectId: string, payload: WirePricingPayload) {
  return apiClient<WirePricingRecord>(`/projects/${projectId}/pricing/wires`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateWirePricing(projectId: string, pricingId: string, payload: Partial<WirePricingPayload>) {
  return apiClient<WirePricingRecord>(`/projects/${projectId}/pricing/wires/${pricingId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function recalculateWirePricing(projectId: string, metalPrice: { copperBasePrice: number; aluminumBasePrice: number }) {
  return apiClient<WirePricingRecord[]>(`/projects/${projectId}/pricing/wires/recalculate`, {
    method: 'POST',
    body: metalPrice,
  });
}

export async function fetchDevPartPricing(projectId: string) {
  return apiClient<DevPartPricingRecord[]>(`/projects/${projectId}/pricing/devparts`);
}

export async function createDevPartPricing(projectId: string, payload: DevPartPricingPayload) {
  return apiClient<DevPartPricingRecord>(`/projects/${projectId}/pricing/devparts`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateDevPartPricing(projectId: string, pricingId: string, payload: Partial<DevPartPricingPayload>) {
  return apiClient<DevPartPricingRecord>(`/projects/${projectId}/pricing/devparts/${pricingId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function addDevPartMold(projectId: string, pricingId: string, payload: DevPartMoldPayload) {
  return apiClient<DevPartPricingRecord>(`/projects/${projectId}/pricing/devparts/${pricingId}/molds`, {
    method: 'POST',
    body: payload,
  });
}

export async function fetchAuxiliaryPricing(projectId: string) {
  return apiClient<AuxiliaryPartRecord[]>(`/projects/${projectId}/pricing/auxiliary`);
}

export async function createAuxiliaryPricing(projectId: string, payload: AuxiliaryPartPayload) {
  return apiClient<AuxiliaryPartRecord>(`/projects/${projectId}/pricing/auxiliary`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateAuxiliaryPricing(projectId: string, pricingId: string, payload: Partial<AuxiliaryPartPayload>) {
  return apiClient<AuxiliaryPartRecord>(`/projects/${projectId}/pricing/auxiliary/${pricingId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function fetchPriceDiscrepancies(projectId: string, scenarioId: string) {
  return apiClient<PriceDiscrepancyRecord[]>(`/projects/${projectId}/scenarios/${scenarioId}/pricing/discrepancies`);
}

export async function createPriceDiscrepancy(projectId: string, scenarioId: string, payload: PriceDiscrepancyPayload) {
  return apiClient<PriceDiscrepancyRecord>(`/projects/${projectId}/scenarios/${scenarioId}/pricing/discrepancies`, {
    method: 'POST',
    body: payload,
  });
}

export async function updatePriceDiscrepancy(
  projectId: string,
  scenarioId: string,
  discrepancyId: string,
  payload: Partial<PriceDiscrepancyPayload>
) {
  return apiClient<PriceDiscrepancyRecord>(
    `/projects/${projectId}/scenarios/${scenarioId}/pricing/discrepancies/${discrepancyId}`,
    {
      method: 'PUT',
      body: payload,
    }
  );
}
