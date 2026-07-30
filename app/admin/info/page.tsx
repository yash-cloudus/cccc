import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import {
  getCommittees,
  getCommitteeMembers,
  getInfoSections,
  getVillageAreas,
} from "@/lib/tenant-data";
import { prisma } from "@/lib/prisma";
import { InfoClient } from "./info-client";

export const dynamic = "force-dynamic";

export default async function CommunityInfoPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [committees, members, infoSections, villages, upiSetting, profiles] = await Promise.all([
    getCommittees(community.id),
    getCommitteeMembers(community.id),
    getInfoSections(community.id),
    getVillageAreas(community.id),
    prisma.setting.findUnique({
      where: { communityId_key: { communityId: community.id, key: "upiId" } },
    }),
    // Offered in the committee member form's "Link an existing member" picker.
    prisma.profile.findMany({
      where: { user: { communityId: community.id } },
      select: {
        id: true,
        fullNameEn: true,
        fullNameGu: true,
        user: { select: { mobile: true } },
        family: { select: { surnameGu: true, surnameEn: true } },
      },
      orderBy: { fullNameEn: "asc" },
      take: 500,
    }),
  ]);

  // The app now models a single "મુખ્ય સમિતિ / Main Committee" per community
  // rather than admin-managed committee groups — self-heal if one is missing.
  const committee =
    committees[0] ??
    (await prisma.committee.create({
      data: { communityId: community.id, nameEn: "Main Committee", nameGu: "મુખ્ય સમિતિ", sortOrder: 0 },
    }));

  return (
    <InfoClient
      upiId={upiSetting?.value ?? ""}
      logoUrl={community.logoUrl ?? ""}
      bannerUrl={community.bannerUrl ?? ""}
      basic={{
        nameEn: community.nameEn ?? "",
        nameGu: community.nameGu ?? "",
        estd: community.estd ?? "",
        village: community.village ?? "",
        addressEn: community.addressEn ?? "",
        addressGu: community.addressGu ?? "",
        taluka: community.taluka ?? "",
        district: community.district ?? "",
        state: community.state ?? "",
        country: community.country ?? "",
        pincode: community.pincode ?? "",
        contactPhone: community.contactPhone ?? "",
        whatsapp: community.whatsapp ?? "",
        email: community.email ?? "",
        website: community.website ?? "",
        mapUrl: community.mapUrl ?? "",
        descGu: community.descGu ?? "",
        descEn: community.descEn ?? "",
      }}
      committee={{ id: committee.id, nameEn: committee.nameEn, nameGu: committee.nameGu, isActive: committee.isActive }}
      members={members.map((m) => ({
        id: m.id,
        profileId: m.profileId,
        nameOverride: m.nameOverride,
        nameGu: m.nameGu,
        roleEn: m.roleEn,
        roleGu: m.roleGu,
        phoneOverride: m.phoneOverride,
        whatsapp: m.whatsapp,
        email: m.email,
        descGu: m.descGu,
        showContact: m.showContact,
        isActive: m.isActive,
        sortOrder: m.sortOrder,
      }))}
      memberOptions={profiles.map((p) => ({
        id: p.id,
        nameEn: p.fullNameEn,
        nameGu: p.fullNameGu || "",
        mobile: p.user.mobile,
        family: p.family?.surnameGu || p.family?.surnameEn || "",
      }))}
      infoSections={infoSections.map((s) => ({
        id: s.id,
        titleEn: s.titleEn,
        titleGu: s.titleGu,
        bodyEn: s.bodyEn,
        bodyGu: s.bodyGu,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
      }))}
      villages={villages.map((v) => ({
        id: v.id,
        nameEn: v.nameEn,
        nameGu: v.nameGu,
        showPhones: v.showPhones,
        families: v._count.families,
      }))}
    />
  );
}
