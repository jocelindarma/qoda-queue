import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Staff links, owner links and guest cookies are all signed tokens:
 *
 *   s7.2.<sig>   owner of space 7, key version 2
 *   q12.1.<sig>  staff of queue 12, key version 1
 *   g40.<sig>    guest 40
 *
 * Nothing is stored per link. Verifying = recomputing the HMAC. Regenerating a
 * link = bumping key_version, which invalidates every old link and cookie.
 * Because links can be recomputed, owners can always see them again.
 */

let cached: Buffer | undefined;

/** QODA_SECRET, or a secret auto-created next to the database (zero setup). */
function secret(): Buffer {
  if (cached) return cached;
  if (process.env.QODA_SECRET) return (cached = Buffer.from(process.env.QODA_SECRET));

  const dbPath = process.env.DB_PATH ?? "./data/qoda.db";
  const file = path.join(path.dirname(dbPath), "secret.key");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  return (cached = Buffer.from(fs.readFileSync(file, "utf8").trim()));
}

function sign(payload: string): string {
  // 16 bytes = 128 bits, plenty for an unguessable link
  return crypto.createHmac("sha256", secret()).update(payload).digest().subarray(0, 16).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export type KeyScope = "s" | "q";

export function makeKey(scope: KeyScope, id: number, version: number): string {
  const payload = `${scope}${id}.${version}`;
  return `${payload}.${sign(payload)}`;
}

export function parseKey(token: string): { scope: KeyScope; id: number; version: number } | null {
  const m = /^([sq])(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!m) return null;
  const [, scope, id, version, sig] = m;
  if (!safeEqual(sig, sign(`${scope}${id}.${version}`))) return null;
  return { scope: scope as KeyScope, id: Number(id), version: Number(version) };
}

export function makeGuestToken(guestId: number): string {
  return `g${guestId}.${sign(`g${guestId}`)}`;
}

export function parseGuestToken(token: string): number | null {
  const m = /^g(\d+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!m || !safeEqual(m[2], sign(`g${m[1]}`))) return null;
  return Number(m[1]);
}
