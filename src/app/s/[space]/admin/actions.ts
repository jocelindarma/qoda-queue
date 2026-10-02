"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isOwner, ownerCookie, ownerKey, setKeyCookie } from "@/lib/session";
import { addQueue, getSpace, getSpaceById } from "@/lib/spaces";
import { bustBoard } from "@/lib/tickets";
import { addQueueSchema, firstErrors } from "@/lib/validation";

async function requireOwner(slug: string) {
  const space = getSpace(slug);
  if (!space || !(await isOwner(space))) throw new Error("Not authorized");
  return space;
}

const done = (slug: string, spaceId: number) => {
  bustBoard(spaceId);
  revalidatePath(`/s/${slug}/admin`);
};

export async function setSpaceOpen(slug: string, isOpen: boolean) {
  const space = await requireOwner(slug);
  db.update(schema.spaces).set({ isOpen }).where(eq(schema.spaces.id, space.id)).run();
  done(slug, space.id);
}

export async function setMaxLines(slug: string, form: FormData) {
  const space = await requireOwner(slug);
  const n = Math.min(20, Math.max(1, Number(form.get("maxLines")) || 3));
  db.update(schema.spaces).set({ maxLinesPerGuest: n }).where(eq(schema.spaces.id, space.id)).run();
  done(slug, space.id);
}

export type AddQueueState = { errors?: Record<string, string>; ok?: number };

export async function createQueue(slug: string, prev: AddQueueState, form: FormData): Promise<AddQueueState> {
  const space = await requireOwner(slug);
  const parsed = addQueueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: firstErrors(parsed.error) };
  addQueue(space, parsed.data.name, parsed.data.defaultMinsPerGroup);
  done(slug, space.id);
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function setQueueOpenAsOwner(slug: string, queueId: number, isOpen: boolean) {
  const space = await requireOwner(slug);
  db.update(schema.queues)
    .set({ isOpen })
    .where(and(eq(schema.queues.id, queueId), eq(schema.queues.spaceId, space.id)))
    .run();
  done(slug, space.id);
}

/** Kills the old staff link for one queue (and everyone signed in with it). */
export async function regenerateStaffLink(slug: string, queueId: number) {
  const space = await requireOwner(slug);
  db.update(schema.queues)
    .set({ keyVersion: sql`${schema.queues.keyVersion} + 1` })
    .where(and(eq(schema.queues.id, queueId), eq(schema.queues.spaceId, space.id)))
    .run();
  done(slug, space.id);
}

/** Kills the old owner link everywhere, keeps this device signed in. */
export async function regenerateOwnerLink(slug: string) {
  const space = await requireOwner(slug);
  db.update(schema.spaces)
    .set({ keyVersion: sql`${schema.spaces.keyVersion} + 1` })
    .where(eq(schema.spaces.id, space.id))
    .run();
  const updated = getSpaceById(space.id)!;
  await setKeyCookie(ownerCookie(updated.id), ownerKey(updated));
  done(slug, space.id);
}

/** Renames the queue. The URL stays the same so printed QR codes keep working. */
export async function renameQueue(slug: string, queueId: number, form: FormData) {
  const space = await requireOwner(slug);
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  if (!name) return;
  db.update(schema.queues)
    .set({ name })
    .where(and(eq(schema.queues.id, queueId), eq(schema.queues.spaceId, space.id)))
    .run();
  done(slug, space.id);
}
