import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getAdminDashboard } from "@/lib/tenant-data";
import { AdminDashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();
  const { stats, recentFamilies, recentActivity } = await getAdminDashboard(community.id);

  return (
    <AdminDashboardClient
      stats={stats}
      recentFamilies={recentFamilies}
      recentActivity={recentActivity}
      communityNameGu={community.nameGu}
      communityNameEn={community.nameEn}
    />
  );
}
