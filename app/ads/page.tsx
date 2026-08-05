import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { getAdPriceTiersForCommunity, getAds } from "@/lib/tenant-data";
import { AdsClient, type AdRow, type MyBanner } from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ browse?: string }>;
}) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const { browse } = await searchParams;
  /** browse=1 → Services tile (public listing only, no manage-banner UI) */
  const browseMode = browse === "1";

  const session = await getSessionPayload();

  const [ads, myAds, { tiers }] = await Promise.all([
    getAds(community.id, true),
    !browseMode && session?.sub
      ? prisma.advertisement.findMany({
          // Premium only — "તમારા બેનર" is the paid banner list. Every business
          // also carries a free general ad, which is not a banner and must not
          // count against MAX_BANNERS_PER_MEMBER.
          where: { communityId: community.id, ownerId: session.sub, type: "premium" },
          orderBy: { createdAt: "desc" },
        })
      : [],
    getAdPriceTiersForCommunity(community.id),
  ]);

  // Collect distinct cities + categories from live ads (via linked businesses)
  const businessIds = ads.map((a) => a.businessId).filter((id): id is string => !!id);
  const linkedBusinesses = businessIds.length
    ? await prisma.business.findMany({
        where: { id: { in: businessIds }, communityId: community.id },
        select: { id: true, city: true, category: { select: { nameEn: true, nameGu: true } } },
      })
    : [];

  // Build lookup: businessId → city/category
  const bizMap = new Map(linkedBusinesses.map((b) => [b.id, b]));

  const rows: AdRow[] = ads.map((a) => {
    const biz = a.businessId ? (bizMap.get(a.businessId) ?? null) : null;
    return {
      id: a.id,
      name: a.name,
      pitch: a.pitch,
      imageUrl: a.imageUrl,
      category: biz?.category?.nameEn ?? a.category,
      categoryGu: biz?.category?.nameGu ?? null,
      city: biz?.city ?? null,
    };
  });

  // Distinct cities and categories for filter chips
  const cities = [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))].sort();
  const categories = [
    ...new Map(
      rows
        .filter((r) => r.category)
        .map((r) => [r.category!, { en: r.category!, gu: r.categoryGu ?? null }]),
    ).values(),
  ];

  const mine: MyBanner[] = myAds.map((a) => ({
    id: a.id,
    name: a.name,
    imageUrl: a.imageUrl,
    status: a.status,
    rejectReason: a.rejectReason,
    views: a.views,
    clicks: a.clicks,
    endDate: a.endDate.toISOString(),
  }));

  return (
    <AdsClient
      rows={rows}
      myBanners={mine}
      signedIn={Boolean(session?.sub)}
      tiers={tiers}
      cities={cities}
      categories={categories}
      browseMode={browseMode}
    />
  );
}
