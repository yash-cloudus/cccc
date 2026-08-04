import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamilies, getCities } from "@/lib/tenant-data";
import { QueueClient, type QueueRow, type UpdateRequestRow } from "./queue-client";

export const dynamic = "force-dynamic";

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
    headEn: f.headNameEn,
    headGu: f.headNameGu || null,
    photoUrl: f.familyMembers[0]?.photoUrl || null,
    surnameEn: f.surnameEn,
    surnameGu: f.surnameGu || null,
    city: f.city || "—",
    members: f._count.familyMembers,
    submitted: f.submittedAt.toISOString(),
    status: f.status,
    rejectReason: f.rejectReason || null,
  }));

  const updateRows: UpdateRequestRow[] = updateRequests.map((u) => {
    let changes: UpdateRequestRow["changes"] = [];
    try {
      const parsed = JSON.parse(u.changes || "[]");
      if (Array.isArray(parsed)) changes = parsed;
    } catch {
      /* malformed payload — show the row with an empty diff rather than crash */
    }
    const memberEn = u.member?.fullNameEn || u.family?.headNameEn || "—";
    const memberGu = u.member?.fullNameGu || u.family?.headNameGu || null;
    return {
      id: u.id,
      memberEn,
      memberGu,
      surnameEn: u.family?.surnameEn || "—",
      surnameGu: u.family?.surnameGu || null,
      changes,
      submitted: u.submittedAt.toISOString(),
      status: u.status,
      rejectReason: u.rejectReason,
    };
  });

  return <QueueClient initialRows={rows} cities={cities} updateRequests={updateRows} />;
}
