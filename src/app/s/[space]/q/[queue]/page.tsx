import Link from "next/link";
import { redirect } from "next/navigation";
import { PoweredBy } from "@/components/Brand";
import { waitText } from "@/components/WaitText";
import { loadQueue } from "@/lib/load";
import { currentGuest } from "@/lib/session";
import { listQueues } from "@/lib/spaces";
import { activeTicketIn, getBoard } from "@/lib/tickets";
import { KnownGuestForm, NewGuestForm } from "./JoinForms";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ space: string; queue: string }> };

export async function generateMetadata({ params }: Props) {
  const p = await params;
  const { space, queue } = loadQueue(p.space, p.queue);
  const title = queue.name === space.name ? space.name : `${queue.name} at ${space.name}`;
  return { title: `Join the line: ${title}` };
}

export default async function JoinPage({ params }: Props) {
  const p = await params;
  const { space, queue } = loadQueue(p.space, p.queue);
  const guest = await currentGuest(space);

  // already in this line? show their ticket instead
  if (guest) {
    const existing = activeTicketIn(guest.id, queue.id);
    if (existing) redirect(`/t/${existing.publicToken}`);
  }

  const info = getBoard(space).queues.find((q) => q.slug === queue.slug);
  const multi = listQueues(space.id).length > 1;
  const open = space.isOpen && queue.isOpen;

  return (
    <main className="narrow">
      <div className="stack" style={{ gap: 6 }}>
        <p className="muted">
          {multi ? <Link href={`/s/${space.slug}`}>{space.name}</Link> : space.name}
        </p>
        <h1>{queue.name === space.name ? "Join the line" : queue.name}</h1>
        {open && info && (
          <p>
            {info.waiting} waiting. {waitText(info.wait, info.waiting)}.
          </p>
        )}
      </div>

      {!open ? (
        <div className="panel stack">
          <h2>Not taking new people right now</h2>
          <p className="muted">This line is paused. Check with the staff or try again in a bit.</p>
        </div>
      ) : guest ? (
        <KnownGuestForm space={space.slug} queue={queue.slug} name={guest.name} email={guest.email} />
      ) : (
        <NewGuestForm space={space.slug} queue={queue.slug} />
      )}

      {guest && multi && (
        <Link href={`/s/${space.slug}/me`} className="btn btn-ghost">
          See all my lines
        </Link>
      )}
      <PoweredBy />
    </main>
  );
}
