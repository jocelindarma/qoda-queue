import "server-only";

/**
 * In-memory sliding window. Fine for one process; resets on restart.
 * Returns true if this hit is allowed.
 */
export function allow(bucket: string, key: string, limit: number, windowMs: number): boolean {
  const g = globalThis as unknown as { __rate?: Map<string, number[]> };
  const hits = (g.__rate ??= new Map<string, number[]>());
  const id = `${bucket}:${key}`;
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(id, recent);
    return false;
  }
  recent.push(now);
  hits.set(id, recent);
  // keep the map from growing forever
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
