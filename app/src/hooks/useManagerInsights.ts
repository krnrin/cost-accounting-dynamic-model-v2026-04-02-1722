/**
 * useManagerInsights Hook (C21 — Issue #75)
 * 
 * React Hook for management decision cockpit
 */

import { useState, useCallback, useMemo } from 'react';
import {
  buildDecisionSummary,
  type CostFactor,
  type DecisionSummary,
  type ManagerInsight,
} from '@/engine/shapley_attribution';

export interface UseManagerInsightsReturn {
  factors: CostFactor[];
  summary: DecisionSummary | null;
  insights: ManagerInsight[];
  insightFilter: 'all' | 'risk' | 'opportunity' | 'action' | 'info';

  loadFactors: (factors: CostFactor[]) => void;
  analyze: () => DecisionSummary;
  setInsightFilter: (f: UseManagerInsightsReturn['insightFilter']) => void;
  reset: () => void;
}

export function useManagerInsights(): UseManagerInsightsReturn {
  const [factors, setFactors] = useState<CostFactor[]>([]);
  const [summary, setSummary] = useState<DecisionSummary | null>(null);
  const [insightFilter, setInsightFilter] = useState<UseManagerInsightsReturn['insightFilter']>('all');

  const loadFactors = useCallback((f: CostFactor[]) => {
    setFactors(f);
    setSummary(null);
  }, []);

  const analyze = useCallback((): DecisionSummary => {
    const result = buildDecisionSummary(factors);
    setSummary(result);
    return result;
  }, [factors]);

  const insights = useMemo(() => {
    if (!summary) return [];
    if (insightFilter === 'all') return summary.insights;
    return summary.insights.filter(i => i.type === insightFilter);
  }, [summary, insightFilter]);

  const reset = useCallback(() => {
    setFactors([]);
    setSummary(null);
    setInsightFilter('all');
  }, []);

  return { factors, summary, insights, insightFilter, loadFactors, analyze, setInsightFilter, reset };
}

export default useManagerInsights;
