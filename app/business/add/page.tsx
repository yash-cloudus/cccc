import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getMyFamilyId, getSessionPayload } from "@/lib/tenant";
import { getBusinessCategories } from "@/lib/tenant-data";
import { AddBusinessClient, type MemberOption } from "./add-business-client";

export const dynamic = "force-dynamic";

export default async function AddBusinessPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const session = await getSessionPayload();
  const familyId = session?.sub ? await getMyFamilyId(session.sub) : null;

  const [categories, familyMembers] = await Promise.all([
    getBusinessCategories(community.id),
    // "સભ્ય પસંદ કરો" lists your own household — a business belongs to a member.
    familyId
      ? prisma.familyMember.findMany({
          where: { familyId, isDeceased: false },
          select: { id: true, fullNameEn: true, fullNameGu: true, mobile: true, relation: true },
          orderBy: { fullNameEn: "asc" },
        })
      : [],
  ]);

  const members: MemberOption[] = familyMembers.map((m) => ({
    id: m.id,
    name: m.fullNameGu || m.fullNameEn,
    nameEn: m.fullNameEn,
    mobile: m.mobile || "",
    relation: m.relation || "",
  }));

  return (
    <AddBusinessClient
      categories={categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameGu: c.nameGu }))}
      members={members}
      signedIn={Boolean(session?.sub)}
    />
  );
}
