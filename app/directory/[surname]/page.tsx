import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups } from "@/lib/tenant-data";
import { SurnameClient, type FamilyRow } from "./surname-client";

export const dynamic = "force-dynamic";

export default async function SurnameFamiliesPage({
  params,
}: {
  params: Promise<{ surname: string }>;
}) {
  const { surname } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const groups = await getSurnameGroups(community.id);
  const group = groups.find((g) => g.id === surname);
  if (!group) notFound();

  // Every member, not just the head — search matches a member's name too, not
  // only who the family is registered under.
  const families = await prisma.family.findMany({
    where: { communityId: community.id, status: "APPROVED", surnameGroupId: surname },
    include: {
      familyMembers: {
        select: { fullNameEn: true, fullNameGu: true, relation: true, isHead: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { familyMembers: true } },
    },
  });

  const rows: FamilyRow[] = families.map((f) => ({
    id: f.id,
    headNameEn: f.headNameEn,
    headNameGu: f.headNameGu,
    city: f.city,
    memberCount: f._count.familyMembers,
    otherMembers: f.familyMembers
      .filter((m) => !m.isHead)
      .map((m) => ({ fullNameEn: m.fullNameEn, fullNameGu: m.fullNameGu, relation: m.relation })),
  }));

  return (
    <SurnameClient groupNameEn={group.nameEn} groupNameGu={group.nameGu} rows={rows} />
  );
}
