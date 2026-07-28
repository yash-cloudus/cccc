import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureParivarLockedSurname } from "@/lib/community-defaults";
import { getActiveCommunity } from "@/lib/tenant";
import {
  getDropdownOptions,
  getOccupationTree,
  getSurnameGroups,
  getVillageAreas,
} from "@/lib/tenant-data";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const locked =
    community.type === "PARIVAR"
      ? await ensureParivarLockedSurname(prisma, community.id)
      : null;

  const [surnameGroups, villages, cities, relations, occupationTree, contactPerson] = await Promise.all([
    getSurnameGroups(community.id),
    getVillageAreas(community.id),
    prisma.dropdownOption.findMany({
      where: { communityId: community.id, type: "city", isActive: true, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    }),
    getDropdownOptions(community.id, "relationship"),
    getOccupationTree(community.id),
    prisma.user.findFirst({
      where: {
        communityId: community.id,
        status: "APPROVED",
        roles: { some: { role: { name: "DATA_MANAGER" } } },
      },
      include: { profile: true, roles: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    }).then(async (dm) => {
      if (dm) return dm;
      return prisma.user.findFirst({
        where: {
          communityId: community.id,
          status: "APPROVED",
          roles: { some: { role: { name: "OWNER" } } },
        },
        include: { profile: true, roles: { include: { role: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),
  ]);

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
    <RegisterClient
      communityType={community.type}
      lockedSurname={lockedSurname}
      surnameGroups={surnameGroups.map((s) => ({
        id: s.id,
        nameEn: s.nameEn,
        nameGu: s.nameGu,
      }))}
      cities={cities.map((c) => ({ id: c.id, nameEn: c.nameEn, nameGu: c.nameGu }))}
      villages={villages.map((v) => ({ id: v.id, nameEn: v.nameEn, nameGu: v.nameGu }))}
      relations={relations
        .filter((o) => o.isActive)
        .map((o) => ({ nameEn: o.nameEn, nameGu: o.nameGu }))}
      occupationTree={occupationTree}
      contactPerson={
        contactPerson
          ? {
              nameEn: contactPerson.profile?.fullNameEn || contactPerson.username || contactPerson.mobile,
              nameGu: contactPerson.profile?.fullNameGu || null,
              mobile: contactPerson.mobile,
              role:
                contactPerson.roles.some((r) => r.role.name === "DATA_MANAGER")
                  ? "DATA_MANAGER"
                  : "OWNER",
            }
          : null
      }
    />
  );
}
