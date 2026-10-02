"use client";

import { useActionState } from "react";
import { joinKnown, joinNew, notMe, type JoinState } from "./actions";

type Props = { space: string; queue: string };

export function NewGuestForm({ space, queue }: Props) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinNew.bind(null, space, queue), {});
  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="stack" noValidate>
      {e.form && <p className="error">{e.form}</p>}

      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" className="input" defaultValue={v.name} autoComplete="given-name" required />
        {e.name && <p className="error">{e.name}</p>}
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <p className="hint">We&apos;ll email you when it&apos;s your turn.</p>
        <input id="email" name="email" type="email" className="input" defaultValue={v.email} autoComplete="email" inputMode="email" required />
        {e.email && <p className="error">{e.email}</p>}
      </div>

      <div className="field">
        <label htmlFor="phone">Phone (optional)</label>
        <p className="hint">So staff can call if they can&apos;t find you.</p>
        <input id="phone" name="phone" type="tel" className="input" defaultValue={v.phone} autoComplete="tel" inputMode="tel" />
        {e.phone && <p className="error">{e.phone}</p>}
      </div>

      <PartySize defaultValue={v.partySize} error={e.partySize} />

      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <button className="btn btn-block" disabled={pending}>
        {pending ? "Joining…" : "Join the line"}
      </button>
    </form>
  );
}

export function KnownGuestForm({ space, queue, name, email }: Props & { name: string; email: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinKnown.bind(null, space, queue), {});
  const e = state.errors ?? {};

  return (
    <div className="stack">
      <form action={action} className="stack">
        {e.form && <p className="error">{e.form}</p>}
        <div className="panel">
          <p>
            Joining as <strong>{name}</strong>
          </p>
          <p className="muted small">{email}</p>
        </div>
        <PartySize error={e.partySize} />
        <button className="btn btn-block" disabled={pending}>
          {pending ? "Joining…" : "Join the line"}
        </button>
      </form>
      <form action={notMe.bind(null, space, queue)}>
        <button className="btn-link">Not you? Use different details</button>
      </form>
    </div>
  );
}

function PartySize({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <div className="field">
      <label htmlFor="partySize">How many people? (optional)</label>
      <input id="partySize" name="partySize" type="number" min={1} max={50} className="input" defaultValue={defaultValue} inputMode="numeric" />
      {error && <p className="error">{error}</p>}
    </div>
  );
}
