import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamilies, getDropdownOptions, getOccupationTree, getSurnameGroups } from "@/lib/tenant-data";
import { FamiliesClient, type FamilyRow } from "./families-client";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [families, surnameGroups, relationOptions, occupationTree] = await Promise.all([
    getFamilies(community.id),
    getSurnameGroups(community.id),
    getDropdownOptions(community.id, "relationship"),
    getOccupationTree(community.id),
  ]);

  const rows: FamilyRow[] = families.map((f) => ({
    id: f.id,
    headEn: f.headNameEn,
    headGu: f.headNameGu || "",
    surnameEn: f.surnameEn,
    surnameGu: f.surnameGu || "",
    city: f.city || "—",
    mobile: f.headUser?.mobile || f.familyMembers[0]?.mobile || "",
    status: f.status,
    members: f._count.familyMembers,
  }));

  return (
    <FamiliesClient
      initialRows={rows}
      surnameGroups={surnameGroups.map((s) => ({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu }))}
      relations={relationOptions.filter((o) => o.isActive).map((o) => o.nameGu || o.nameEn)}
      occupationTree={occupationTree}
    />
  );
}
