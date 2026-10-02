"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { TicketView } from "@/lib/tickets";
import { leaveQueue } from "@/app/t/[token]/actions";

export function TicketCard({ view, onChange, compact = false }: { view: TicketView; onChange: () => void; compact?: boolean }) {
  const active = view.status === "waiting" || view.status === "called";
  const cls = ["ticket", compact && "ticket-compact", view.status === "called" && "is-called", !active && "is-done"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className={cls} role="status" aria-live="polite">
        <p className="ticket-venue">{view.queueName}</p>
        <p className="ticket-number">{view.ticket}</p>
        {!compact && <p>{view.name}</p>}
        <div className="ticket-perf" />
        <StatusLine view={view} />
      </div>
      {view.status === "called" && !compact && (
        <p className="status-big">Head over now. They&apos;re ready for you.</p>
      )}
      {active && <LeaveButton token={view.token} onDone={onChange} />}
    </div>
  );
}

function StatusLine({ view }: { view: TicketView }) {
  let main: string;
  let sub: string | null = view.partySize ? `Group of ${view.partySize}` : null;

  switch (view.status) {
    case "waiting":
      main = view.ahead === 0 ? "You're next" : `${view.ahead} ahead of you`;
      if (view.wait) sub = [`About ${view.wait.low}–${view.wait.high} min`, sub].filter(Boolean).join(". ");
      break;
    case "called":
      main = "It's your turn";
      break;
    case "served":
      main = "Done. Thanks for waiting!";
      break;
    case "no_show":
      main = "You were called but missed it. Talk to the staff.";
      break;
    case "cancelled":
      main = "You left this line";
      break;
  }

  return (
    <div className="stack" style={{ gap: 2 }}>
      <p style={{ fontWeight: 700, fontSize: "1.2rem" }}>{main}</p>
      {sub && <p className="small">{sub}</p>}
    </div>
  );
}

function LeaveButton({ token, onDone }: { token: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button className="btn-link" style={{ justifySelf: "center" }} onClick={() => setConfirming(true)}>
        Leave this line
      </button>
    );
  }
  return (
    <div className="row" style={{ justifyContent: "center" }}>
      <span>Leave this line?</span>
      <button
        className="btn btn-small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await leaveQueue(token);
            onDone();
            setConfirming(false);
          })
        }
      >
        Yes, leave
      </button>
      <button className="btn btn-ghost btn-small" onClick={() => setConfirming(false)}>
        Stay
      </button>
    </div>
  );
}

/** Polls a URL, refreshes when the tab comes back, buzzes when anything gets called. */
export function useLiveTickets<T>(url: string, initial: T, calledTokens: (data: T) => string[], ms = 5000) {
  const [data, setData] = useState(initial);
  const seen = useRef(new Set(calledTokens(initial)));

  const refresh = async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const next: T = await res.json();
      const called = calledTokens(next);
      if (called.some((t) => !seen.current.has(t))) alertUser();
      seen.current = new Set(called);
      setData(next);
    } catch {}
  };

  useEffect(() => {
    const id = setInterval(refresh, ms);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ms]);

  return { data, refresh };
}

function alertUser() {
  navigator.vibrate?.([300, 150, 300, 150, 600]);
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // audio is blocked until the person has tapped the page
  }
}
