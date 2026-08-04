import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureParivarLockedSurname } from "@/lib/community-defaults";
import { getActiveCommunity } from "@/lib/tenant";
import {
  getDropdownOptions,
  getFamily,
  getOccupationTree,
  getSurnameGroups,
  getVillageAreas,
} from "@/lib/tenant-data";
import { cascadingFromStored } from "@/lib/cascading-occupation";
import { ReviewClient, type EditFamily } from "./review-client";

export const dynamic = "force-dynamic";

function ymd(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function ReviewRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; add?: string }>;
}) {
  const { id } = await params;
  const { from, add } = await searchParams;
  const fromFamilies = from === "families";
  const community = await getActiveCommunity();
  if (!community) notFound();

  const locked =
    community.type === "PARIVAR"
      ? await ensureParivarLockedSurname(prisma, community.id)
      : null;

  const [family, surnameGroups, occupationTree, villages, cities, relations] =
    await Promise.all([
      getFamily(community.id, id),
      getSurnameGroups(community.id),
      getOccupationTree(community.id),
      getVillageAreas(community.id),
      prisma.dropdownOption.findMany({
        where: { communityId: community.id, type: "city", isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      }),
      getDropdownOptions(community.id, "relationship"),
    ]);
  if (!family) notFound();

  const lockedSurname = locked
    ? { id: locked.id, nameEn: locked.nameEn, nameGu: locked.nameGu }
    : community.type === "PARIVAR" && surnameGroups[0]
      ? {
          id: surnameGroups[0].id,
          nameEn: surnameGroups[0].nameEn,
          nameGu: surnameGroups[0].nameGu,
        }
      : null;

  const data: EditFamily = {
    id: family.id,
    status: family.status,
    headNameEn: family.headNameEn,
    headNameGu: family.headNameGu || "",
    surnameEn: family.surnameEn,
    surnameGu: family.surnameGu || "",
    surnameGroupId: family.surnameGroupId,
    addressEn: family.addressEn || "",
    addressGu: family.addressGu || "",
    city: family.city || "",
    nativePlace: family.nativePlace || "",
    email: family.email || "",
    villageAreaId: family.villageAreaId || "",
    livesOutsideVillage: !family.villageAreaId && community.type === "GAM",
    businessGu: family.businessGu || "",
    nativeElderNameEn: family.nativeElderNameEn || "",
    nativeElderNameGu: family.nativeElderNameGu || "",
    nativeElderPhone: family.nativeElderPhone || "",
    latitude: family.latitude,
    longitude: family.longitude,
    members: family.familyMembers.map((m) => ({
      id: m.id,
      isNew: false,
      fullNameEn: m.fullNameEn,
      fullNameGu: m.fullNameGu || "",
      relation: m.relation || "",
      gender: m.gender || "",
      mobile: m.mobile || "",
      dateOfBirth: ymd(m.dateOfBirth),
      bloodGroup: m.bloodGroup || "",
      // Falls back to the family's place for members registered before it moved
      // onto the member record.
      currentlyAt: m.currentlyAt || family.city || "",
      hasWhatsApp: m.hasWhatsApp,
      whatsapp: m.whatsapp || "",
      isHead: m.isHead,
      ...cascadingFromStored(occupationTree, {
        occupation: m.occupation,
        occupationOther: m.occupationOther,
        education: m.education,
        course: m.course,
        specialization: m.specialization,
      }),
    })),
  };

  return (
    <ReviewClient
      communityType={community.type}
      lockedSurname={lockedSurname}
      family={data}
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
      backHref={fromFamilies ? "/admin/families" : "/admin/queue"}
      fromFamilies={fromFamilies}
      autoAddMember={add === "1"}
    />
  );
}
