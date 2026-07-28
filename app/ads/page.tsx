import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { getAds } from "@/lib/tenant-data";
import { AdsClient, type AdRow, type MyBanner } from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const session = await getSessionPayload();

  const [ads, myAds] = await Promise.all([
    getAds(community.id, true),
    session?.sub
      ? prisma.advertisement.findMany({
          where: { communityId: community.id, ownerId: session.sub },
          orderBy: { createdAt: "desc" },
        })
      : [],
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

  return <AdsClient rows={rows} myBanners={mine} signedIn={Boolean(session?.sub)} />;
}
