"use client";

import { useActionState, useEffect, useState } from "react";
import { create, type CreateSpaceState } from "./actions";

export function CreateSpaceForm() {
  const [state, action, pending] = useActionState<CreateSpaceState, FormData>(create, {});
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);

  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="timezone" value={timezone} />

      <div className="field">
        <label htmlFor="name">Name</label>
        <p className="hint">What people see when they scan. A shop, an event, an office.</p>
        <input id="name" name="name" className="input" defaultValue={v.name} required />
        {e.name && <p className="error">{e.name}</p>}
      </div>

      <div className="field">
        <label htmlFor="firstQueueName">First queue (optional)</label>
        <p className="hint">Leave blank if you only need one line. You can add more later.</p>
        <input id="firstQueueName" name="firstQueueName" className="input" defaultValue={v.firstQueueName} />
        {e.firstQueueName && <p className="error">{e.firstQueueName}</p>}
      </div>

      <div className="field">
        <label htmlFor="ownerEmail">Your email</label>
        <p className="hint">If you lose your owner link, we can send it here.</p>
        <input id="ownerEmail" name="ownerEmail" type="email" className="input" defaultValue={v.ownerEmail} autoComplete="email" required />
        {e.ownerEmail && <p className="error">{e.ownerEmail}</p>}
      </div>

      <button className="btn btn-block" disabled={pending}>
        {pending ? "Creating…" : "Create space"}
      </button>
    </form>
  );
}
