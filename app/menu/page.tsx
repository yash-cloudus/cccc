import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import {
  getCommunitySettingsMap,
  getOrganModuleSettings,
  getResultModuleSettings,
} from "@/lib/community-settings";
import { getAdPriceTiersForCommunity } from "@/lib/tenant-data";
import { MenuClient } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [settingsMap, { tiers }] = await Promise.all([
    getCommunitySettingsMap(community.id),
    getAdPriceTiersForCommunity(community.id),
  ]);

  return (
    <MenuClient
      resultEnabled={getResultModuleSettings(settingsMap).enable}
      organEnabled={getOrganModuleSettings(settingsMap).enable}
      adTiers={tiers}
    />
  );
}
