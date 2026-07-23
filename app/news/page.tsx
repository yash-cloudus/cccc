import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getNews } from "@/lib/tenant-data";
import { NewsListClient, type NewsRow } from "./news-list-client";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const news = await getNews(community.id, true);
  const rows: NewsRow[] = news.map((n) => ({
    id: n.id,
    titleEn: n.titleEn,
    titleGu: n.titleGu,
    dateISO: n.publishedAt.toISOString(),
    isPinned: n.isPinned,
    accent: n.accent,
    imageUrl: n.imageUrl,
  }));

  return <NewsListClient rows={rows} />;
}
