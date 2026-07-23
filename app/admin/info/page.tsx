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
