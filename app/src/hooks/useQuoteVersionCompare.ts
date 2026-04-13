/**
 * useQuoteVersionCompare Hook (C15 — Issue #69)
 * 
 * React Hook for quote version comparison:
 * - Select two quote versions
 * - View parameter diffs (metal/rate/bom)
 * - View output diffs (cost/price/margin)
 * - Filter by diff category
 */

import { useState, useCallback, useMemo } from 'react';
import {
  compareQuoteVersions,
  hasParamChanged,
  type QuoteParamRef,
  type QuoteVersionDiff,
  type ParamDiffItem,
} from '@/engine/quote_param_snapshot';

export type DiffFilterCategory = 'all' | 'metal' | 'rate' | 'bom' | 'output';

export interface UseQuoteVersionCompareReturn {
  // State
  baseQuote: QuoteParamRef | null;
  compareQuote: QuoteParamRef | null;
  diff: QuoteVersionDiff | null;
  filter: DiffFilterCategory;
  filteredParamDiffs: ParamDiffItem[];
  hasChanges: boolean;

  // Actions
  selectBase: (quote: QuoteParamRef) => void;
  selectCompare: (quote: QuoteParamRef) => void;
  runCompare: () => QuoteVersionDiff | null;
  setFilter: (filter: DiffFilterCategory) => void;
  swapVersions: () => void;
  reset: () => void;
}

export function useQuoteVersionCompare(): UseQuoteVersionCompareReturn {
  const [baseQuote, setBaseQuote] = useState<QuoteParamRef | null>(null);
  const [compareQuote, setCompareQuote] = useState<QuoteParamRef | null>(null);
  const [diff, setDiff] = useState<QuoteVersionDiff | null>(null);
  const [filter, setFilter] = useState<DiffFilterCategory>('all');

  const selectBase = useCallback((quote: QuoteParamRef) => {
    setBaseQuote(quote);
    setDiff(null);
  }, []);

  const selectCompare = useCallback((quote: QuoteParamRef) => {
    setCompareQuote(quote);
    setDiff(null);
  }, []);

  const runCompare = useCallback((): QuoteVersionDiff | null => {
    if (!baseQuote || !compareQuote) return null;
    const result = compareQuoteVersions(baseQuote, compareQuote);
    setDiff(result);
    return result;
  }, [baseQuote, compareQuote]);

  const swapVersions = useCallback(() => {
    setBaseQuote(prev => {
      setCompareQuote(baseQuote);
      return compareQuote;
    });
    setDiff(null);
  }, [baseQuote, compareQuote]);

  const reset = useCallback(() => {
    setBaseQuote(null);
    setCompareQuote(null);
    setDiff(null);
    setFilter('all');
  }, []);

  const hasChanges = useMemo(() => {
    if (!baseQuote || !compareQuote) return false;
    return hasParamChanged(baseQuote, compareQuote);
  }, [baseQuote, compareQuote]);

  const filteredParamDiffs = useMemo(() => {
    if (!diff) return [];
    if (filter === 'all' || filter === 'output') return diff.paramDiffs;
    return diff.paramDiffs.filter(d => d.category === filter);
  }, [diff, filter]);

  return {
    baseQuote,
    compareQuote,
    diff,
    filter,
    filteredParamDiffs,
    hasChanges,
    selectBase,
    selectCompare,
    runCompare,
    setFilter,
    swapVersions,
    reset,
  };
}

export default useQuoteVersionCompare;
