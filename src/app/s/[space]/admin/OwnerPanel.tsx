"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Board } from "@/lib/tickets";
import { CopyButton } from "@/components/CopyButton";
import { waitText } from "@/components/WaitText";
import {
  createQueue,
  regenerateOwnerLink,
  regenerateStaffLink,
  renameQueue,
  setMaxLines,
  setQueueOpenAsOwner,
  setSpaceOpen,
  type AddQueueState,
} from "./actions";

export type AdminQueue = {
  id: number;
  name: string;
  slug: string;
  prefix: string;
  isOpen: boolean;
  joinUrl: string;
  staffUrl: string;
  qrDataUrl: string;
};

type Props = {
  space: { slug: string; name: string; isOpen: boolean; maxLinesPerGuest: number };
  boardUrl: string;
  boardQr: string;
  ownerUrl: string;
  queues: AdminQueue[];
  initialBoard: Board;
  welcome: boolean;
};

export function OwnerPanel({ space, boardUrl, boardQr, ownerUrl, queues, initialBoard, welcome }: Props) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [pending, start] = useTransition();

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/s/${space.slug}/board`, { cache: "no-store" });
      if (res.ok) setBoard(await res.json());
    } catch {}
  }, [space.slug]);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
      await loadBoard();
    });

  useEffect(() => {
    const id = setInterval(loadBoard, 5000);
    return () => clearInterval(id);
  }, [loadBoard]);

  const live = new Map(board.queues.map((q) => [q.slug, q]));
  const multi = queues.length > 1;

  return (
    <main className="wide">
      <header className="row spread">
        <div className="stack" style={{ gap: 4 }}>
          <p className="muted">Owner</p>
          <h1>{space.name}</h1>
        </div>
        <button
          className={`btn ${space.isOpen ? "btn-ghost" : "toggle-closed"}`}
          disabled={pending}
          onClick={() => run(() => setSpaceOpen(space.slug, !space.isOpen))}
        >
          {space.isOpen ? "Pause every line" : "Everything paused. Resume"}
        </button>
      </header>

      {welcome && (
        <div className="panel stack">
          <h2>You&apos;re set up</h2>
          <p>
            Save your owner link below somewhere safe, like a password manager or a message to yourself. It&apos;s
            the only way back into this page on another device. Then send each queue&apos;s staff link to whoever
            runs that line.
          </p>
        </div>
      )}

      <section className="stack">
        <h2>Queues</h2>
        <ul className="queue-list">
          {queues.map((q) => {
            const info = live.get(q.slug);
            return (
              <li key={q.id} className="admin-queue">
                <div className="row spread">
                  <div className="row" style={{ gap: 12 }}>
                    <span className="chip">{q.prefix}</span>
                    <div className="who">
                      <strong>{q.name}</strong>
                      <p className="muted small">
                        {!q.isOpen
                          ? "Paused"
                          : info
                            ? `${info.waiting} waiting. ${waitText(info.wait, info.waiting)}`
                            : ""}
                        {info?.nowServing ? `. Now serving ${info.nowServing}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="actions">
                    <Link className="btn btn-small" href={`/s/${space.slug}/q/${q.slug}/staff`}>
                      Open line
                    </Link>
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={pending}
                      onClick={() => run(() => setQueueOpenAsOwner(space.slug, q.id, !q.isOpen))}
                    >
                      {q.isOpen ? "Pause" : "Resume"}
                    </button>
                  </div>
                </div>
                <details>
                  <summary>Links and QR code</summary>
                  <div className="row" style={{ alignItems: "flex-start", gap: 20, marginTop: 12 }}>
                    <div className="qr qr-small">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.qrDataUrl} alt={`QR code for ${q.name}`} />
                    </div>
                    <div className="stack" style={{ flex: 1, minWidth: 220, gap: 10 }}>
                      <form action={(f) => run(() => renameQueue(space.slug, q.id, f))} className="row">
                        <input name="name" defaultValue={q.name} aria-label="Queue name" className="input" style={{ flex: 1, minWidth: 160, padding: "8px 12px" }} />
                        <button className="btn btn-ghost btn-small" disabled={pending}>
                          Rename
                        </button>
                      </form>
                      <div className="row">
                        <a className="btn btn-small" href={q.qrDataUrl} download={`${q.slug}-qr.png`}>
                          Download QR
                        </a>
                        <CopyButton text={q.joinUrl} label="Copy join link" />
                      </div>
                      <div className="stack" style={{ gap: 6 }}>
                        <p className="small">
                          <strong>Staff link.</strong> Anyone with it can run this line.
                        </p>
                        <p className="copy">{q.staffUrl}</p>
                        <div className="row">
                          <CopyButton text={q.staffUrl} label="Copy staff link" />
                          <ConfirmButton
                            label="Replace staff link"
                            confirm="The current link stops working for everyone. Replace it?"
                            onConfirm={() => run(() => regenerateStaffLink(space.slug, q.id))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        <AddQueueForm slug={space.slug} onAdded={() => { router.refresh(); loadBoard(); }} />
      </section>

      <section className="panel row" style={{ alignItems: "flex-start", gap: 24 }}>
        <div className="qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={boardQr} alt={`QR code that opens ${boardUrl}`} />
        </div>
        <div className="stack" style={{ flex: 1, minWidth: 220 }}>
          <h2>{multi ? "Page with every queue" : "Public page"}</h2>
          <p className="muted small">
            {multi
              ? "One QR for entrances and posters. People see all the lines and wait times, then pick one."
              : "Add a second queue and this becomes a page listing every line."}
          </p>
          <p className="copy">{boardUrl}</p>
          <div className="row">
            <a className="btn btn-small" href={boardQr} download={`${space.slug}-qr.png`}>
              Download QR
            </a>
            <CopyButton text={boardUrl} label="Copy link" />
            {multi && (
              <a className="btn btn-ghost btn-small" href={`${boardUrl}?tv=1`} target="_blank" rel="noreferrer">
                Open screen view
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>Settings</h2>
        <form action={(f) => run(() => setMaxLines(space.slug, f))} className="row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="maxLines">Lines one person can be in at once</label>
            <input id="maxLines" name="maxLines" type="number" min={1} max={20} defaultValue={space.maxLinesPerGuest} className="input" style={{ width: 120 }} />
          </div>
          <button className="btn btn-ghost" disabled={pending}>
            Save
          </button>
        </form>

        <div className="panel stack" style={{ gap: 10 }}>
          <p>
            <strong>Owner link.</strong> Opens this page. Keep it private.
          </p>
          <p className="copy">{ownerUrl}</p>
          <div className="row">
            <CopyButton text={ownerUrl} label="Copy owner link" />
            <ConfirmButton
              label="Replace owner link"
              confirm="The current owner link stops working everywhere except this device. Replace it?"
              onConfirm={() => run(() => regenerateOwnerLink(space.slug))}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function AddQueueForm({ slug, onAdded }: { slug: string; onAdded: () => void }) {
  const [state, action, pending] = useActionState<AddQueueState, FormData>(createQueue.bind(null, slug), {});
  const ref = useRef<HTMLFormElement>(null);
  const handled = useRef(0);

  useEffect(() => {
    // run once per successful add, not on every re-render
    if (state.ok && state.ok !== handled.current) {
      handled.current = state.ok;
      ref.current?.reset();
      onAdded();
    }
  }, [state.ok, onAdded]);

  return (
    <form ref={ref} action={action} className="row" style={{ alignItems: "flex-end" }}>
      <div className="field" style={{ flex: "2 1 200px" }}>
        <label htmlFor="queue-name">Add a queue</label>
        <input id="queue-name" name="name" className="input" placeholder="Name" required />
      </div>
      <div className="field" style={{ flex: "1 1 140px" }}>
        <label htmlFor="queue-mins">Minutes per group</label>
        <input id="queue-mins" name="defaultMinsPerGroup" type="number" min={1} max={120} placeholder="5" className="input" />
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Adding…" : "Add queue"}
      </button>
      {state.errors && <p className="error" style={{ width: "100%" }}>{Object.values(state.errors)[0]}</p>}
      <p className="hint" style={{ width: "100%" }}>
        Minutes per group is a starting guess for wait times. Once people are being served, Qoda uses the real pace.
      </p>
    </form>
  );
}

function ConfirmButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="small">{confirm}</span>
      <button type="button" className="btn btn-small toggle-closed" onClick={() => { setAsking(false); onConfirm(); }}>
        Replace
      </button>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
