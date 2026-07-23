import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommunityAdmins } from "@/lib/tenant-data";
import { AdminsClient, type AdminRow } from "./admins-client";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const admins = await getCommunityAdmins(community.id);
  const rows: AdminRow[] = admins.map((u) => ({
    id: u.id,
    name: u.profile?.fullNameEn || u.username || u.mobile,
    nameGu: u.profile?.fullNameGu ?? null,
    username: u.username,
    mobile: u.mobile,
    status: u.status,
    roles: u.roles
      .map((r) => r.role.name)
      .filter((r) => ["OWNER", "DATA_MANAGER", "CONTENT_MANAGER", "MODERATOR", "ADMIN"].includes(r)),
  }));

  return <AdminsClient initialRows={rows} />;
}
