import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamilies, getSurnameGroups } from "@/lib/tenant-data";
import { FamiliesClient, type FamilyRow } from "./families-client";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [families, surnameGroups] = await Promise.all([
    getFamilies(community.id, { status: "APPROVED" }),
    getSurnameGroups(community.id),
  ]);

  const rows: FamilyRow[] = families.map((f) => ({
    id: f.id,
    headEn: f.headNameEn,
    headGu: f.headNameGu || "",
    surnameEn: f.surnameEn,
    surnameGu: f.surnameGu || "",
    city: f.city || "—",
    members: f._count.familyMembers,
  }));

  return (
    <FamiliesClient
      initialRows={rows}
      surnameGroups={surnameGroups.map((s) => ({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu }))}
    />
  );
}
