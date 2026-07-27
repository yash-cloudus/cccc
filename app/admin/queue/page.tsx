import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamilies, getCities } from "@/lib/tenant-data";
import { QueueClient, type QueueRow, type UpdateRequestRow } from "./queue-client";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function RegistrationQueuePage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [families, cities, updateRequests] = await Promise.all([
    getFamilies(community.id),
    getCities(community.id),
    prisma.profileUpdateRequest.findMany({
      where: { communityId: community.id },
      include: {
        family: { select: { headNameEn: true, headNameGu: true, surnameEn: true, surnameGu: true } },
        member: { select: { fullNameEn: true, fullNameGu: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
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

  const updateRows: UpdateRequestRow[] = updateRequests.map((u) => {
    let changes: UpdateRequestRow["changes"] = [];
    try {
      const parsed = JSON.parse(u.changes || "[]");
      if (Array.isArray(parsed)) changes = parsed;
    } catch {
      /* malformed payload — show the row with an empty diff rather than crash */
    }
    return {
      id: u.id,
      member:
        u.member?.fullNameGu ||
        u.member?.fullNameEn ||
        u.family?.headNameGu ||
        u.family?.headNameEn ||
        "—",
      surname: u.family?.surnameGu || u.family?.surnameEn || "—",
      changes,
      submitted: fmtDate(u.submittedAt),
      status: u.status,
      rejectReason: u.rejectReason,
    };
  });

  return <QueueClient initialRows={rows} cities={cities} updateRequests={updateRows} />;
}
