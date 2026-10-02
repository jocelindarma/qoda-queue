import "server-only";
import { and, asc, count, desc, eq, inArray, lt, max, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Guest, Queue, Space, Ticket, TicketStatus } from "@/db/schema";
import { minsPerGroup, waitRange } from "./estimate";
import { getQueueById, getSpaceById, listQueues } from "./spaces";
import { formatTicket, serviceDate } from "./time";
import { randomToken } from "./tokens";

const { tickets } = schema;
const ACTIVE: TicketStatus[] = ["waiting", "called"];

// ---------- joining ----------

export function joinQueue(
  space: Space,
  queue: Queue,
  input: { guestId?: number; name: string; partySize?: number },
): Ticket {
  const date = serviceDate(space.timezone);
  const ticket = db.transaction((tx) => {
    // synchronous + serialized by better-sqlite3, so numbers never collide
    const last = tx
      .select({ n: max(tickets.ticketNumber) })
      .from(tickets)
      .where(and(eq(tickets.queueId, queue.id), eq(tickets.serviceDate, date)))
      .get()?.n;

    return tx
      .insert(tickets)
      .values({
        queueId: queue.id,
        guestId: input.guestId ?? null,
        serviceDate: date,
        ticketNumber: (last ?? 0) + 1,
        publicToken: randomToken(18),
        name: input.name,
        partySize: input.partySize ?? null,
      })
      .returning()
      .get();
  });
  bustBoard(space.id);
  return ticket;
}

export function activeTicketIn(guestId: number, queueId: number): Ticket | undefined {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.guestId, guestId), eq(tickets.queueId, queueId), inArray(tickets.status, ACTIVE)))
    .get();
}

export function activeLineCount(guestId: number): number {
  return (
    db
      .select({ n: count() })
      .from(tickets)
      .where(and(eq(tickets.guestId, guestId), inArray(tickets.status, ACTIVE)))
      .get()?.n ?? 0
  );
}

function groupsAhead(t: Ticket): number {
  return (
    db
      .select({ n: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.queueId, t.queueId),
          eq(tickets.serviceDate, t.serviceDate),
          eq(tickets.status, "waiting"),
          lt(tickets.id, t.id),
        ),
      )
      .get()?.n ?? 0
  );
}

// ---------- guest-facing views ----------

export type TicketView = {
  token: string;
  spaceName: string;
  spaceSlug: string;
  queueName: string;
  ticket: string;
  name: string;
  partySize: number | null;
  status: TicketStatus;
  ahead: number;
  wait: { low: number; high: number } | null;
  calledAt: number | null;
};

function toView(t: Ticket, queue: Queue, space: Space): TicketView {
  const waiting = t.status === "waiting";
  const ahead = waiting ? groupsAhead(t) : 0;
  return {
    token: t.publicToken,
    spaceName: space.name,
    spaceSlug: space.slug,
    queueName: queue.name,
    ticket: formatTicket(queue.ticketPrefix, t.ticketNumber),
    name: t.name,
    partySize: t.partySize,
    status: t.status,
    ahead,
    wait: waiting ? waitRange(ahead, minsPerGroup(queue)) : null,
    calledAt: t.calledAt?.getTime() ?? null,
  };
}

export function getTicketView(token: string): TicketView | null {
  const t = db.select().from(tickets).where(eq(tickets.publicToken, token)).get();
  if (!t) return null;
  const queue = getQueueById(t.queueId);
  const space = queue && getSpaceById(queue.spaceId);
  return queue && space ? toView(t, queue, space) : null;
}

/** Everything a guest is (or was today) lined up for, active ones first. */
export function guestTickets(space: Space, guest: Guest): TicketView[] {
  const date = serviceDate(space.timezone);
  const rows = db
    .select()
    .from(tickets)
    .where(and(eq(tickets.guestId, guest.id), eq(tickets.serviceDate, date)))
    .orderBy(sql`case ${tickets.status} when 'called' then 0 when 'waiting' then 1 else 2 end`, asc(tickets.id))
    .all();

  const queues = new Map(listQueues(space.id).map((q) => [q.id, q]));
  return rows.flatMap((t) => {
    const q = queues.get(t.queueId);
    return q ? [toView(t, q, space)] : [];
  });
}

export function cancelByToken(token: string): boolean {
  const t = db.select().from(tickets).where(eq(tickets.publicToken, token)).get();
  if (!t) return false;
  const res = db
    .update(tickets)
    .set({ status: "cancelled", closedAt: new Date() })
    .where(and(eq(tickets.id, t.id), inArray(tickets.status, ACTIVE)))
    .run();
  const q = getQueueById(t.queueId);
  if (q) bustBoard(q.spaceId);
  return res.changes > 0;
}

// ---------- staff ----------

export type StaffTicket = {
  id: number;
  ticket: string;
  name: string;
  email: string | null;
  phone: string | null;
  partySize: number | null;
  status: TicketStatus;
  createdAt: number;
  calledAt: number | null;
};

