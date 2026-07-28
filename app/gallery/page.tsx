import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getGalleryAlbums } from "@/lib/tenant-data";
import { GalleryClient, type AlbumRow } from "./gallery-client";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const albums = await getGalleryAlbums(community.id, true);
  const rows: AlbumRow[] = albums.map((a) => ({
    id: a.id,
    titleEn: a.titleEn,
    titleGu: a.titleGu,
    subtitle: a.description,
    photoCount: a._count.images,
    cover: a.coverUrl ?? a.images[0]?.imageUrl ?? null,
    accent: a.accent,
    startDateISO: a.startDate?.toISOString() ?? null,
    endDateISO: a.endDate?.toISOString() ?? null,
  }));

  return <GalleryClient rows={rows} />;
}
