import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getBusiness } from "@/lib/tenant-data";
import { BusinessDetailClient, type BusinessDetail } from "./business-detail-client";

export const dynamic = "force-dynamic";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const biz = await getBusiness(community.id, id);
  if (!biz) notFound();

  const detail: BusinessDetail = {
    id: biz.id,
    nameEn: biz.nameEn,
    nameGu: biz.nameGu,
    description: biz.description,
    descriptionGu: biz.descriptionGu,
    phone: biz.phone,
    whatsapp: biz.whatsapp,
    address: biz.address,
    addressGu: biz.addressGu,
    city: biz.city,
    website: biz.website,
    mapUrl: biz.mapUrl,
    familyId: biz.familyId,
    ownerEn: biz.owner?.fullNameEn ?? null,
    ownerGu: biz.owner?.fullNameGu ?? null,
    categoryNameEn: biz.category?.nameEn ?? null,
    categoryNameGu: biz.category?.nameGu ?? null,
    gallery: biz.gallery.map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl,
      caption: g.caption,
    })),
  };

  return <BusinessDetailClient biz={detail} />;
}
