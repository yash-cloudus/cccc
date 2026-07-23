import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamilies, getCities } from "@/lib/tenant-data";
import { QueueClient, type QueueRow } from "./queue-client";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function RegistrationQueuePage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [families, cities] = await Promise.all([
    getFamilies(community.id),
    getCities(community.id),
  ]);

  const rows: QueueRow[] = families.map((f) => ({
    id: f.id,
    head: f.headNameGu || f.headNameEn,
    surname: f.surnameGu || f.surnameEn,
    city: f.city || "—",
    members: f._count.familyMembers,
    submitted: fmtDate(f.submittedAt),
    status: f.status,
  }));

  return <QueueClient initialRows={rows} cities={cities} />;
}
