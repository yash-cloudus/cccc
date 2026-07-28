"use client";

import { useSyncExternalStore } from "react";
import { communityAdminHostLabel, communitySiteHostLabel } from "@/lib/platform";

const subscribe = () => () => {};

/**
 * The address this viewer can actually open, as plain text.
 *
 * On a single-host origin (dev tunnel, LAN IP) that address is the current
 * origin, which only the browser knows — so render the canonical
 * `{slug}.<root>` label on the server and swap to the live host after mount.
 * Reading `window` during render instead would desync hydration.
 */
export function HostLabel({ slug, admin = false }: { slug: string; admin?: boolean }) {
  const host = useSyncExternalStore(
    subscribe,
    () => window.location.host,
    () => null,
  );
  return <>{admin ? communityAdminHostLabel(slug, host) : communitySiteHostLabel(slug, host)}</>;
}
