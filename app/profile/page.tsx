import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getDropdownOptions, getOccupationTree } from "@/lib/tenant-data";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [occupationTree, relations] = await Promise.all([
    getOccupationTree(community.id),
    getDropdownOptions(community.id, "relationship"),
  ]);

  return (
    <ProfileClient
      occupationTree={occupationTree}
      relations={relations
        .filter((o) => o.isActive)
        .map((o) => ({ nameEn: o.nameEn, nameGu: o.nameGu }))}
    />
  );
}
