import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups } from "@/lib/tenant-data";
import { DirectoryClient, type SurnameRow } from "./directory-client";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const groups = await getSurnameGroups(community.id);
  const rows: SurnameRow[] = groups.map((g) => ({
    id: g.id,
    nameEn: g.nameEn,
    nameGu: g.nameGu,
    count: g._count.families,
  }));

  return <DirectoryClient rows={rows} />;
}
