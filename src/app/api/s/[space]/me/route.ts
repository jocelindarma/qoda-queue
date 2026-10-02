import { NextResponse } from "next/server";
import { currentGuest } from "@/lib/session";
import { getSpace } from "@/lib/spaces";
import { guestTickets } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ space: string }> }) {
  const space = getSpace((await params).space);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const guest = await currentGuest(space);
  if (!guest) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(guestTickets(space, guest), { headers: { "Cache-Control": "no-store" } });
}
