import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getBusinesses, getBusinessCategories } from "@/lib/tenant-data";
import { BusinessClient, type BusinessRow, type CategoryRow } from "./business-client";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [businesses, categories] = await Promise.all([
    getBusinesses(community.id),
    getBusinessCategories(community.id),
  ]);

  const bizRows: BusinessRow[] = businesses.map((b) => ({
    id: b.id,
    nameEn: b.nameEn,
    nameGu: b.nameGu,
    description: b.description,
    phone: b.phone,
    address: b.address,
    city: b.city,
    website: b.website,
    categoryId: b.category?.id ?? null,
    categoryNameEn: b.category?.nameEn ?? null,
    categoryNameGu: b.category?.nameGu ?? null,
  }));

  const catRows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameGu: c.nameGu,
  }));

  return <BusinessClient businesses={bizRows} categories={catRows} />;
}
