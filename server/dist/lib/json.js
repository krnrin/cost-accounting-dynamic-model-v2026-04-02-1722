/**
 * SQLite stores JSON as text. These helpers serialize/deserialize safely.
 */
/** Stringify a value for storage. Returns '{}' for null/undefined. */
export function toJson(value) {
    if (value === null || value === undefined)
        return '{}';
    if (typeof value === 'string')
        return value; // already stringified
    return JSON.stringify(value);
}
/** Parse a stored JSON string back to an object. Returns fallback on error. */
export function fromJson(value, fallback = {}) {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
/** Parse all JSON string fields on a Prisma record for API response. */
export function hydrateJsonFields(record, fields) {
    const result = { ...record };
    for (const f of fields) {
        if (typeof result[f] === 'string') {
            result[f] = fromJson(result[f]);
        }
    }
    return result;
}
/** Stringify JSON fields before storing. */
export function dehydrateJsonFields(data, fields) {
    const result = { ...data };
    for (const f of fields) {
        if (result[f] !== undefined && typeof result[f] !== 'string') {
            result[f] = toJson(result[f]);
        }
    }
    return result;
}
