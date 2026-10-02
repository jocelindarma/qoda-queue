import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Queue, Space } from "@/db/schema";
import { slugify } from "./tokens";

const { spaces, queues } = schema;

export function getSpace(slug: string): Space | undefined {
  return db.select().from(spaces).where(eq(spaces.slug, slug)).get();
}

export function getSpaceById(id: number): Space | undefined {
  return db.select().from(spaces).where(eq(spaces.id, id)).get();
}

export function getQueue(space: Space, slug: string): Queue | undefined {
  return db
    .select()
    .from(queues)
    .where(and(eq(queues.spaceId, space.id), eq(queues.slug, slug)))
    .get();
}

export function getQueueById(id: number): Queue | undefined {
  return db.select().from(queues).where(eq(queues.id, id)).get();
}

export function listQueues(spaceId: number): Queue[] {
  return db.select().from(queues).where(eq(queues.spaceId, spaceId)).orderBy(asc(queues.id)).all();
}

/** A, B ... Z, AA, AB ... */
export function prefixFor(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** "name", then "name-2", "name-3" ... using the given existence check */
function freeSlug(name: string, taken: (slug: string) => boolean, fallback: string): string {
  const root = slugify(name) || fallback;
  for (let i = 1; i < 1000; i++) {
    const s = i === 1 ? root : `${root}-${i}`;
    if (!taken(s)) return s;
  }
  throw new Error("No free slug");
}

export function createSpace(input: {
  name: string;
  ownerEmail: string;
  timezone: string;
  firstQueueName: string;
}): { space: Space; queue: Queue } {
  return db.transaction((tx) => {
    const slug = freeSlug(input.name, (s) => !!tx.select().from(spaces).where(eq(spaces.slug, s)).get(), "space");
    const space = tx
      .insert(spaces)
      .values({ name: input.name, slug, ownerEmail: input.ownerEmail, timezone: input.timezone })
      .returning()
      .get();
    const queue = tx
      .insert(queues)
      .values({ spaceId: space.id, name: input.firstQueueName, slug: slugify(input.firstQueueName) || "line", ticketPrefix: "A" })
      .returning()
      .get();
    return { space, queue };
  });
}

export function addQueue(space: Space, name: string, defaultMinsPerGroup = 5): Queue {
  return db.transaction((tx) => {
    const existing = tx.select({ n: count() }).from(queues).where(eq(queues.spaceId, space.id)).get()?.n ?? 0;
    const slug = freeSlug(
      name,
      (s) => !!tx.select().from(queues).where(and(eq(queues.spaceId, space.id), eq(queues.slug, s))).get(),
      "line",
    );
    return tx
      .insert(queues)
      .values({ spaceId: space.id, name, slug, ticketPrefix: prefixFor(existing), defaultMinsPerGroup })
      .returning()
      .get();
  });
}
