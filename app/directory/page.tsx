import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups } from "@/lib/tenant-data";
import { getParivarLockedSurname } from "@/lib/community-defaults";
import { DirectoryClient, type SurnameRow } from "./directory-client";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  // A Parivar community IS one surname — picking a group first would just be a
  // single-tile screen for nothing. Go straight to that family list.
  if (community.type === "PARIVAR") {
    const locked = await getParivarLockedSurname(prisma, community.id);
    if (locked) redirect(`/directory/${locked.id}`);
  }

  const groups = await getSurnameGroups(community.id);
  const rows: SurnameRow[] = groups.map((g) => ({
    id: g.id,
    nameEn: g.nameEn,
    nameGu: g.nameGu,
    count: g._count.families,
  }));

  return <DirectoryClient rows={rows} />;
}
