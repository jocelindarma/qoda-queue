"use client";

import Link from "next/link";
import { TicketCard, useLiveTickets } from "@/components/TicketCard";
import type { TicketView } from "@/lib/tickets";

export function TicketLive({ initial, showMyLines }: { initial: TicketView; showMyLines: boolean }) {
  const { data: view, refresh } = useLiveTickets(`/api/tickets/${initial.token}`, initial, (v) =>
    v.status === "called" ? [v.token] : [],
  );

  return (
    <>
      <p className="muted" style={{ textAlign: "center" }}>
        {view.spaceName}
      </p>
      <TicketCard view={view} onChange={refresh} />
      {view.status === "waiting" && (
        <p className="muted small" style={{ textAlign: "center" }}>
          Keep this page open or bookmark it. It updates by itself and buzzes when it&apos;s your turn.
        </p>
      )}
      {showMyLines && (
        <Link href={`/s/${view.spaceSlug}/me`} className="btn btn-ghost">
          See all my lines
        </Link>
      )}
    </>
  );
}
