import Link from "next/link";
import { redirect } from "next/navigation";
import { PoweredBy } from "@/components/Brand";
import { loadSpace } from "@/lib/load";
import { currentGuest } from "@/lib/session";
import { listQueues } from "@/lib/spaces";
import { getBoard } from "@/lib/tickets";
import { BoardLive } from "./BoardLive";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ space: string }>; searchParams: Promise<{ tv?: string }> };

export async function generateMetadata({ params }: Props) {
  const { space } = await params;
  return { title: `Queues at ${loadSpace(space).name}` };
}

export default async function BoardPage({ params, searchParams }: Props) {
  const space = loadSpace((await params).space);
  const tv = (await searchParams).tv === "1";

  // one queue? skip the board and go straight to joining
  const queues = listQueues(space.id);
  if (queues.length === 1 && !tv) redirect(`/s/${space.slug}/q/${queues[0].slug}`);

  const guest = await currentGuest(space);

  return (
    <main className={tv ? "wide tv" : "narrow"}>
      <div className="row spread">
        <div className="stack" style={{ gap: 4 }}>
          <h1>{space.name}</h1>
          <p className="muted">{tv ? "Scan the QR code at any queue to join" : "Pick a queue to join"}</p>
        </div>
        {guest && !tv && (
          <Link href={`/s/${space.slug}/me`} className="btn btn-ghost btn-small">
            My lines
          </Link>
        )}
      </div>
      <BoardLive slug={space.slug} initial={getBoard(space)} tv={tv} />
      {!tv && <PoweredBy />}
    </main>
  );
}
