import { NextResponse } from "next/server";
import { getTicketView } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const view = getTicketView((await params).token);
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