export type StaffView = {
  isOpen: boolean;
  spaceOpen: boolean;
  active: StaffTicket[];
  recent: StaffTicket[];
  servedToday: number;
  minsPerGroup: number;
};

export function getStaffView(space: Space, queue: Queue): StaffView {
  const date = serviceDate(space.timezone);
  const scope = and(eq(tickets.queueId, queue.id), eq(tickets.serviceDate, date));

  const select = () =>
    db
      .select({ t: tickets, email: schema.guests.email, phone: schema.guests.phone })
      .from(tickets)
      .leftJoin(schema.guests, eq(tickets.guestId, schema.guests.id));

  const view = (r: { t: Ticket; email: string | null; phone: string | null }): StaffTicket => ({
    id: r.t.id,
    ticket: formatTicket(queue.ticketPrefix, r.t.ticketNumber),
    name: r.t.name,
    email: r.email,
    phone: r.phone,
    partySize: r.t.partySize,
    status: r.t.status,
    createdAt: r.t.createdAt.getTime(),
    calledAt: r.t.calledAt?.getTime() ?? null,
  });

  const active = select()
    .where(and(scope, inArray(tickets.status, ACTIVE)))
    .orderBy(sql`case ${tickets.status} when 'called' then 0 else 1 end`, asc(tickets.id))
    .all();

  const recent = select()
    .where(and(scope, inArray(tickets.status, ["served", "no_show", "cancelled"])))
    .orderBy(desc(tickets.closedAt))
    .limit(20)
    .all();

  const served =
    db
      .select({ n: count() })
      .from(tickets)
      .where(and(scope, eq(tickets.status, "served")))
      .get()?.n ?? 0;

  return {
    isOpen: queue.isOpen,
    spaceOpen: space.isOpen,
    active: active.map(view),
    recent: recent.map(view),
    servedToday: served,
    minsPerGroup: Math.round(minsPerGroup(queue) * 10) / 10,
  };
}

export type StaffAction = "call" | "serve" | "no_show" | "requeue";

const transitions: Record<StaffAction, { from: TicketStatus[]; to: TicketStatus }> = {
  call: { from: ["waiting"], to: "called" },
  serve: { from: ["waiting", "called"], to: "served" },
  no_show: { from: ["called"], to: "no_show" },
  requeue: { from: ["called", "no_show"], to: "waiting" },
};

export function applyStaffAction(queue: Queue, ticketId: number, action: StaffAction): boolean {
  const t = transitions[action];
  const current = db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.queueId, queue.id)))
    .get();
  if (!current || !t.from.includes(current.status)) return false;

  const now = new Date();
  const patch: Partial<Ticket> = { status: t.to };
  if (current.status === "waiting") patch.servedAt = now; // left the line, counts toward pace
  if (t.to === "called") patch.calledAt = now;
  if (t.to === "served" || t.to === "no_show") patch.closedAt = now;
  if (t.to === "waiting") Object.assign(patch, { calledAt: null, servedAt: null, closedAt: null });

  db.update(tickets).set(patch).where(eq(tickets.id, ticketId)).run();
  bustBoard(queue.spaceId);
  // phase 4: on "call", enqueue the "it's your turn" email here
  return true;
}

// ---------- public board (cached, it gets polled a lot) ----------

export type BoardQueue = {
  name: string;
  slug: string;
  prefix: string;
  isOpen: boolean;
  waiting: number;
  wait: { low: number; high: number } | null; // for someone joining now
  nowServing: string | null;
};

export type Board = { spaceName: string; isOpen: boolean; queues: BoardQueue[] };

const boardCache = new Map<number, { at: number; board: Board }>();
const BOARD_TTL_MS = 1000;

export function bustBoard(spaceId: number) {
  boardCache.delete(spaceId);
}

export function getBoard(space: Space): Board {
  const hit = boardCache.get(space.id);
  if (hit && Date.now() - hit.at < BOARD_TTL_MS) return hit.board;

  const date = serviceDate(space.timezone);
  const queues = listQueues(space.id);

  const board: Board = {
    spaceName: space.name,
    isOpen: space.isOpen,
    queues: queues.map((q) => {
      const waiting =
        db
          .select({ n: count() })
          .from(tickets)
          .where(and(eq(tickets.queueId, q.id), eq(tickets.serviceDate, date), eq(tickets.status, "waiting")))
          .get()?.n ?? 0;
      const lastCalled = db
        .select({ n: tickets.ticketNumber })
        .from(tickets)
        .where(and(eq(tickets.queueId, q.id), eq(tickets.serviceDate, date), eq(tickets.status, "called")))
        .orderBy(desc(tickets.calledAt))
        .get();

      return {
        name: q.name,
        slug: q.slug,
        prefix: q.ticketPrefix,
        isOpen: q.isOpen && space.isOpen,
        waiting,
        wait: waitRange(waiting, minsPerGroup(q)),
        nowServing: lastCalled ? formatTicket(q.ticketPrefix, lastCalled.n) : null,
      };
    }),
  };

  boardCache.set(space.id, { at: Date.now(), board });
  return board;
}
