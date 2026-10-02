import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Guest, Queue, Space } from "@/db/schema";
import { makeGuestToken, makeKey, parseGuestToken, parseKey } from "./keys";

const MONTH = 60 * 60 * 24 * 30;
const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const ownerCookie = (spaceId: number) => `qoda_s${spaceId}`;
export const staffCookie = (queueId: number) => `qoda_q${queueId}`;
const guestCookie = (spaceId: number) => `qoda_g${spaceId}`;

async function readKey(name: string) {
  const raw = (await cookies()).get(name)?.value;
  return raw ? parseKey(raw) : null;
}

export async function isOwner(space: Space): Promise<boolean> {
  const k = await readKey(ownerCookie(space.id));
  return !!k && k.scope === "s" && k.id === space.id && k.version === space.keyVersion;
}

/** Owners can run every queue in their space; staff links cover one queue. */
export async function canStaff(space: Space, queue: Queue): Promise<boolean> {
  if (await isOwner(space)) return true;
  const k = await readKey(staffCookie(queue.id));
  return !!k && k.scope === "q" && k.id === queue.id && k.version === queue.keyVersion;
}

/** Only callable from route handlers / server actions (cookies are writable there). */
export async function setKeyCookie(name: string, token: string) {
  (await cookies()).set(name, token, { ...base, maxAge: MONTH });
}

export async function clearCookie(name: string) {
  (await cookies()).delete(name);
}

export const ownerKey = (space: Space) => makeKey("s", space.id, space.keyVersion);
export const staffKey = (queue: Queue) => makeKey("q", queue.id, queue.keyVersion);

export async function currentGuest(space: Space): Promise<Guest | null> {
  const raw = (await cookies()).get(guestCookie(space.id))?.value;
  const id = raw ? parseGuestToken(raw) : null;
  if (!id) return null;
  return (
    db
      .select()
      .from(schema.guests)
      .where(and(eq(schema.guests.id, id), eq(schema.guests.spaceId, space.id)))
      .get() ?? null
  );
}

export async function rememberGuest(space: Space, guestId: number) {
  (await cookies()).set(guestCookie(space.id), makeGuestToken(guestId), { ...base, maxAge: MONTH * 3 });
}

export async function forgetGuest(space: Space) {
  (await cookies()).delete(guestCookie(space.id));
}
