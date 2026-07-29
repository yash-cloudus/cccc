import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getOccupationTree } from "@/lib/tenant-data";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const occupationTree = await getOccupationTree(community.id);

  return <ProfileClient occupationTree={occupationTree} />;
}
