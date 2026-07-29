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

  const [categories, familyMembers, contentManager] = await Promise.all([
    getBusinessCategories(community.id),
    // "સભ્ય પસંદ કરો" lists your own household — a business belongs to a member.
    familyId
      ? prisma.familyMember.findMany({
          where: { familyId, isDeceased: false },
          select: { id: true, fullNameEn: true, fullNameGu: true, mobile: true, relation: true },
          orderBy: { fullNameEn: "asc" },
        })
      : [],
    // Who to contact about a pending business — the admin who manages ads/directory,
    // falling back to the community owner (same pattern as the register page).
    prisma.user
      .findFirst({
        where: {
          communityId: community.id,
          status: "APPROVED",
          roles: { some: { role: { name: "CONTENT_MANAGER" } } },
        },
        include: { profile: true },
        orderBy: { createdAt: "asc" },
      })
      .then(async (cm) => {
        if (cm) return cm;
        return prisma.user.findFirst({
          where: {
            communityId: community.id,
            status: "APPROVED",
            roles: { some: { role: { name: "OWNER" } } },
          },
          include: { profile: true },
          orderBy: { createdAt: "asc" },
        });
      }),
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
      contactPerson={
        contentManager
          ? {
              nameEn: contentManager.profile?.fullNameEn || contentManager.username || contentManager.mobile,
              nameGu: contentManager.profile?.fullNameGu || null,
              mobile: contentManager.mobile,
            }
          : null
      }
    />
  );
}
