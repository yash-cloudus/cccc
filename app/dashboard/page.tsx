import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getAds, getNews } from "@/lib/tenant-data";
import { DashboardClient, type AdRow, type FeaturedNews } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [ads, news] = await Promise.all([
    getAds(community.id, true),
    getNews(community.id, true),
  ]);

  const adRows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    subtitle: a.pitch,
    imageUrl: a.imageUrl,
    link: a.linkUrl ?? "/ads",
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

  return <DashboardClient ads={adRows} featured={featured} />;
}
