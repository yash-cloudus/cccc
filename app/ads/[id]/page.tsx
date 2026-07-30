import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getAd } from "@/lib/tenant-data";
import { AdDetailClient, type AdDetail } from "./ad-detail-client";

export const dynamic = "force-dynamic";

export default async function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const ad = await getAd(community.id, id);
  if (!ad) notFound();

  // Everything below the banner describes the business; the ad only carries
  // the artwork, the pitch and — when no business is linked — a fallback name.
  const biz = ad.business;
  const detail: AdDetail = {
    id: ad.id,
    pitch: ad.pitch,
    imageUrl: ad.imageUrl,
    isPremium: ad.type === "premium",
    businessId: ad.businessId,
    nameEn: biz?.nameEn ?? ad.name,
    nameGu: biz?.nameGu ?? null,
    verified: biz?.isApproved ?? false,
    categoryEn: biz?.category?.nameEn ?? ad.category,
    categoryGu: biz?.category?.nameGu ?? null,
    description: biz?.description ?? null,
    descriptionGu: biz?.descriptionGu ?? null,
    address: biz?.address ?? null,
    addressGu: biz?.addressGu ?? null,
    city: biz?.city ?? null,
    website: biz?.website ?? ad.linkUrl,
    // A linked business is the trusted source once it exists; the ad's own
    // owner fields only fill in for standalone (non-business) banners.
    contactName: biz ? null : ad.ownerName,
    phone: biz?.phone ?? ad.ownerMobile,
    whatsapp: biz?.whatsapp ?? null,
    mapUrl: biz?.mapUrl ?? null,
    endDateISO: ad.endDate.toISOString(),
  };

  return <AdDetailClient ad={detail} />;
}
