import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getGalleryAlbums } from "@/lib/tenant-data";
import { GalleryClient, type AlbumRow } from "./gallery-client";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const albums = await getGalleryAlbums(community.id, false, true);
  const rows: AlbumRow[] = albums.map((a) => ({
    id: a.id,
    titleEn: a.titleEn,
    titleGu: a.titleGu,
    coverUrl: a.coverUrl,
    accent: a.accent,
    startDateISO: a.startDate ? a.startDate.toISOString() : null,
    endDateISO: a.endDate ? a.endDate.toISOString() : null,
    youtubeUrl: a.youtubeUrl,
    description: a.description,
    isVisible: a.isVisible,
    photos: a._count.images,
    images: a.images.map((i) => ({ imageUrl: i.imageUrl, caption: i.caption })),
    date: a.startDate
      ? new Date(a.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—",
  }));

  return <GalleryClient initialRows={rows} />;
}
