import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getEducationMembers } from "@/lib/tenant-data";
import { EducationClient, type EducationRow } from "./education-client";

export const dynamic = "force-dynamic";

export default async function EducationPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const members = await getEducationMembers(community.id);
  const rows: EducationRow[] = members.map((m) => ({
    id: m.id,
    fullNameEn: m.fullNameEn,
    fullNameGu: m.fullNameGu,
    education: m.education,
    occupation: m.occupation,
    currentlyAt: m.currentlyAt,
    mobile: m.mobile,
    showPhone: m.showPhone,
  }));

  return <EducationClient rows={rows} />;
}
