import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getEducationMembers, getOccupationTree } from "@/lib/tenant-data";
import { findOccupationNode, isStudentOccupation } from "@/lib/occupation-defaults";
import { EducationClient, type EducationRow } from "./education-client";

export const dynamic = "force-dynamic";

export default async function EducationPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [members, tree] = await Promise.all([
    getEducationMembers(community.id),
    getOccupationTree(community.id),
  ]);

  // Members store education as a plain label — whichever language the form was
  // in, or a free-typed "Other". Resolve each back to its master node so both
  // languages and the admin's ordering survive, and so "Std 10" and "ધોરણ 10"
  // land in the same group instead of two.
  const levels =
    tree.find((r) => isStudentOccupation(r.nameEn, r.nameGu))?.children ?? [];

  const rows: EducationRow[] = members.flatMap((m) => {
    const stored = (m.education ?? "").trim();
    if (!stored) return [];
    const node = findOccupationNode(levels, stored);
    return [
      {
        id: m.id,
        fullNameEn: m.fullNameEn,
        fullNameGu: m.fullNameGu,
        degreeEn: node?.nameEn ?? stored,
        degreeGu: node?.nameGu ?? null,
        degreeOrder: node?.sortOrder ?? 9999,
        course: m.course,
        occupation: m.occupation,
        currentlyAt: m.currentlyAt,
        mobile: m.mobile,
        showPhone: m.showPhone,
      },
    ];
  });

  return <EducationClient rows={rows} />;
}
