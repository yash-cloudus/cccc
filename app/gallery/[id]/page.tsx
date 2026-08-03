import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getGalleryAlbum } from "@/lib/tenant-data";
import { GalleryDetailClient } from "./gallery-detail-client";

export const dynamic = "force-dynamic";

export default async function GalleryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const album = await getGalleryAlbum(community.id, id);
  if (!album || !album.isVisible) notFound();

  return (
    <GalleryDetailClient
      album={{
        id: album.id,
        titleEn: album.titleEn,
        titleGu: album.titleGu,
        description: album.description,
        descriptionEn: album.descriptionEn,
        accent: album.accent,
        startDateISO: album.startDate?.toISOString() ?? null,
        endDateISO: album.endDate?.toISOString() ?? null,
        youtubeUrl: album.youtubeUrl,
        images: album.images.map((i) => ({ id: i.id, imageUrl: i.imageUrl, caption: i.caption })),
      }}
    />
  );
}
