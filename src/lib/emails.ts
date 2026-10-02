import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Space } from "@/db/schema";
import { enqueueEmail } from "./outbox";
import { ownerKey } from "./session";
import { getTicketView, type TicketView } from "./tickets";

const MIN = 60_000;

function waitLine(v: TicketView): string {
  if (v.ahead === 0) return "You're next.";
  const groups = v.ahead === 1 ? "1 group" : `${v.ahead} groups`;
  return v.wait ? `${groups} ahead of you, about ${v.wait.low}–${v.wait.high} min.` : `${groups} ahead of you.`;
}

/** Guest email for a ticket, or null for walk-ins added by staff. */
function emailFor(token: string): { view: TicketView; to: string } | null {
  const view = getTicketView(token);
  if (!view) return null;
  const row = db
    .select({ email: schema.guests.email })
    .from(schema.tickets)
    .innerJoin(schema.guests, eq(schema.tickets.guestId, schema.guests.id))
    .where(eq(schema.tickets.publicToken, token))
    .get();
  return row ? { view, to: row.email } : null;
}

export function sendInLine(base: string, token: string): void {
  const found = emailFor(token);
  if (!found) return;
  const { view, to } = found;
  enqueueEmail({
    to,
    subject: `You're in line for ${view.queueName}: ${view.ticket}`,
    text: [
      `Hi ${view.name},`,
      ``,
      `You're in line for ${view.queueName} at ${view.spaceName}. Your number is ${view.ticket}.`,
      waitLine(view),
      ``,
      `Follow your place in line here:`,
      `${base}/t/${token}`,
      ``,
      `No need to wait at the front. We'll email you again when it's your turn.`,
    ].join("\n"),
    // only useful while they're still waiting
    expiresInMs: 120 * MIN,
  });
}

export function sendYourTurn(base: string, token: string): void {
  const found = emailFor(token);
  if (!found) return;
  const { view, to } = found;
  enqueueEmail({
    to,
    subject: `It's your turn at ${view.queueName}: ${view.ticket}`,
    text: [
      `Hi ${view.name},`,
      ``,
      `It's your turn! Head to ${view.queueName} at ${view.spaceName} and show number ${view.ticket}.`,
      ``,
      `Your ticket: ${base}/t/${token}`,
    ].join("\n"),
    // an "it's your turn" that shows up much later does more harm than good
    expiresInMs: 15 * MIN,
  });
}

export function sendOwnerWelcome(base: string, space: Space): void {
  enqueueEmail({
    to: space.ownerEmail,
    subject: `Your Qoda owner link for ${space.name}`,
    text: [
      `${space.name} is set up.`,
      ``,
      `This link opens your owner page on any device. Keep it private, anyone with it can run your queues:`,
      `${base}/k/${ownerKey(space)}`,
      ``,
      `The page with every queue, for posters and the entrance:`,
      `${base}/s/${space.slug}`,
      ``,
      `If the link ever leaks, use "Replace owner link" on the owner page. The old one stops working right away.`,
    ].join("\n"),
  });
}
