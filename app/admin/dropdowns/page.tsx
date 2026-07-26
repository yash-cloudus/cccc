import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups, getDropdownOptions } from "@/lib/tenant-data";
import { DropdownsClient, type DropdownRow } from "./dropdowns-client";

export const dynamic = "force-dynamic";

export default async function DropdownsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [surnames, options, categories, bloodGroups] = await Promise.all([
    getSurnameGroups(community.id),
    getDropdownOptions(community.id),
    prisma.businessCategory.findMany({
      where: { communityId: community.id },
      include: { _count: { select: { businesses: true } } },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    }),
    prisma.bloodGroup.findMany({ orderBy: { type: "asc" } }),
  ]);

  // Every category is normalised to the same row shape so one table renders all.
  const rows: Record<string, DropdownRow[]> = {
    surname: surnames.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameGu: s.nameGu,
      isActive: true,
      inUse: s._count.families,
      needsReview: s.needsReview,
    })),
    buscat: categories.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameGu: c.nameGu,
      isActive: true,
      inUse: c._count.businesses,
    })),
    blood: bloodGroups.map((b) => ({
      id: b.id,
      nameEn: b.label,
      nameGu: b.label,
      isActive: true,
      inUse: 0,
    })),
  };

  for (const type of ["degree", "occupation", "relationship", "standard"]) {
    rows[type] = options
      .filter((o) => o.type === type)
      .map((o) => ({
        id: o.id,
        nameEn: o.nameEn,
        nameGu: o.nameGu,
        isActive: o.isActive,
        inUse: 0,
        needsReview: o.needsReview,
      }));
  }

  return <DropdownsClient initialRows={rows} />;
}
