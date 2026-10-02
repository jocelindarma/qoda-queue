import "server-only";
import { and, count, eq, gt, min } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Queue } from "@/db/schema";

const { tickets } = schema;
const LOOKBACK_MS = 30 * 60 * 1000;
const MIN_SAMPLES = 3;

/**
 * Minutes per group for this queue, based on how fast it actually moved in the
 * last 30 minutes. Falls back to the queue's default until there's enough data.
 */
export function minsPerGroup(queue: Queue): number {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const row = db
    .select({ n: count(), first: min(tickets.servedAt) })
    .from(tickets)
    .where(and(eq(tickets.queueId, queue.id), gt(tickets.servedAt, since)))
    .get();

  if (!row || row.n < MIN_SAMPLES || !row.first) return queue.defaultMinsPerGroup;

  const spanMins = Math.max(5, (Date.now() - row.first.getTime()) / 60000);
  const rate = row.n / spanMins; // groups per minute
  // clamp so one weird burst doesn't produce nonsense
  return Math.min(60, Math.max(0.5, 1 / rate));
}

/** "~10–15 min" style range for someone with `ahead` groups in front of them. */
export function waitRange(ahead: number, perGroup: number): { low: number; high: number } | null {
  const mid = (ahead + 1) * perGroup;
  if (mid < 2) return null; // basically now
  const round = (m: number) => (m < 10 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5);
  const low = round(mid * 0.75);
  const high = Math.max(low + 1, round(mid * 1.25));
  return { low, high };
}
