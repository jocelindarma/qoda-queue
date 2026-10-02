import QRCode from "qrcode";
import { NoAccess } from "@/components/NoAccess";
import { loadQueue } from "@/lib/load";
import { canStaff, isOwner } from "@/lib/session";
import { getStaffView } from "@/lib/tickets";
import { baseUrl } from "@/lib/url";
import { StaffDashboard } from "./StaffDashboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ space: string; queue: string }> };

export async function generateMetadata({ params }: Props) {
  const p = await params;
  const { queue } = loadQueue(p.space, p.queue);
  return { title: `Staff: ${queue.name}`, robots: { index: false } };
}

export default async function StaffPage({ params }: Props) {
  const p = await params;
  const { space, queue } = loadQueue(p.space, p.queue);
  if (!(await canStaff(space, queue))) return <NoAccess title={queue.name} who="the people running this line" />;

  const joinUrl = `${await baseUrl()}/s/${space.slug}/q/${queue.slug}`;

  return (
    <StaffDashboard
      space={{ slug: space.slug, name: space.name }}
      queue={{ slug: queue.slug, name: queue.name }}
      joinUrl={joinUrl}
      qrDataUrl={await QRCode.toDataURL(joinUrl, { margin: 0, width: 512 })}
      initial={getStaffView(space, queue)}
      isOwner={await isOwner(space)}
    />
  );
}
