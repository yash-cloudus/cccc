import { notFound } from "next/navigation";
import { AdminShellGate } from "@/components/admin/admin-shell-gate";
import { getActiveCommunity } from "@/lib/tenant";
import { getPendingCount } from "@/lib/tenant-data";
import { communityAdminHostLabel } from "@/lib/platform";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const pending = await getPendingCount(community.id);

  return (
    <AdminShellGate
      pendingCount={pending}
      communityNameEn={community.nameEn}
      communityNameGu={community.nameGu}
      logoText={community.logoText || community.nameGu || community.nameEn}
      logoUrl={community.logoUrl}
      adminHost={communityAdminHostLabel(community.slug)}
      primaryColor={community.primaryColor}
    >
      {children}
    </AdminShellGate>
  );
}
