import { PoweredBy } from "@/components/Brand";
import { loadSpace } from "@/lib/load";
import { currentGuest } from "@/lib/session";
import { guestTickets } from "@/lib/tickets";
import { MyLines } from "./MyLines";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ space: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: `My lines at ${loadSpace((await params).space).name}` };
}

export default async function MyLinesPage({ params }: Props) {
  const space = loadSpace((await params).space);
  const guest = await currentGuest(space);

  return (
    <main className="narrow">
      <div className="stack" style={{ gap: 4 }}>
        <p className="muted">{space.name}</p>
        <h1>My lines</h1>
      </div>
      <MyLines slug={space.slug} initial={guest ? guestTickets(space, guest) : []} />
      <PoweredBy />
    </main>
  );
}
