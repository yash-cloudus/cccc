import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getBloodDonors } from "@/lib/tenant-data";
import { BloodGroupClient, type BloodDonorRow } from "./blood-group-client";

export const dynamic = "force-dynamic";

export default async function BloodGroupPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const donors = await getBloodDonors(community.id);
  const rows: BloodDonorRow[] = [];
  for (const d of donors) {
    if (!d.bloodGroup) continue;
    rows.push({
      fullNameEn: d.fullNameEn,
      fullNameGu: d.fullNameGu,
      mobile: d.mobile,
      mobileIso: d.mobileIso,
      bloodGroup: d.bloodGroup,
      currentlyAt: d.currentlyAt,
    });
  }

  return <BloodGroupClient rows={rows} />;
}
