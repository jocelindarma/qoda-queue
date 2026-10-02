"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendAlmostTurns, sendYourTurn } from "@/lib/emails";
import { canStaff, clearCookie, staffCookie } from "@/lib/session";
import { getQueue, getSpace } from "@/lib/spaces";
import { applyStaffAction, bustBoard, joinQueue, type StaffAction } from "@/lib/tickets";
import { baseUrl } from "@/lib/url";
import { firstErrors, walkInSchema } from "@/lib/validation";

async function requireStaff(spaceSlug: string, queueSlug: string) {
  const space = getSpace(spaceSlug);
  const queue = space && getQueue(space, queueSlug);
  if (!space || !queue || !(await canStaff(space, queue))) throw new Error("Not authorized");
  return { space, queue };
}

export async function updateTicket(spaceSlug: string, queueSlug: string, ticketId: number, action: StaffAction) {
  const { queue } = await requireStaff(spaceSlug, queueSlug);
  const ok = applyStaffAction(queue, ticketId, action);
  if (!ok) return ok;
  const base = await baseUrl();
  if (action === "call") {
    const t = db
      .select({ token: schema.tickets.publicToken })
      .from(schema.tickets)
      .where(and(eq(schema.tickets.id, ticketId), eq(schema.tickets.queueId, queue.id)))
      .get();
    if (t) sendYourTurn(base, t.token);
  }
  sendAlmostTurns(base, queue);
  return ok;
}

export async function setQueueOpen(spaceSlug: string, queueSlug: string, isOpen: boolean) {
  const { queue } = await requireStaff(spaceSlug, queueSlug);
  db.update(schema.queues).set({ isOpen }).where(eq(schema.queues.id, queue.id)).run();
  bustBoard(queue.spaceId);
}

export type WalkInState = { errors?: Record<string, string>; ok?: number };

export async function addWalkIn(spaceSlug: string, queueSlug: string, prev: WalkInState, form: FormData): Promise<WalkInState> {
  const { space, queue } = await requireStaff(spaceSlug, queueSlug);
  const parsed = walkInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: firstErrors(parsed.error) };
  joinQueue(space, queue, parsed.data);
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function logoutStaff(spaceSlug: string, queueSlug: string) {
  const space = getSpace(spaceSlug);
  const queue = space && getQueue(space, queueSlug);
  if (queue) await clearCookie(staffCookie(queue.id));
  redirect(`/s/${spaceSlug}/q/${queueSlug}/staff`);
}
