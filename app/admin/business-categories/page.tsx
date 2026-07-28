import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { BusinessCategoriesClient, type CategoryRow } from "./business-categories-client";

export const dynamic = "force-dynamic";

export default async function BusinessCategoriesPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const categories = await prisma.businessCategory.findMany({
    where: { communityId: community.id },
    include: { _count: { select: { businesses: true } } },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameGu: c.nameGu,
    inUse: c._count.businesses,
  }));

  return <BusinessCategoriesClient initialRows={rows} />;
}
