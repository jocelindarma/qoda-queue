"use server";

import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import type { Queue, Space } from "@/db/schema";
import { currentGuest, forgetGuest, rememberGuest } from "@/lib/session";
import { getQueue, getSpace } from "@/lib/spaces";
import { activeLineCount, activeTicketIn, joinQueue } from "@/lib/tickets";
import { firstErrors, guestSchema, quickJoinSchema } from "@/lib/validation";

export type JoinState = { errors?: Record<string, string>; values?: Record<string, string> };

function load(spaceSlug: string, queueSlug: string): { space: Space; queue: Queue } | { error: string } {
  const space = getSpace(spaceSlug);
  const queue = space && getQueue(space, queueSlug);
  if (!space || !queue) return { error: "This queue doesn't exist anymore." };
  if (!space.isOpen || !queue.isOpen) return { error: `${queue.name} isn't taking new people right now.` };
  return { space, queue };
}

/** First time at this space: collect details, remember the guest, join. */
export async function joinNew(spaceSlug: string, queueSlug: string, _: JoinState, form: FormData): Promise<JoinState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  if (raw.website) return { errors: { form: "Something went wrong. Try again." } }; // honeypot

  const ctx = load(spaceSlug, queueSlug);
  if ("error" in ctx) return { errors: { form: ctx.error } };

  const parsed = guestSchema.safeParse(raw);
  if (!parsed.success) return { errors: firstErrors(parsed.error), values: raw };

  const { name, email, phone, partySize } = parsed.data;
  const guest = db
    .insert(schema.guests)
    .values({ spaceId: ctx.space.id, name, email: email.toLowerCase(), phone: phone ?? null })
    .returning()
    .get();
  await rememberGuest(ctx.space, guest.id);

  const ticket = joinQueue(ctx.space, ctx.queue, { guestId: guest.id, name, partySize });
  // phase 4: enqueue "you're in line" email
  redirect(`/t/${ticket.publicToken}`);
}

/** Known guest: one tap. */
export async function joinKnown(spaceSlug: string, queueSlug: string, _: JoinState, form: FormData): Promise<JoinState> {
  const ctx = load(spaceSlug, queueSlug);
  if ("error" in ctx) return { errors: { form: ctx.error } };

  const guest = await currentGuest(ctx.space);
  if (!guest) return { errors: { form: "We lost your details. Reload the page and fill them in again." } };

  const existing = activeTicketIn(guest.id, ctx.queue.id);
  if (existing) redirect(`/t/${existing.publicToken}`);

  const max = ctx.space.maxLinesPerGuest;
  if (activeLineCount(guest.id) >= max) {
    return {
      errors: {
        form: `You're already in ${max} ${max === 1 ? "line" : "lines"}, the most allowed here. Leave one to join this one.`,
      },
    };
  }

  const parsed = quickJoinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: firstErrors(parsed.error) };

  const ticket = joinQueue(ctx.space, ctx.queue, { guestId: guest.id, name: guest.name, ...parsed.data });
  redirect(`/t/${ticket.publicToken}`);
}

export async function notMe(spaceSlug: string, queueSlug: string): Promise<void> {
  const space = getSpace(spaceSlug);
  if (space) await forgetGuest(space);
  redirect(`/s/${spaceSlug}/q/${queueSlug}`);
}
