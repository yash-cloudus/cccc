import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getBusinessCategories } from "@/lib/tenant-data";
import { AdsClient, type AdRow, type BusinessOption, type CategoryOption } from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [ads, categories, bizRows] = await Promise.all([
    prisma.advertisement.findMany({
      where: { communityId: community.id },
      orderBy: [{ createdAt: "desc" }],
    }),
    // Same list as Business directory — Vepar (Business) sub-categories.
    getBusinessCategories(community.id),
    prisma.business.findMany({
      where: { communityId: community.id },
      select: {
        id: true,
        nameEn: true,
        nameGu: true,
        phone: true,
        description: true,
        address: true,
        city: true,
        category: { select: { nameEn: true, nameGu: true } },
        family: { select: { headNameEn: true, headNameGu: true } },
      },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const rows: AdRow[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    pitch: a.pitch,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
    ownerName: a.ownerName,
    ownerMobile: a.ownerMobile,
    category: a.category,
    type: a.type === "premium" ? "premium" : "general",
    source: a.source === "admin" ? "admin" : "user",
    payStatus: a.payStatus,
    status: a.status,
    priority: a.priority,
    views: a.views,
    clicks: a.clicks,
    createdAt: a.createdAt.toISOString(),
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
  }));

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    value: c.nameEn,
    label: c.nameGu ? `${c.nameEn} · ${c.nameGu}` : c.nameEn,
  }));

  const businesses: BusinessOption[] = bizRows.map((b) => {
    const catEn = b.category?.nameEn ?? "";
    const catGu = b.category?.nameGu ?? "";
    const catLabel = catEn ? (catGu ? `${catEn} · ${catGu}` : catEn) : "";
    const name = b.nameGu || b.nameEn;
    return {
      id: b.id,
      name,
      category: catEn,
      categoryLabel: catLabel,
      label: catLabel ? `${name} · ${catLabel}` : name,
      ownerName: b.family?.headNameGu || b.family?.headNameEn || "",
      ownerMobile: b.phone ?? "",
      description: b.description ?? "",
      address: [b.address, b.city].filter(Boolean).join(", "),
    };
  });

  return (
    <AdsClient
      initialRows={rows}
      categories={categoryOptions}
      businesses={businesses}
    />
  );
}
