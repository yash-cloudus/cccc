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
        phoneIso: true,
        description: true,
        address: true,
        city: true,
        category: { select: { nameEn: true, nameGu: true } },
        family: { select: { headNameEn: true, headNameGu: true } },
      },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const bizNameById = new Map(bizRows.map((b) => [b.id, { nameEn: b.nameEn, nameGu: b.nameGu || b.nameEn }]));

  const rows: AdRow[] = ads.map((a) => {
    const bizName = a.businessId ? bizNameById.get(a.businessId) : undefined;
    return {
      id: a.id,
      name: a.name,
      nameEn: bizName?.nameEn ?? a.name,
      nameGu: bizName?.nameGu ?? a.name,
      pitch: a.pitch,
      imageUrl: a.imageUrl,
      linkUrl: a.linkUrl,
      ownerName: a.ownerName,
      ownerMobile: a.ownerMobile,
      // The advertiser's number carries its country like every other number.
      ownerMobileIso: a.ownerMobileIso,
      category: a.category,
      rejectReason: a.rejectReason,
      type: a.type === "premium" ? "premium" : "general",
      source: a.source === "admin" ? "admin" : "user",
      payStatus: a.payStatus,
      paymentProof: a.paymentProof,
      status: a.status,
      priority: a.priority,
      views: a.views,
      clicks: a.clicks,
      createdAt: a.createdAt.toISOString(),
      startDate: a.startDate.toISOString(),
      endDate: a.endDate.toISOString(),
    };
  });

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
      ownerMobileIso: b.phoneIso ?? "in",
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
