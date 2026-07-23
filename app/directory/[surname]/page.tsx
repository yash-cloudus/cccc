import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamilies, getSurnameGroups } from "@/lib/tenant-data";
import { SurnameClient, type FamilyRow } from "./surname-client";

export const dynamic = "force-dynamic";

export default async function SurnameFamiliesPage({
  params,
}: {
  params: Promise<{ surname: string }>;
}) {
  const { surname } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const groups = await getSurnameGroups(community.id);
  const group = groups.find((g) => g.id === surname);
  if (!group) notFound();

  const families = await getFamilies(community.id, {
    status: "APPROVED",
    surnameGroupId: surname,
  });
  const rows: FamilyRow[] = families.map((f) => ({
    id: f.id,
    headNameEn: f.headNameEn,
    headNameGu: f.headNameGu,
    city: f.city,
    memberCount: f._count.familyMembers,
  }));

  return (
    <SurnameClient groupNameEn={group.nameEn} groupNameGu={group.nameGu} rows={rows} />
  );
}
