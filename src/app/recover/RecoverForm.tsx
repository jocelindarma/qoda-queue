"use client";

import { useActionState } from "react";
import { recover, type RecoverState } from "./actions";

export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(recover, {});

  if (state.sentTo) {
    return (
      <div className="panel stack">
        <h2>Check your email</h2>
        <p className="muted">
          If <strong>{state.sentTo}</strong> owns a space, we&apos;ve sent its owner link there. It can take a minute,
          and check your spam folder too.
        </p>
      </div>
    );
  }

  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="stack" noValidate>
      <div className="field">
        <label htmlFor="email">Email</label>
        <p className="hint">The one you used when you created the space.</p>
        <input id="email" name="email" type="email" className="input" defaultValue={v.email} autoComplete="email" required />
        {e.email && <p className="error">{e.email}</p>}
      </div>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {e.form && <p className="error">{e.form}</p>}
      <button className="btn btn-block" disabled={pending}>
        {pending ? "Sending…" : "Email me my owner link"}
      </button>
    </form>
  );
}
