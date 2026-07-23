import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getAds } from "@/lib/tenant-data";
import { AdsClient, type AdRow } from "./ads-client";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default async function AdsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const ads = await getAds(community.id);
  const rows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    start: fmt(a.startDate),
    end: fmt(a.endDate),
    status: a.status,
    priority: a.priority,
    views: a.views,
    clicks: a.clicks,
  }));

  return <AdsClient initialRows={rows} />;
}
