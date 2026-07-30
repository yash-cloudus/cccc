import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { getAdPriceTiersForCommunity } from "@/lib/tenant-data";
import { NewBannerClient, type BusinessOption } from "./new-banner-client";

export const dynamic = "force-dynamic";

export default async function NewBannerPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const session = await getSessionPayload();
  if (!session?.sub) redirect("/login?next=/ads/new");

  const [businesses, upiSetting, liveBanners, { tiers, defaultDuration }] = await Promise.all([
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
    // Paying upgrades a business's own ad row, so a business that already has a
    // premium banner cannot be paid for again — flag those before they pay.
    prisma.advertisement.findMany({
      where: {
        communityId: community.id,
        type: "premium",
        status: { in: ["PENDING", "ACTIVE"] },
        businessId: { not: null },
      },
      select: { businessId: true, status: true },
    }),
    getAdPriceTiersForCommunity(community.id),
  ]);

  const bannerByBusiness = new Map(liveBanners.map((a) => [a.businessId!, a.status]));

  const options: BusinessOption[] = businesses.map((b) => ({
    id: b.id,
    name: b.nameGu || b.nameEn,
    nameEn: b.nameEn,
    nameGu: b.nameGu,
    address: b.addressGu || b.address || "",
    phone: b.phone || "",
    isApproved: b.isApproved,
    bannerStatus:
      bannerByBusiness.get(b.id) === "ACTIVE"
        ? "active"
        : bannerByBusiness.get(b.id) === "PENDING"
          ? "pending"
          : "none",
  }));

  return (
    <NewBannerClient
      businesses={options}
      upiId={upiSetting?.value ?? ""}
      payeeName={community.nameGu || community.nameEn}
      tiers={tiers}
      defaultDuration={defaultDuration}
    />
  );
}
