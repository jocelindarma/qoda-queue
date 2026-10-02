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
/recover                         email an owner their link again
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

### Email

All plain text:

- **You're in line**: right after joining, with the ticket number and a link back to the ticket page
- **Almost your turn**: once 2 or fewer groups are ahead (skipped if they joined that close to the front)
- **It's your turn**: when staff press Call
- **Owner link**: when a space is created, and again from `/recover`

`/recover` answers the same way whether or not the email owns a space, sends at most one email per
address every 5 minutes, and allows 5 tries per IP every 15 minutes.

Nothing is sent inline. Each email is written to the `emails` table (an outbox) and a background
loop in the same process sends it, so a slow or broken mail server never slows down joining or
calling. Failed sends retry with backoff (30s, 1m, 2m, 4m, 8m), then give up. "It's your turn"
expires after 15 minutes, "almost your turn" after 20 and "you're in line" after 2 hours, since a late one is worse than none.
Bodies are cleared once sent, so the database doesn't keep ticket or owner links.

Set `SMTP_URL` and `MAIL_FROM` to send for real (any provider with SMTP works: Resend, Postmark,
SES, Mailgun...). Without `SMTP_URL`, emails are printed to the terminal. To see them as real
emails locally, run [Mailpit](https://mailpit.axllent.org) and set `SMTP_URL=smtp://localhost:1025`.

For real sending, verify your domain with the provider (SPF and DKIM DNS records), or most emails
land in spam.

### Live updates

Polling for now: tickets every 5s, staff every 4s, board every 10s. The board is cached for
1s per space so heavy polling stays cheap.

## Deploy

Needs a persistent disk, so no serverless. Docker on any small VM works:

```bash
docker build -t qoda .
docker run -d -p 3000:3000 -v qoda-data:/data -e APP_URL=https://your-domain \
  -e SMTP_URL=smtps://user:password@smtp.example.com:465 -e MAIL_FROM="Qoda <queue@your-domain>" qoda
```

Put Caddy or another HTTPS proxy in front. Cookies are `secure` in production.

## Not done yet

- SSE instead of polling
- Rate limiting on join, PII cleanup job
