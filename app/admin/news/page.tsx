import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getNews } from "@/lib/tenant-data";
import { formatDateDMY } from "@/lib/format";
import { NewsClient, type NewsRow } from "./news-client";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const news = await getNews(community.id);
  const rows: NewsRow[] = news.map((n) => ({
    id: n.id,
    titleEn: n.titleEn,
    titleGu: n.titleGu,
    contentEn: n.contentEn,
    contentGu: n.contentGu,
    imageUrl: n.imageUrl,
    documentUrl: n.documentUrl,
    documentName: n.documentName,
    publishedAtISO: new Date(n.publishedAt).toISOString(),
    author: null,
    isPinned: n.isPinned,
    isPublished: n.isPublished,
    notificationSent: n.notificationSent,
    publishedAt: formatDateDMY(n.publishedAt),
  }));

  return <NewsClient initialRows={rows} />;
}
