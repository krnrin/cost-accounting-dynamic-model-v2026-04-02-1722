/**
 * SQLite stores JSON as text. These helpers serialize/deserialize safely.
 */

/** Stringify a value for storage. Returns '{}' for null/undefined. */
export function toJson(value: unknown): string {
  if (value === null || value === undefined) return '{}';
  if (typeof value === 'string') return value; // already stringified
  return JSON.stringify(value);
}

/** Parse a stored JSON string back to an object. Returns fallback on error. */
export function fromJson<T = any>(value: string | null | undefined, fallback: T = {} as T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Parse all JSON string fields on a Prisma record for API response. */
export function hydrateJsonFields<T extends Record<string, any>>(
  record: T,
  fields: (keyof T)[]
): T {
  const result = { ...record };
  for (const f of fields) {
    if (typeof result[f] === 'string') {
      result[f] = fromJson(result[f] as string);
    }
  }
  return result;
}

/** Stringify JSON fields before storing. */
export function dehydrateJsonFields<T extends Record<string, any>>(
  data: T,
  fields: (keyof T)[]
): T {
  const result = { ...data };
  for (const f of fields) {
    if (result[f] !== undefined && typeof result[f] !== 'string') {
      (result as any)[f] = toJson(result[f]);
    }
  }
  return result;
}
