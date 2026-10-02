"use server";

import { redirect } from "next/navigation";
import { ownerCookie, ownerKey, setKeyCookie } from "@/lib/session";
import { createSpace } from "@/lib/spaces";
import { createSpaceSchema, firstErrors } from "@/lib/validation";

export type CreateSpaceState = { errors?: Record<string, string>; values?: Record<string, string> };

export async function create(_: CreateSpaceState, form: FormData): Promise<CreateSpaceState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = createSpaceSchema.safeParse(raw);
  if (!parsed.success) return { errors: firstErrors(parsed.error), values: raw };

  const { name, ownerEmail, firstQueueName, timezone } = parsed.data;
  const { space } = createSpace({
    name,
    ownerEmail: ownerEmail.toLowerCase(),
    timezone: validTimezone(timezone) ? timezone : "UTC",
    firstQueueName: firstQueueName ?? name,
  });

  await setKeyCookie(ownerCookie(space.id), ownerKey(space));
  redirect(`/s/${space.slug}/admin?welcome=1`);
}

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
