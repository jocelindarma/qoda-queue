import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Queue, Space } from "@/db/schema";
import { enqueueEmail } from "./outbox";
import { ownerKey } from "./session";
import { claimAlmostTurn, getTicketView, type TicketView } from "./tickets";

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

/** Call after the line moves (someone called, served or left). */
export function sendAlmostTurns(base: string, queue: Queue): void {
  for (const token of claimAlmostTurn(queue)) {
    const found = emailFor(token);
    if (!found) continue;
    const { view, to } = found;
    enqueueEmail({
      to,
      subject: `Almost your turn at ${view.queueName}: ${view.ticket}`,
      text: [
        `Hi ${view.name},`,
        ``,
        `Your turn at ${view.queueName} is coming up. ${waitLine(view)}`,
        `Start heading back to ${view.spaceName} so you're there when they call ${view.ticket}.`,
        ``,
        `Your ticket: ${base}/t/${token}`,
      ].join("\n"),
      expiresInMs: 20 * MIN,
    });
  }
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

/** Owner links for every space this email owns. Sends nothing if it owns none. */
export function sendOwnerRecovery(base: string, email: string): void {
  const owned = db.select().from(schema.spaces).where(eq(schema.spaces.ownerEmail, email)).all();
  if (!owned.length) return;
  const one = owned.length === 1;
  enqueueEmail({
    to: email,
    subject: one ? `Your Qoda owner link for ${owned[0].name}` : "Your Qoda owner links",
    text: [
      `Someone asked for the owner ${one ? "link" : "links"} for this email. Open ${one ? "it" : "one"} to get back into your owner page:`,
      ``,
      ...owned.flatMap((s) => [s.name, `${base}/k/${ownerKey(s)}`, ``]),
      `Keep ${one ? "it" : "them"} private, anyone with ${one ? "it" : "a link"} can run your queues.`,
      `If you didn't ask for this, you can ignore it. Nobody gets in without the link above.`,
    ].join("\n"),
    expiresInMs: 60 * MIN,
  });
}
