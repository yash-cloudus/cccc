import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups, getDropdownOptions } from "@/lib/tenant-data";
import { seedOccupationDefaults } from "@/lib/occupation-defaults";
import { DropdownsClient, type DropdownRow } from "./dropdowns-client";

export const dynamic = "force-dynamic";

export default async function DropdownsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  // Backfill nested occupation tree for communities created before this feature.
  const nestedCount = await prisma.dropdownOption.count({
    where: { communityId: community.id, type: "occupation", parentId: { not: null } },
  });
  if (nestedCount === 0) {
    await prisma.dropdownOption.deleteMany({
      where: { communityId: community.id, type: "occupation" },
    });
    await seedOccupationDefaults(prisma, community.id);
  }

  const [surnames, options, bloodGroups] = await Promise.all([
    getSurnameGroups(community.id),
    getDropdownOptions(community.id),
    prisma.bloodGroup.findMany({ orderBy: { type: "asc" } }),
  ]);

  const rows: Record<string, DropdownRow[]> = {
    surname: surnames.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameGu: s.nameGu,
      isActive: true,
      inUse: s._count.families,
      needsReview: s.needsReview,
    })),
    blood: bloodGroups.map((b) => ({
      id: b.id,
      nameEn: b.label,
      nameGu: b.label,
      isActive: true,
      inUse: 0,
    })),
  };

  for (const type of ["occupation", "relationship"]) {
    rows[type] = options
      .filter((o) => o.type === type && o.parentId === null)
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
