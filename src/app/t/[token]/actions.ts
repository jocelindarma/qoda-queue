"use server";

import { cancelByToken } from "@/lib/tickets";

export async function leaveQueue(token: string): Promise<void> {
  cancelByToken(token);
}
