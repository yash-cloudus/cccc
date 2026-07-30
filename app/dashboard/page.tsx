import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getAds, getNews } from "@/lib/tenant-data";
import { DashboardClient, type AdRow, type FeaturedNews } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [ads, news, settingsMap] = await Promise.all([
    getAds(community.id, true),
    getNews(community.id, true),
    getCommunitySettingsMap(community.id),
  ]);

  const resultEnabled = getResultModuleSettings(settingsMap).enable;

  const adRows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    subtitle: a.pitch,
    imageUrl: a.imageUrl,
    // Always the in-app detail screen — the advertiser's own site is reachable
    // from the contact block there.
    link: `/ads/${a.id}`,
  }));

  const featuredSrc = news.find((n) => n.isPinned) ?? news[0] ?? null;
  const featured: FeaturedNews | null = featuredSrc
    ? {
        id: featuredSrc.id,
        titleEn: featuredSrc.titleEn,
        titleGu: featuredSrc.titleGu,
        dateISO: featuredSrc.publishedAt.toISOString(),
        isPinned: featuredSrc.isPinned,
      }
    : null;

  return <DashboardClient ads={adRows} featured={featured} resultEnabled={resultEnabled} />;
}
