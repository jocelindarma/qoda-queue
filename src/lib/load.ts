import "server-only";
import { notFound } from "next/navigation";
import { getQueue, getSpace } from "./spaces";

export function loadSpace(slug: string) {
  const space = getSpace(slug);
  if (!space) notFound();
  return space;
}

export function loadQueue(spaceSlug: string, queueSlug: string) {
  const space = loadSpace(spaceSlug);
  const queue = getQueue(space, queueSlug);
  if (!queue) notFound();
  return { space, queue };
}
