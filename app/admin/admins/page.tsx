import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ISO } from "@/lib/phone";
import { getActiveCommunity, getSessionPayload } from "@/lib/tenant";
import { getCommunityAdmins } from "@/lib/tenant-data";
import { AdminsClient } from "./admins-client";
import type { AdminRow, MemberOption } from "./admin-roles";

export const dynamic = "force-dynamic";

/** Stored menu keys; null (never saved) shows as "follows its role template". */
function parseMenus(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

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
        mobileIso: true,
        family: { select: { surnameGu: true, surnameEn: true } },
      },
      orderBy: { fullNameEn: "asc" },
      take: 500,
    }),
  ]);

  const familyLabel = (surname: string) => (surname ? `${surname} પરિવાર` : "");

  const rows: AdminRow[] = admins.map((u) => {
    const surname = u.profile?.family?.surnameGu || u.profile?.family?.surnameEn || "";
    return {
      id: u.id,
      name: u.profile?.fullNameEn || u.username || u.mobile,
      nameGu: u.profile?.fullNameGu ?? null,
      username: u.username,
      mobile: u.mobile,
      mobileIso: u.mobileIso,
      family: familyLabel(surname) || null,
      surname: surname || null,
      showPhone: u.profile?.showPhone ?? true,
      menus: parseMenus(u.menusJson),
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      roles: u.roles
        .map((r) => r.role.name)
        .filter((r) =>
          ["OWNER", "DATA_MANAGER", "CONTENT_MANAGER", "MODERATOR", "ADMIN"].includes(r),
        ),
    };
  });

  const members: MemberOption[] = familyMembers.map((m) => {
    const surname = m.family.surnameGu || m.family.surnameEn || "";
    return {
      id: m.id,
      name: m.fullNameGu || m.fullNameEn,
      mobile: m.mobile || "",
      mobileIso: m.mobileIso || DEFAULT_ISO,
      surname,
      family: familyLabel(surname),
    };
  });

  return (
    <AdminsClient initialRows={rows} currentUserId={session?.sub ?? null} members={members} />
  );
}
