import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const partySize = z.preprocess(
  blank,
  z.coerce.number().int().min(1, "At least 1").max(50, "Maximum is 50").optional(),
);

export const createSpaceSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  ownerEmail: z.email("Enter a valid email"),
  firstQueueName: z.preprocess(blank, z.string().trim().max(40).optional()),
  timezone: z.string().min(1),
});

export const addQueueSchema = z.object({
  name: z.string().trim().min(1, "Give the queue a name").max(40),
  defaultMinsPerGroup: z.preprocess(blank, z.coerce.number().int().min(1).max(120).optional()),
});

export const guestSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(50),
  email: z.email("Enter a valid email"),
  phone: z.preprocess(
    blank,
    z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").optional(),
  ),
  partySize,
});

export const recoverSchema = z.object({ email: z.email("Enter a valid email") });

export const quickJoinSchema = z.object({ partySize });

export const walkInSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(50),
  partySize,
});

export function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
