import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { MenuClient } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const resultEnabled = getResultModuleSettings(await getCommunitySettingsMap(community.id)).enable;

  return <MenuClient resultEnabled={resultEnabled} />;
}
