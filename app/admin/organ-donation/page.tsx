import { notFound } from "next/navigation";
import { getCommunitySettingsMap, getOrganModuleSettings } from "@/lib/community-settings";
import { getActiveCommunity } from "@/lib/tenant";
import { getOrganDonors, getOrganRequests, getOrganStats } from "@/lib/tenant-data";
import { OrganDonationAdminClient } from "./organ-donation-client";

export const dynamic = "force-dynamic";

export default async function AdminOrganDonationPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const settings = getOrganModuleSettings(await getCommunitySettingsMap(community.id));
  if (!settings.enable) notFound();

  const [donors, requests, stats] = await Promise.all([
    getOrganDonors(community.id),
    getOrganRequests(community.id),
    getOrganStats(community.id),
  ]);

  return <OrganDonationAdminClient donors={donors} requests={requests} stats={stats} />;
}
