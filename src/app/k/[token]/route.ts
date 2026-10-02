import { NextResponse, type NextRequest } from "next/server";
import { parseKey } from "@/lib/keys";
import { ownerCookie, setKeyCookie, staffCookie } from "@/lib/session";
import { getQueueById, getSpaceById } from "@/lib/spaces";

/**
 * Owner and staff links look like /k/<signed key>. Opening one stores the key
 * in a cookie and redirects to the clean page, so the secret doesn't sit in the
 * address bar or browser history.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = parseKey(token);
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (key?.scope === "s") {
    const space = getSpaceById(key.id);
    if (space && space.keyVersion === key.version) {
      await setKeyCookie(ownerCookie(space.id), token);
      return go(`/s/${space.slug}/admin`);
    }
  }

  if (key?.scope === "q") {
    const queue = getQueueById(key.id);
    const space = queue && getSpaceById(queue.spaceId);
    if (queue && space && queue.keyVersion === key.version) {
      await setKeyCookie(staffCookie(queue.id), token);
      return go(`/s/${space.slug}/q/${queue.slug}/staff`);
    }
  }

  return go("/link-expired");
}
