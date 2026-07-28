import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { NewBannerClient, type BusinessOption } from "./new-banner-client";

export const dynamic = "force-dynamic";

export default async function NewBannerPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const session = await getSessionPayload();
  if (!session?.sub) redirect("/login?next=/ads/new");

  const [businesses, upiSetting] = await Promise.all([
    // Only your own businesses — a banner carries that business's contact info.
    prisma.business.findMany({
      where: { communityId: community.id, userId: session.sub },
      select: {
        id: true,
        nameEn: true,
        nameGu: true,
        address: true,
        addressGu: true,
        phone: true,
        isApproved: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.setting.findUnique({
      where: { communityId_key: { communityId: community.id, key: "upiId" } },
    }),
  ]);

  const options: BusinessOption[] = businesses.map((b) => ({
    id: b.id,
    name: b.nameGu || b.nameEn,
    address: b.addressGu || b.address || "",
    phone: b.phone || "",
    isApproved: b.isApproved,
  }));

  return (
    <NewBannerClient
      businesses={options}
      upiId={upiSetting?.value ?? ""}
      payeeName={community.nameGu || community.nameEn}
    />
  );
}
