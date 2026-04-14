/**
 * useStableLiveQuery — wraps Dexie useLiveQuery with referential stability.
 *
 * Problem:
 *   useLiveQuery returns a **new object/array reference** on every observation
 *   cycle, even when the underlying data has not changed. Any useEffect that
 *   lists the query result in its dependency array will re-fire on every
 *   render, creating an infinite setState → re-render → re-query loop.
 *
 * Solution:
 *   We keep the previous result in a ref and only update the returned value
 *   when the serialised (JSON) representation actually differs.
 *
 * Usage:
 *   Replace:
 *     const data = useLiveQuery(() => db.harnesses.where(...).toArray());
 *   With:
 *     const data = useStableLiveQuery(() => db.harnesses.where(...).toArray());
 */

import { useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Shallow-serialize for comparison. For large datasets we only hash top-level
 * ids to keep the comparison O(n) instead of O(n·m).
 */
function stableKey(value: unknown): string {
  if (value === undefined || value === null) return String(value);
  if (Array.isArray(value)) {
    // Fast path: compare array of objects by id + length
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'id' in value[0]) {
      return `[${value.length}]` + value.map((v: any) => v.id + ':' + (v.updatedAt ?? v._rev ?? '')).join(',');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function useStableLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps?: any[],
  defaultValue?: T,
): T | undefined {
  const raw = useLiveQuery(querier, deps ?? [], defaultValue);

  const prevKeyRef = useRef<string>('');
  const prevValueRef = useRef<T | undefined>(defaultValue);

  const stable = useMemo(() => {
    const key = stableKey(raw);
    if (key === prevKeyRef.current) {
      return prevValueRef.current;
    }
    prevKeyRef.current = key;
    prevValueRef.current = raw;
    return raw;
  }, [raw]);

  return stable;
}

/**
 * Same as useStableLiveQuery but for a query that returns an object with
 * multiple top-level keys (e.g. { harnesses, project }).
 * Each key is independently stabilised.
 */
export function useStableLiveQueryObject<T extends Record<string, unknown>>(
  querier: () => T | Promise<T>,
  deps?: any[],
  defaultValue?: T,
): T | undefined {
  const raw = useLiveQuery(querier, deps ?? [], defaultValue);

  const prevKeysRef = useRef<Record<string, string>>({});
  const prevValuesRef = useRef<Record<string, unknown>>({});
  const prevResultRef = useRef<T | undefined>(defaultValue);

  const stable = useMemo(() => {
    if (raw === undefined || raw === null) return raw as T | undefined;

    let changed = false;
    const nextValues: Record<string, unknown> = {};

    for (const k of Object.keys(raw)) {
      const key = stableKey((raw as any)[k]);
      if (key !== prevKeysRef.current[k]) {
        changed = true;
        prevKeysRef.current[k] = key;
        prevValuesRef.current[k] = (raw as any)[k];
      }
      nextValues[k] = prevValuesRef.current[k];
    }

    if (!changed && prevResultRef.current !== undefined) {
      return prevResultRef.current;
    }

    const result = { ...nextValues } as T;
    prevResultRef.current = result;
    return result;
  }, [raw]);

  return stable;
}

export default useStableLiveQuery;
