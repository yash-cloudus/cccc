import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureParivarLockedSurname } from "@/lib/community-defaults";
import { getActiveCommunity, getSessionPayload, isCommunityAdmin } from "@/lib/tenant";
import {
  getFamilies,
  getDropdownOptions,
  getOccupationTree,
  getSurnameGroups,
  getVillageAreas,
} from "@/lib/tenant-data";
import { getNriCities } from "@/lib/nri";
import { FamiliesClient, type FamilyRow } from "./families-client";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const locked =
    community.type === "PARIVAR"
      ? await ensureParivarLockedSurname(prisma, community.id)
      : null;

  const [families, surnameGroups, relationOptions, nriCities, occupationTree, villages, cities, session] =
    await Promise.all([
      getFamilies(community.id),
      getSurnameGroups(community.id),
      getDropdownOptions(community.id, "relationship"),
      getNriCities(prisma, community.id),
      getOccupationTree(community.id),
      getVillageAreas(community.id),
      prisma.dropdownOption.findMany({
        where: { communityId: community.id, type: "city", isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      }),
      getSessionPayload(),
    ]);

  const rows: FamilyRow[] = families.map((f) => ({
    id: f.id,
    headEn: f.headNameEn,
    headGu: f.headNameGu || "",
    photoUrl: f.familyMembers[0]?.photoUrl || null,
    surnameEn: f.surnameEn,
    surnameGu: f.surnameGu || "",
    city: f.city || "—",
    mobile: f.headUser?.mobile || f.familyMembers[0]?.mobile || "",
    status: f.status,
    members: f._count.familyMembers,
  }));

  const lockedSurname = locked
    ? { id: locked.id, nameEn: locked.nameEn, nameGu: locked.nameGu }
    : community.type === "PARIVAR" && surnameGroups[0]
      ? {
          id: surnameGroups[0].id,
          nameEn: surnameGroups[0].nameEn,
          nameGu: surnameGroups[0].nameGu,
        }
      : null;

  return (
    <FamiliesClient
      communityType={community.type}
      lockedSurname={lockedSurname}
      initialRows={rows}
      surnameGroups={surnameGroups.map((s) => ({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu }))}
      cities={cities.map((c) => ({ id: c.id, nameEn: c.nameEn, nameGu: c.nameGu }))}
      villages={villages.map((v) => ({ id: v.id, nameEn: v.nameEn, nameGu: v.nameGu }))}
      relations={relationOptions
        .filter((o) => o.isActive)
        .map((o) => ({ nameEn: o.nameEn, nameGu: o.nameGu }))}
      occupationTree={occupationTree}
      nriCities={nriCities}
      canDelete={isCommunityAdmin(session)}
    />
  );
}
