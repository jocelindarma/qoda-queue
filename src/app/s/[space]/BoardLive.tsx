"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Board } from "@/lib/tickets";
import { waitText } from "@/components/WaitText";

const POLL_MS = 10_000;

export function BoardLive({ slug, initial, tv }: { slug: string; initial: Board; tv: boolean }) {
  const [board, setBoard] = useState(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/s/${slug}/board`, { cache: "no-store" });
        if (res.ok) setBoard(await res.json());
      } catch {}
    }, POLL_MS);
    return () => clearInterval(id);
  }, [slug]);

  if (!board.isOpen) {
    return (
      <div className="panel stack">
        <h2>Queues are paused</h2>
        <p className="muted">Nobody can join right now. Check back in a bit.</p>
      </div>
    );
  }

  return (
    <ul className={tv ? "board board-tv" : "board"}>
      {board.queues.map((q) => (
        <li key={q.slug} className={q.isOpen ? "board-row" : "board-row is-paused"}>
          <span className="chip">{q.nowServing ?? `${q.prefix}-···`}</span>
          <div className="who">
            <strong>{q.name}</strong>
            <p className="muted small">
              {q.isOpen
                ? `${q.waiting} waiting. ${waitText(q.wait, q.waiting)}`
                : "Paused, not taking new people"}
            </p>
          </div>
          {!tv && q.isOpen && (
            <Link href={`/s/${slug}/q/${q.slug}`} className="btn btn-small">
              Join
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
