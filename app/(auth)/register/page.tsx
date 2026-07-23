import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups, getVillageAreas } from "@/lib/tenant-data";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [surnameGroups, villages] = await Promise.all([
    getSurnameGroups(community.id),
    getVillageAreas(community.id),
  ]);

  return (
    <RegisterClient
      surnameGroups={surnameGroups.map((s) => ({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu }))}
      villages={villages.map((v) => ({ id: v.id, nameEn: v.nameEn, nameGu: v.nameGu }))}
    />
  );
}
