import { notFound } from "next/navigation";
import { PoweredBy } from "@/components/Brand";
import { listQueues, getSpace } from "@/lib/spaces";
import { getTicketView } from "@/lib/tickets";
import { TicketLive } from "./TicketLive";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props) {
  const view = getTicketView((await params).token);
  return { title: view ? `${view.ticket}: ${view.queueName}` : "Ticket not found" };
}

export default async function TicketPage({ params }: Props) {
  const view = getTicketView((await params).token);
  if (!view) notFound();
  const space = getSpace(view.spaceSlug);
  const multi = !!space && listQueues(space.id).length > 1;

  return (
    <main className="narrow">
      <TicketLive initial={view} showMyLines={multi} />
      <PoweredBy />
    </main>
  );
}
