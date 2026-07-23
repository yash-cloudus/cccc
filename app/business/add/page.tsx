import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getBusinessCategories } from "@/lib/tenant-data";
import { AddBusinessClient } from "./add-business-client";

export const dynamic = "force-dynamic";

export default async function AddBusinessPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const categories = await getBusinessCategories(community.id);
  return (
    <AddBusinessClient
      categories={categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameGu: c.nameGu }))}
    />
  );
}
