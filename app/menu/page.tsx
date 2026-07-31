import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getAdPriceTiersForCommunity } from "@/lib/tenant-data";
import { MenuClient } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [resultEnabled, { tiers }] = await Promise.all([
    getCommunitySettingsMap(community.id).then((s) => getResultModuleSettings(s).enable),
    getAdPriceTiersForCommunity(community.id),
  ]);

  return <MenuClient resultEnabled={resultEnabled} adTiers={tiers} />;
}
