import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { AdsClient, type AdRow, type BusinessOption } from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [ads, categories, bizRows] = await Promise.all([
    prisma.advertisement.findMany({
      where: { communityId: community.id },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.businessCategory.findMany({
      where: { communityId: community.id },
      select: { nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    // Offered in the "Existing business" picker of the New advertisement form.
    prisma.business.findMany({
      where: { communityId: community.id },
      select: {
        id: true,
        nameEn: true,
        nameGu: true,
        phone: true,
        category: { select: { nameEn: true } },
        // Business has no owner column — the owner is the linked family's head.
        family: { select: { headNameEn: true, headNameGu: true } },
      },
      orderBy: { nameEn: "asc" },
      take: 500,
    }),
  ]);

  const rows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    imageUrl: a.imageUrl,
    ownerName: a.ownerName,
    ownerMobile: a.ownerMobile,
    category: a.category,
    type: a.type === "premium" ? "premium" : "general",
    source: a.source === "admin" ? "admin" : "user",
    status: a.status,
    priority: a.priority,
    views: a.views,
    clicks: a.clicks,
    createdAt: a.createdAt.toISOString(),
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
  }));

  const businesses: BusinessOption[] = bizRows.map((b) => ({
    id: b.id,
    name: b.nameGu || b.nameEn,
    category: b.category?.nameEn ?? "",
    ownerName: b.family?.headNameGu || b.family?.headNameEn || "",
    ownerMobile: b.phone ?? "",
  }));

  return (
    <AdsClient
      initialRows={rows}
      categories={categories.map((c) => c.nameEn)}
      businesses={businesses}
    />
  );
}
