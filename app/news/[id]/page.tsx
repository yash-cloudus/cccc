import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getNewsItem } from "@/lib/tenant-data";
import { NewsDetailClient } from "./news-detail-client";

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const item = await getNewsItem(community.id, id);
  if (!item || !item.isPublished) notFound();

  return (
    <NewsDetailClient
      item={{
        id: item.id,
        titleEn: item.titleEn,
        titleGu: item.titleGu,
        contentEn: item.contentEn,
        contentGu: item.contentGu,
        dateISO: item.publishedAt.toISOString(),
        isPinned: item.isPinned,
        accent: item.accent,
        imageUrl: item.imageUrl,
        documentUrl: item.documentUrl,
        documentName: item.documentName,
        linkUrl: item.linkUrl,
      }}
    />
  );
}
