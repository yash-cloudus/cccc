import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getAds } from "@/lib/tenant-data";
import { AdsClient, type AdRow } from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const ads = await getAds(community.id, true);
  const rows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    pitch: a.pitch,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
    category: a.category,
  }));

  return <AdsClient rows={rows} />;
}
