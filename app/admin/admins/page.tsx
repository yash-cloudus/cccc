import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { getCommunityAdmins } from "@/lib/tenant-data";
import { AdminsClient, type AdminRow, type MemberOption } from "./admins-client";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [admins, session, familyMembers] = await Promise.all([
    getCommunityAdmins(community.id),
    getSessionPayload(),
    // Members offered in the "1 · MEMBER" picker of the Add admin form.
    prisma.familyMember.findMany({
      where: { family: { communityId: community.id } },
      select: {
        id: true,
        fullNameEn: true,
        fullNameGu: true,
        mobile: true,
        family: { select: { surnameGu: true, surnameEn: true } },
      },
      orderBy: { fullNameEn: "asc" },
      take: 500,
    }),
  ]);

  const rows: AdminRow[] = admins.map((u) => ({
    id: u.id,
    name: u.profile?.fullNameEn || u.username || u.mobile,
    nameGu: u.profile?.fullNameGu ?? null,
    username: u.username,
    mobile: u.mobile,
    status: u.status,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    roles: u.roles
      .map((r) => r.role.name)
      .filter((r) => ["OWNER", "DATA_MANAGER", "CONTENT_MANAGER", "MODERATOR", "ADMIN"].includes(r)),
  }));

  const members: MemberOption[] = familyMembers.map((m) => ({
    id: m.id,
    name: m.fullNameGu || m.fullNameEn,
    mobile: m.mobile || "",
    surname: m.family.surnameGu || m.family.surnameEn || "",
  }));

  return (
    <AdminsClient
      initialRows={rows}
      currentUserId={session?.sub ?? null}
      members={members}
    />
  );
}
