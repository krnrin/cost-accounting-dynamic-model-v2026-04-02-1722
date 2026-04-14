/**
 * useScenarioDeepCompare Hook (C17 — Issue #65)
 * 
 * React Hook for deep multi-dimension scenario comparison
 */

import { useState, useCallback, useMemo } from 'react';
import {
  deepCompareScenarios,
  filterDimensions,
  type ScenarioCompareInput,
  type DeepCompareResult,
  type ComparisonDimension,
} from '@/engine/scenario_deep_compare';

export type DimensionFilter = 'all' | 'kpi' | 'cost' | 'alloc' | 'version';

export interface UseScenarioDeepCompareReturn {
  scenarios: ScenarioCompareInput[];
  result: DeepCompareResult | null;
  filter: DimensionFilter;
  filteredDimensions: ComparisonDimension[];
  onlyDifferences: boolean;

  addScenario: (scenario: ScenarioCompareInput) => void;
  removeScenario: (scenarioId: string) => void;
  runCompare: () => DeepCompareResult;
  setFilter: (f: DimensionFilter) => void;
  setOnlyDifferences: (v: boolean) => void;
  reset: () => void;
}

export function useScenarioDeepCompare(): UseScenarioDeepCompareReturn {
  const [scenarios, setScenarios] = useState<ScenarioCompareInput[]>([]);
  const [result, setResult] = useState<DeepCompareResult | null>(null);
  const [filter, setFilter] = useState<DimensionFilter>('all');
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  const addScenario = useCallback((scenario: ScenarioCompareInput) => {
    setScenarios(prev => {
      if (prev.find(s => s.scenarioId === scenario.scenarioId)) return prev;
      return [...prev, scenario];
    });
    setResult(null);
  }, []);

  const removeScenario = useCallback((scenarioId: string) => {
    setScenarios(prev => prev.filter(s => s.scenarioId !== scenarioId));
    setResult(null);
  }, []);

  const runCompare = useCallback((): DeepCompareResult => {
    const r = deepCompareScenarios(scenarios);
    setResult(r);
    return r;
  }, [scenarios]);

  const reset = useCallback(() => {
    setScenarios([]);
    setResult(null);
    setFilter('all');
    setOnlyDifferences(false);
  }, []);

  const filteredDimensions = useMemo(() => {
    if (!result) return [];
    let dims = filterDimensions(result, filter);
    if (onlyDifferences) {
      dims = dims.filter(d => d.deltas.some(dt => dt.delta !== null && Math.abs(dt.delta) > 0.0001));
    }
    return dims;
  }, [result, filter, onlyDifferences]);

  return {
    scenarios,
    result,
    filter,
    filteredDimensions,
    onlyDifferences,
    addScenario,
    removeScenario,
    runCompare,
    setFilter,
    setOnlyDifferences,
    reset,
  };
}

export default useScenarioDeepCompare;
