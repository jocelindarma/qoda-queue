"use server";

import { headers } from "next/headers";
import { sendOwnerRecovery } from "@/lib/emails";
import { allow } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/url";
import { firstErrors, recoverSchema } from "@/lib/validation";

export type RecoverState = { errors?: Record<string, string>; values?: Record<string, string>; sentTo?: string };

const MIN = 60_000;

export async function recover(_: RecoverState, form: FormData): Promise<RecoverState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = recoverSchema.safeParse(raw);
  if (!parsed.success) return { errors: firstErrors(parsed.error), values: raw };
  const email = parsed.data.email.toLowerCase();

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  if (!allow("recover-ip", ip, 5, 15 * MIN)) {
    return { errors: { form: "Too many tries. Wait a few minutes and try again." }, values: raw };
  }

  // same answer whether or not the email owns a space, so this can't be used to check emails.
  // a repeat within 5 minutes gets the same answer too, but sends nothing.
  if (!raw.website && allow("recover-email", email, 1, 5 * MIN)) sendOwnerRecovery(await baseUrl(), email);
  return { sentTo: email };
}
