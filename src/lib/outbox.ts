import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import { db, schema } from "@/db";

const { emails } = schema;

const TICK_MS = 5000;
const BATCH = 20;
const MAX_ATTEMPTS = 6;
// 30s, 1m, 2m, 4m, 8m between tries
const backoffMs = (attempts: number) => 30_000 * 2 ** (attempts - 1);

export type OutgoingEmail = { to: string; subject: string; text: string; expiresInMs?: number };

/**
 * Write an email to the outbox. Sending happens in the background, so a slow
 * or broken mail server never slows down joining or calling.
 */
export function enqueueEmail(mail: OutgoingEmail): void {
  db.insert(emails)
    .values({
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      expiresAt: mail.expiresInMs ? new Date(Date.now() + mail.expiresInMs) : null,
    })
    .run();
  startOutbox();
  // don't wait for the next tick, people are looking at their phones
  setImmediate(() => void drain());
}

// ---------- sending ----------

/** SMTP_URL, e.g. smtps://user:pass@smtp.example.com:465. Unset = print emails to the console. */
function transport(): Transporter | null {
  const g = globalThis as unknown as { __mailer?: Transporter | null };
  if (g.__mailer === undefined) g.__mailer = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return g.__mailer;
}

const from = () => process.env.MAIL_FROM ?? "Qoda <no-reply@localhost>";

async function deliver(row: typeof emails.$inferSelect): Promise<void> {
  const mailer = transport();
  if (!mailer) {
    console.log(`\n[email] to ${row.to}\nSubject: ${row.subject}\n\n${row.text}\n`);
    return;
  }
  await mailer.sendMail({ from: from(), to: row.to, subject: row.subject, text: row.text });
}

let running = false;

/** Send everything that's due. One run at a time; rows are claimed before sending. */
export async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const now = new Date();
      const due = db
        .select()
        .from(emails)
        .where(and(eq(emails.status, "pending"), lte(emails.sendAfter, now)))
        .orderBy(asc(emails.id))
        .limit(BATCH)
        .all();
      if (!due.length) return;

      for (const row of due) {
        if (row.expiresAt && row.expiresAt <= now) {
          db.update(emails).set({ status: "expired", text: "" }).where(eq(emails.id, row.id)).run();
          continue;
        }
        const claimed = db
          .update(emails)
          .set({ status: "sending", attempts: row.attempts + 1 })
          .where(and(eq(emails.id, row.id), eq(emails.status, "pending")))
          .run();
        if (!claimed.changes) continue;

        try {
          await deliver(row);
          // bodies hold ticket and owner links; don't keep them around once delivered
          db.update(emails).set({ status: "sent", sentAt: new Date(), lastError: null, text: "" }).where(eq(emails.id, row.id)).run();
        } catch (err) {
          const attempts = row.attempts + 1;
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[email] send to ${row.to} failed (try ${attempts}): ${message}`);
          db.update(emails)
            .set(
              attempts >= MAX_ATTEMPTS
                ? { status: "failed", lastError: message }
                : { status: "pending", lastError: message, sendAfter: new Date(Date.now() + backoffMs(attempts)) },
            )
            .where(eq(emails.id, row.id))
            .run();
        }
      }
    }
  } finally {
    running = false;
  }
}

/** Start the background loop once per process (survives dev hot reloads). */
export function startOutbox(): void {
  const g = globalThis as unknown as { __outbox?: NodeJS.Timeout };
  if (g.__outbox) return;
  // a crash mid-send leaves rows "sending"; try them again (may send twice, better than never)
  db.update(emails).set({ status: "pending" }).where(eq(emails.status, "sending")).run();
  g.__outbox = setInterval(() => void drain(), TICK_MS);
  g.__outbox.unref();
}
