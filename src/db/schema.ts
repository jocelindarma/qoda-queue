import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;
const ms = (name: string) => integer(name, { mode: "timestamp_ms" });

/** Anyone running one or more queues: a restaurant, a festival, a clinic... */
export const spaces = sqliteTable("spaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
  maxLinesPerGuest: integer("max_lines_per_guest").notNull().default(3),
  // bumping this kills every owner link and session for the space
  keyVersion: integer("key_version").notNull().default(1),
  createdAt: ms("created_at").notNull().default(now),
});

/** One line with its own QR code and staff link. */
export const queues = sqliteTable(
  "queues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    spaceId: integer("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ticketPrefix: text("ticket_prefix").notNull(),
    isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
    // fallback for wait estimates until there's real data
    defaultMinsPerGroup: integer("default_mins_per_group").notNull().default(5),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: ms("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("queues_slug_uq").on(t.spaceId, t.slug)],
);

/** Someone waiting, remembered per space by a cookie. No login. */
export const guests = sqliteTable("guests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  spaceId: integer("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  createdAt: ms("created_at").notNull().default(now),
});

export const TICKET_STATUSES = ["waiting", "called", "served", "no_show", "cancelled"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** A guest's place in one queue. */
export const tickets = sqliteTable(
  "tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    queueId: integer("queue_id").notNull().references(() => queues.id, { onDelete: "cascade" }),
    // null for walk-ins added by staff
    guestId: integer("guest_id").references(() => guests.id, { onDelete: "set null" }),
    // YYYY-MM-DD in the space's timezone; numbers reset daily
    serviceDate: text("service_date").notNull(),
    ticketNumber: integer("ticket_number").notNull(),
    publicToken: text("public_token").notNull().unique(),
    name: text("name").notNull(),
    partySize: integer("party_size"),
    status: text("status", { enum: TICKET_STATUSES }).notNull().default("waiting"),
    createdAt: ms("created_at").notNull().default(now),
    calledAt: ms("called_at"),
    // when they left "waiting" (called or served directly), drives wait estimates
    servedAt: ms("served_at"),
    closedAt: ms("closed_at"),
    // "almost your turn" email went out (or wasn't needed: they joined near the front)
    almostNotifiedAt: ms("almost_notified_at"),
  },
  (t) => [
    uniqueIndex("tickets_number_uq").on(t.queueId, t.serviceDate, t.ticketNumber),
    index("tickets_queue_idx").on(t.queueId, t.status),
    index("tickets_guest_idx").on(t.guestId, t.status),
  ],
);

export const EMAIL_STATUSES = ["pending", "sending", "sent", "failed", "expired"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** Outbox. Rows are written next to the change that caused them and sent in the background. */
export const emails = sqliteTable(
  "emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    status: text("status", { enum: EMAIL_STATUSES }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    // retries back off by pushing this forward
    sendAfter: ms("send_after").notNull().default(now),
    // past this, sending is pointless ("it's your turn" an hour late)
    expiresAt: ms("expires_at"),
    sentAt: ms("sent_at"),
    createdAt: ms("created_at").notNull().default(now),
  },
  (t) => [index("emails_due_idx").on(t.status, t.sendAfter)],
);

export type Space = typeof spaces.$inferSelect;
export type Queue = typeof queues.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
