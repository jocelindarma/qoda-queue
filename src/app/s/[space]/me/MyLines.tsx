"use client";

import Link from "next/link";
import { TicketCard, useLiveTickets } from "@/components/TicketCard";
import type { TicketView } from "@/lib/tickets";

export function MyLines({ slug, initial }: { slug: string; initial: TicketView[] }) {
  const { data, refresh } = useLiveTickets(`/api/s/${slug}/me`, initial, (list) =>
    list.filter((v) => v.status === "called").map((v) => v.token),
  );

  const called = data.filter((v) => v.status === "called");
  const active = data.filter((v) => v.status === "waiting" || v.status === "called");
  const past = data.filter((v) => v.status !== "waiting" && v.status !== "called");

  return (
    <>
      {called.length > 1 && (
        <p className="panel">
          You&apos;re being called at {called.length} places at once. Go to one, and tell the other you&apos;ll be a
          few minutes. They can put you back in line.
        </p>
      )}

      {active.length === 0 ? (
        <div className="stack">
          <p className="muted">You&apos;re not in any lines right now.</p>
          <Link href={`/s/${slug}`} className="btn">
            See all queues
          </Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: 28 }}>
          {active.map((v) => (
            <TicketCard key={v.token} view={v} onChange={refresh} compact />
          ))}
          <Link href={`/s/${slug}`} className="btn btn-ghost">
            Join another line
          </Link>
        </div>
      )}

      {past.length > 0 && (
        <section className="stack">
          <h2>Earlier today</h2>
          <ul className="queue-list">
            {past.map((v) => (
              <li key={v.token} className="queue-row is-past">
                <span className="chip">{v.ticket}</span>
                <div className="who">
                  <strong>{v.queueName}</strong>
                  <p className="muted small">
                    {v.status === "served" ? "Done" : v.status === "no_show" ? "Missed" : "Left"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
