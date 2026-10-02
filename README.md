# Qoda

Zero-setup queues. People scan a QR code, get a ticket number, and wait wherever they like.
Works for one line (a restaurant) or many (booths at an event).

Next.js 16 + SQLite (better-sqlite3 + Drizzle). One process, one database file, no accounts.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/new`, create a space, and you land on the owner page. The database and a signing
secret are created in `./data` on first run.

## How it fits together

| Thing  | What it is |
| ------ | ---------- |
| Space  | Anyone running queues: a shop, an event, an office |
| Queue  | One line, with its own QR code and staff link. Ticket prefix A, B, C... |
| Guest  | Someone waiting. Remembered per space by a cookie, no login |
| Ticket | A guest's place in one queue. Numbers reset daily |

### URLs

```
/s/{space}                       all queues + wait times (skips to join page if only one queue)
/s/{space}?tv=1                  big-screen view
/s/{space}/q/{queue}             join page (what each QR points to)
/s/{space}/me                    guest's "My lines"
/t/{ticket}                      one ticket, live
/s/{space}/admin                 owner page
/s/{space}/q/{queue}/staff       staff page for one queue
/k/{key}                         owner/staff links: sets a cookie, redirects to the clean URL
```

### Access: secret links, no passwords

Owner and staff links are signed tokens (`s7.2.<hmac>`, `q12.1.<hmac>`), not stored rows.
Opening one sets a 30-day cookie and redirects so the key leaves the address bar.
"Replace link" bumps `key_version`, which kills the old link and every cookie made from it.
Because links are recomputable, the owner page can always show them again.

Signing secret: `QODA_SECRET` if set, otherwise auto-generated in `data/secret.key`.
Keep it out of git and back it up with the DB. Losing it invalidates every link.

### Wait estimates

Minutes per group = pace over the last 30 minutes (needs 3+ people served), otherwise the
queue's default. Shown as a range, never an exact number.

### Live updates

Polling for now: tickets every 5s, staff every 4s, board every 10s. The board is cached for
1s per space so heavy polling stays cheap.

## Deploy

Needs a persistent disk, so no serverless. Docker on any small VM works:

```bash
docker build -t qoda .
docker run -d -p 3000:3000 -v qoda-data:/data -e APP_URL=https://your-domain qoda
```

Put Caddy or another HTTPS proxy in front. Cookies are `secure` in production.

## Not done yet

- Email: "you're in line" and "it's your turn" (outbox + SMTP via nodemailer)
- "Email me my owner link" recovery
- SSE instead of polling
- Rate limiting on join, PII cleanup job
