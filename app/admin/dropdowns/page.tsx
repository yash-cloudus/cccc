import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups, getDropdownOptions } from "@/lib/tenant-data";
import { seedRelationshipDefaults } from "@/lib/constants";
import {
  isStudentOccupation,
  isVeparOccupation,
  seedOccupationDefaults,
} from "@/lib/occupation-defaults";
import { DropdownsClient, type DropdownRow } from "./dropdowns-client";

export const dynamic = "force-dynamic";

function toRow(
  o: {
    id: string;
    nameEn: string;
    nameGu: string;
    isActive: boolean;
    needsReview: boolean;
  },
  childCount = 0,
): DropdownRow {
  return {
    id: o.id,
    nameEn: o.nameEn,
    nameGu: o.nameGu,
    isActive: o.isActive,
    inUse: 0,
    needsReview: o.needsReview,
    childCount,
  };
}

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

  // Backfill relationship masters for communities created before seeding existed.
  const relationCount = await prisma.dropdownOption.count({
    where: { communityId: community.id, type: "relationship" },
  });
  if (relationCount === 0) {
    await seedRelationshipDefaults(prisma, community.id);
  }

  const [surnames, options, bloodGroups] = await Promise.all([
    getSurnameGroups(community.id),
    getDropdownOptions(community.id),
    prisma.bloodGroup.findMany({ orderBy: { type: "asc" } }),
  ]);

  const childCountByParent = new Map<string, number>();
  for (const o of options) {
    if (!o.parentId) continue;
    childCountByParent.set(o.parentId, (childCountByParent.get(o.parentId) ?? 0) + 1);
  }
  const countOf = (id: string) => childCountByParent.get(id) ?? 0;

  const occupationRoots = options.filter((o) => o.type === "occupation" && o.parentId === null);
  const studentRoot = occupationRoots.find((o) =>
    isStudentOccupation(o.nameEn, o.nameGu),
  );
  const veparRoot = occupationRoots.find((o) => isVeparOccupation(o.nameEn, o.nameGu));

  const rows: Record<string, DropdownRow[]> = {
    surname: surnames.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameGu: s.nameGu,
      isActive: true,
      inUse: s._count.families,
      needsReview: s.needsReview,
      childCount: 0,
    })),
    blood: bloodGroups.map((b) => ({
      id: b.id,
      nameEn: b.label,
      nameGu: b.label,
      isActive: true,
      inUse: 0,
      childCount: 0,
    })),
    occupation: occupationRoots.map((o) => toRow(o, countOf(o.id))),
    relationship: options
      .filter((o) => o.type === "relationship" && o.parentId === null)
      .map((o) => toRow(o)),
    // Connected to Occupation → Student / Vepar children (same DropdownOption tree).
    student: studentRoot
      ? options.filter((o) => o.parentId === studentRoot.id).map((o) => toRow(o, countOf(o.id)))
      : [],
    vepar: veparRoot
      ? options.filter((o) => o.parentId === veparRoot.id).map((o) => toRow(o, countOf(o.id)))
      : [],
  };

  return (
    <DropdownsClient
      initialRows={rows}
      roots={{
        student: studentRoot ? toRow(studentRoot) : null,
        vepar: veparRoot ? toRow(veparRoot) : null,
      }}
    />
  );
}
