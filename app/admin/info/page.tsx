import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import {
  getCommittees,
  getInfoSections,
  getVillageAreas,
} from "@/lib/tenant-data";
import { prisma } from "@/lib/prisma";
import { InfoClient } from "./info-client";

export const dynamic = "force-dynamic";

export default async function CommunityInfoPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [committees, infoSections, villages, upiSetting] = await Promise.all([
    getCommittees(community.id),
    getInfoSections(community.id),
    getVillageAreas(community.id),
    prisma.setting.findUnique({
      where: { communityId_key: { communityId: community.id, key: "upiId" } },
    }),
  ]);

  return (
    <InfoClient
      showDirectoryPhones={community.showDirectoryPhones}
      upiId={upiSetting?.value ?? ""}
      logoUrl={community.logoUrl ?? ""}
      bannerUrl={community.bannerUrl ?? ""}
      primaryColor={community.primaryColor}
      secondaryColor={community.secondaryColor}
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
      }}
      committees={committees.map((c) => ({
        id: c.id,
        nameEn: c.nameEn,
        nameGu: c.nameGu,
        members: c._count.members,
      }))}
      infoSections={infoSections.map((s) => ({
        id: s.id,
        titleEn: s.titleEn,
        titleGu: s.titleGu,
        bodyEn: s.bodyEn,
        bodyGu: s.bodyGu,
        sortOrder: s.sortOrder,
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
