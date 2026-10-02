import QRCode from "qrcode";
import { NoAccess } from "@/components/NoAccess";
import { loadSpace } from "@/lib/load";
import { isOwner, ownerKey, staffKey } from "@/lib/session";
import { listQueues } from "@/lib/spaces";
import { getBoard } from "@/lib/tickets";
import { baseUrl } from "@/lib/url";
import { OwnerPanel } from "./OwnerPanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ space: string }>; searchParams: Promise<{ welcome?: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: `Owner: ${loadSpace((await params).space).name}`, robots: { index: false } };
}

const qr = (url: string) => QRCode.toDataURL(url, { margin: 0, width: 512 });

export default async function AdminPage({ params, searchParams }: Props) {
  const space = loadSpace((await params).space);
  if (!(await isOwner(space))) return <NoAccess title={space.name} who="the owner of this space" recover />;

  const base = await baseUrl();
  const boardUrl = `${base}/s/${space.slug}`;

  const queues = await Promise.all(
    listQueues(space.id).map(async (q) => {
      const joinUrl = `${base}/s/${space.slug}/q/${q.slug}`;
      return {
        id: q.id,
        name: q.name,
        slug: q.slug,
        prefix: q.ticketPrefix,
        isOpen: q.isOpen,
        joinUrl,
        staffUrl: `${base}/k/${staffKey(q)}`,
        qrDataUrl: await qr(joinUrl),
      };
    }),
  );

  return (
    <OwnerPanel
      space={{ slug: space.slug, name: space.name, isOpen: space.isOpen, maxLinesPerGuest: space.maxLinesPerGuest }}
      boardUrl={boardUrl}
      boardQr={await qr(boardUrl)}
      ownerUrl={`${base}/k/${ownerKey(space)}`}
      queues={queues}
      initialBoard={getBoard(space)}
      welcome={(await searchParams).welcome === "1"}
    />
  );
}
