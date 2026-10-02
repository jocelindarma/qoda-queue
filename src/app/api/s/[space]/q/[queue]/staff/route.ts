import { NextResponse } from "next/server";
import { canStaff } from "@/lib/session";
import { getQueue, getSpace } from "@/lib/spaces";
import { getStaffView } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ space: string; queue: string }> }) {
  const p = await params;
  const space = getSpace(p.space);
  const queue = space && getQueue(space, p.queue);
  if (!space || !queue) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canStaff(space, queue))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(getStaffView(space, queue), { headers: { "Cache-Control": "no-store" } });
}
