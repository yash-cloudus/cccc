import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const rows = await prisma.setting.findMany({ where: { communityId: community.id } });
  const stored: Record<string, string> = {};
  for (const r of rows) stored[r.key] = r.value;

  return <SettingsClient stored={stored} authMode={community.authMode} />;
}
