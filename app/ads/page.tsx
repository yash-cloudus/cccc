import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { getAdPriceTiersForCommunity, getAds } from "@/lib/tenant-data";
import { AdsClient, type AdRow, type MyBanner } from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const session = await getSessionPayload();

  const [ads, myAds, { tiers }] = await Promise.all([
    getAds(community.id, true),
    session?.sub
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

  const rows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    pitch: a.pitch,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
    category: a.category,
  }));

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
    <AdsClient rows={rows} myBanners={mine} signedIn={Boolean(session?.sub)} tiers={tiers} />
  );
}
