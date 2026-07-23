import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getGalleryAlbums } from "@/lib/tenant-data";
import { GalleryClient, type AlbumRow } from "./gallery-client";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const albums = await getGalleryAlbums(community.id);
  const rows: AlbumRow[] = albums.map((a) => ({
    id: a.id,
    titleEn: a.titleEn,
    titleGu: a.titleGu,
    coverUrl: a.coverUrl,
    youtubeUrl: a.youtubeUrl,
    description: a.description,
    isVisible: a.isVisible,
    photos: a._count.images,
    date: a.albumDate
      ? new Date(a.albumDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—",
  }));

  return <GalleryClient initialRows={rows} />;
}
