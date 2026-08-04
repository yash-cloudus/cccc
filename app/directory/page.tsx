import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups } from "@/lib/tenant-data";
import { getParivarLockedSurname } from "@/lib/community-defaults";
import { DirectoryClient, type SurnameRow, type DirectoryFamilyRow } from "./directory-client";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  // A Parivar community IS one surname — picking a group first would just be a
  // single-tile screen for nothing. Go straight to that family list.
  if (community.type === "PARIVAR") {
    const locked = await getParivarLockedSurname(prisma, community.id);
    if (locked) redirect(`/directory/${locked.id}`);
  }

  const [groups, families] = await Promise.all([
    getSurnameGroups(community.id),
    prisma.family.findMany({
      where: { communityId: community.id, status: "APPROVED" },
      include: {
        familyMembers: {
          select: { fullNameEn: true, fullNameGu: true, relation: true, isHead: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { familyMembers: true } },
      },
      orderBy: { headNameEn: "asc" },
    }),
  ]);

  const rows: SurnameRow[] = groups.map((g) => ({
    id: g.id,
    nameEn: g.nameEn,
    nameGu: g.nameGu,
    count: g._count.families,
  }));

  const familyRows: DirectoryFamilyRow[] = families.map((f) => ({
    id: f.id,
    headNameEn: f.headNameEn,
    headNameGu: f.headNameGu,
    city: f.city,
    surnameEn: f.surnameEn,
    surnameGu: f.surnameGu,
    surnameGroupId: f.surnameGroupId,
    memberCount: f._count.familyMembers,
    otherMembers: f.familyMembers
      .filter((m) => !m.isHead)
      .map((m) => ({ fullNameEn: m.fullNameEn, fullNameGu: m.fullNameGu, relation: m.relation })),
  }));

  return <DirectoryClient rows={rows} families={familyRows} />;
}
