"use server";

import { sendAlmostTurns } from "@/lib/emails";
import { cancelByToken } from "@/lib/tickets";
import { baseUrl } from "@/lib/url";

export async function leaveQueue(token: string): Promise<void> {
  const queue = cancelByToken(token);
  // someone leaving moves everyone behind them up
  if (queue) sendAlmostTurns(await baseUrl(), queue);
}
