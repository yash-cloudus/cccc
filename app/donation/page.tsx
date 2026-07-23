import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { DonationClient } from "./donation-client";

export const dynamic = "force-dynamic";

export default async function DonationPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const setting = await prisma.setting.findUnique({
    where: { communityId_key: { communityId: community.id, key: "upiId" } },
  });

  return (
    <DonationClient
      communityNameEn={community.nameEn}
      communityNameGu={community.nameGu}
      upiId={setting?.value?.trim() || null}
      contactPhone={community.contactPhone}
    />
  );
}
