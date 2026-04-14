/**
 * useSimulationSnapshot Hook (C20 — Issue #72)
 * 
 * React Hook for simulation snapshot management
 */

import { useState, useCallback } from 'react';
import {
  createSimulationSnapshot,
  compareSimulations,
  prepareScenarioFromSimulation,
  type SimulationSnapshot,
  type SimulationParams,
  type SimulationResults,
  type ScenarioFromSimulation,
} from '@/engine/simulation_snapshot';

export interface UseSimulationSnapshotReturn {
  snapshots: SimulationSnapshot[];
  selectedPair: [SimulationSnapshot | null, SimulationSnapshot | null];
  comparison: Array<{ field: string; label: string; valueA: number; valueB: number; delta: number }> | null;

  saveSnapshot: (scenarioId: string, name: string, desc: string, params: SimulationParams, results: SimulationResults, tags?: string[]) => SimulationSnapshot;
  deleteSnapshot: (snapshotId: string) => void;
  selectForCompare: (index: 0 | 1, snapshotId: string) => void;
  runCompare: () => void;
  convertToScenario: (snapshotId: string, scenarioName: string) => ScenarioFromSimulation | null;
  reset: () => void;
}

export function useSimulationSnapshot(
  initialSnapshots: SimulationSnapshot[] = [],
): UseSimulationSnapshotReturn {
  const [snapshots, setSnapshots] = useState<SimulationSnapshot[]>(initialSnapshots);
  const [selectedPair, setSelectedPair] = useState<[SimulationSnapshot | null, SimulationSnapshot | null]>([null, null]);
  const [comparison, setComparison] = useState<Array<{ field: string; label: string; valueA: number; valueB: number; delta: number }> | null>(null);

  const saveSnapshot = useCallback((scenarioId: string, name: string, desc: string, params: SimulationParams, results: SimulationResults, tags: string[] = []): SimulationSnapshot => {
    const snap = createSimulationSnapshot(scenarioId, name, desc, params, results, tags);
    setSnapshots(prev => [...prev, snap]);
    return snap;
  }, []);

  const deleteSnapshot = useCallback((snapshotId: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
  }, []);

  const selectForCompare = useCallback((index: 0 | 1, snapshotId: string) => {
    const snap = snapshots.find(s => s.id === snapshotId) || null;
    setSelectedPair(prev => {
      const next: [SimulationSnapshot | null, SimulationSnapshot | null] = [...prev];
      next[index] = snap;
      return next;
    });
    setComparison(null);
  }, [snapshots]);

  const runCompare = useCallback(() => {
    if (selectedPair[0] && selectedPair[1]) {
      setComparison(compareSimulations(selectedPair[0], selectedPair[1]));
    }
  }, [selectedPair]);

  const convertToScenario = useCallback((snapshotId: string, scenarioName: string): ScenarioFromSimulation | null => {
    const snap = snapshots.find(s => s.id === snapshotId);
    if (!snap) return null;
    return prepareScenarioFromSimulation(snap, scenarioName);
  }, [snapshots]);

  const reset = useCallback(() => {
    setSnapshots([]);
    setSelectedPair([null, null]);
    setComparison(null);
  }, []);

  return {
    snapshots,
    selectedPair,
    comparison,
    saveSnapshot,
    deleteSnapshot,
    selectForCompare,
    runCompare,
    convertToScenario,
    reset,
  };
}

export default useSimulationSnapshot;
