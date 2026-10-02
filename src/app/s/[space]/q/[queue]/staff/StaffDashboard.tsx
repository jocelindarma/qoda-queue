"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { StaffAction, StaffTicket, StaffView } from "@/lib/tickets";
import { CopyButton } from "@/components/CopyButton";
import { addWalkIn, logoutStaff, setQueueOpen, updateTicket, type WalkInState } from "./actions";

const POLL_MS = 4000;

type Props = {
  space: { slug: string; name: string };
  queue: { slug: string; name: string };
  joinUrl: string;
  qrDataUrl: string;
  initial: StaffView;
  isOwner: boolean;
};

export function StaffDashboard({ space, queue, joinUrl, qrDataUrl, initial, isOwner }: Props) {
  const [view, setView] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, start] = useTransition();
  const now = useNow(30_000);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/s/${space.slug}/q/${queue.slug}/staff`, { cache: "no-store" });
      if (res.status === 401) return window.location.reload(); // link was regenerated
      if (res.ok) setView(await res.json());
    } catch {}
  }, [space.slug, queue.slug]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const act = (id: number, action: StaffAction) => {
    setBusyId(id);
    start(async () => {
      await updateTicket(space.slug, queue.slug, id, action);
      await refresh();
      setBusyId(null);
    });
  };

  const waiting = view.active.filter((t) => t.status === "waiting").length;

  return (
    <main className="wide">
      <header className="row spread">
        <div className="stack" style={{ gap: 4 }}>
          <p className="muted">
            {isOwner ? <Link href={`/s/${space.slug}/admin`}>{space.name}</Link> : space.name}
          </p>
          <h1>{queue.name}</h1>
          <p className="muted">
            {waiting} waiting, {view.servedToday} done today, about {view.minsPerGroup} min per group
          </p>
        </div>
        <button
          className={`btn ${view.isOpen ? "btn-ghost" : "toggle-closed"}`}
          onClick={() =>
            start(async () => {
              await setQueueOpen(space.slug, queue.slug, !view.isOpen);
              await refresh();
            })
          }
        >
          {view.isOpen ? "Pause new joins" : "Paused. Resume joins"}
        </button>
      </header>

      {!view.spaceOpen && (
        <p className="panel">The whole space is paused by the owner, so nobody can join any line right now.</p>
      )}

      <section className="stack">
        <h2>Line</h2>
        {view.active.length === 0 ? (
          <p className="muted">Nobody in line. People show up here as soon as they join.</p>
        ) : (
          <ul className="queue-list">
            {view.active.map((t) => (
              <Row key={t.id} t={t} now={now} busy={busyId === t.id} onAction={act} />
            ))}
          </ul>
        )}
        <WalkInForm space={space.slug} queue={queue.slug} onAdded={refresh} />
      </section>

      <section className="panel row" style={{ alignItems: "flex-start", gap: 24 }}>
        <div className="qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code that opens ${joinUrl}`} />
        </div>
        <div className="stack" style={{ flex: 1, minWidth: 220 }}>
          <h2>QR code for this line</h2>
          <p className="muted small">Print it and put it where people can see it.</p>
          <p className="copy">{joinUrl}</p>
          <div className="row">
            <a className="btn btn-small" href={qrDataUrl} download={`${queue.slug}-qr.png`}>
              Download QR
            </a>
            <CopyButton text={joinUrl} label="Copy link" />
          </div>
        </div>
      </section>

      {view.recent.length > 0 && (
        <section className="stack">
          <h2>Earlier today</h2>
          <ul className="queue-list">
            {view.recent.map((t) => (
              <Row key={t.id} t={t} now={now} busy={busyId === t.id} onAction={act} />
            ))}
          </ul>
        </section>
      )}

      {!isOwner && (
        <form action={logoutStaff.bind(null, space.slug, queue.slug)}>
          <button className="btn-link">Sign out of this device</button>
        </form>
      )}
    </main>
  );
}

function Row({ t, now, busy, onAction }: { t: StaffTicket; now: number; busy: boolean; onAction: (id: number, a: StaffAction) => void }) {
  const past = t.status !== "waiting" && t.status !== "called";
  const cls = ["queue-row", t.status === "called" && "is-called", past && "is-past"].filter(Boolean).join(" ");
  const details = [t.partySize ? `${t.partySize} ${t.partySize === 1 ? "person" : "people"}` : null, t.email]
    .filter(Boolean)
    .join(", ");

  const btn = (label: string, action: StaffAction, style = "btn-ghost") => (
    <button className={`btn btn-small ${style}`} disabled={busy} onClick={() => onAction(t.id, action)}>
      {label}
    </button>
  );

  return (
    <li className={cls}>
      <span className="chip">{t.ticket}</span>
      <div className="who">
        <div className="row" style={{ gap: 8 }}>
          <strong>{t.name}</strong>
          {t.status === "called" && t.calledAt && <span className="badge badge-go">Called {ago(t.calledAt, now)}</span>}
          {t.status === "served" && <span className="badge">Done</span>}
          {t.status === "no_show" && <span className="badge">No-show</span>}
          {t.status === "cancelled" && <span className="badge">Left</span>}
        </div>
        {(details || t.phone) && (
          <p className="muted small">
            {details}
            {t.phone && (
              <>
                {details && ", "}
                <a href={`tel:${t.phone}`}>{t.phone}</a>
              </>
            )}
          </p>
        )}
        {t.status === "waiting" && <p className="muted small">Waiting {ago(t.createdAt, now, true)}</p>}
      </div>
      <div className="actions">
        {t.status === "waiting" && (
          <>
            {btn("Call", "call", "")}
            {btn("Done", "serve")}
          </>
        )}
        {t.status === "called" && (
          <>
            {btn("Done", "serve", "btn-go")}
            {btn("No-show", "no_show")}
            {btn("Back to line", "requeue")}
          </>
        )}
        {t.status === "no_show" && btn("Back to line", "requeue")}
      </div>
    </li>
  );
}

function WalkInForm({ space, queue, onAdded }: { space: string; queue: string; onAdded: () => void }) {
  const [state, action, pending] = useActionState<WalkInState, FormData>(addWalkIn.bind(null, space, queue), {});
  const ref = useRef<HTMLFormElement>(null);
  const handled = useRef(0);

  useEffect(() => {
    if (state.ok && state.ok !== handled.current) {
      handled.current = state.ok;
      ref.current?.reset();
      onAdded();
    }
  }, [state.ok, onAdded]);

  return (
    <form ref={ref} action={action} className="row" style={{ alignItems: "flex-end" }}>
      <div className="field" style={{ flex: "2 1 180px" }}>
        <label htmlFor="walkin-name">Add someone without a phone</label>
        <input id="walkin-name" name="name" className="input" placeholder="Name" required />
      </div>
      <div className="field" style={{ flex: "1 1 90px" }}>
        <label htmlFor="walkin-size">People</label>
        <input id="walkin-size" name="partySize" type="number" min={1} max={50} className="input" inputMode="numeric" />
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Adding…" : "Add to line"}
      </button>
      {state.errors && <p className="error" style={{ width: "100%" }}>{Object.values(state.errors)[0]}</p>}
    </form>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function ago(ts: number, now: number, bare = false) {
  const mins = Math.max(0, Math.floor((now - ts) / 60000));
  if (mins < 1) return bare ? "under a minute" : "just now";
  const h = Math.floor(mins / 60);
  const span = h > 0 ? `${h}h ${mins % 60}m` : `${mins} min`;
  return bare ? span : `${span} ago`;
}
