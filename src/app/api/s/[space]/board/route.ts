import { NextResponse } from "next/server";
import { getSpace } from "@/lib/spaces";
import { getBoard } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ space: string }> }) {
  const space = getSpace((await params).space);
  if (!space) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(getBoard(space), { headers: { "Cache-Control": "no-store" } });
}
