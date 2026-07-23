import { notFound } from "next/navigation";
import {
  AdminH2,
  AdminH3,
  AdminStat,
  AdminStatLabel,
  AdminTable,
  AdminTd,
  AdminTh,
  PillActive,
  PillExpired,
} from "@/components/admin/admin-ui";
import { getActiveCommunity } from "@/lib/tenant";
import { getAdminDashboard } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();
  const { stats, drive, adPerformance } = await getAdminDashboard(community.id);

  return (
    <>
      <AdminH2>Dashboard</AdminH2>

      <div className="mb-[26px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat>
          <div className="text-[28px] font-extrabold text-[#2A2620]">{stats.families}</div>
          <AdminStatLabel>Families</AdminStatLabel>
        </AdminStat>
        <AdminStat>
          <div className="text-[28px] font-extrabold text-[#2A2620]">{stats.members}</div>
          <AdminStatLabel>Members</AdminStatLabel>
        </AdminStat>
        <AdminStat highlight>
          <div className="text-[28px] font-extrabold text-[#A62A38]">{stats.pending}</div>
          <AdminStatLabel>Pending registrations</AdminStatLabel>
        </AdminStat>
        <AdminStat>
          <div className="text-[28px] font-extrabold text-[#2A2620]">{stats.activeAds}</div>
          <AdminStatLabel>Active ads</AdminStatLabel>
        </AdminStat>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          {drive ? (
            <>
              <AdminH3>
                Result drive — {drive.titleGu || drive.titleEn}{" "}
                {drive.isOpen ? <PillActive>Open</PillActive> : <PillExpired>Closed</PillExpired>}
              </AdminH3>
              {drive.standards.length > 0 ? (
                <AdminTable>
                  <thead>
                    <tr>
                      <AdminTh>Standard</AdminTh>
                      <AdminTh>Entries</AdminTh>
                      <AdminTh>Reviewed</AdminTh>
                    </tr>
                  </thead>
                  <tbody>
                    {drive.standards.map((row) => (
                      <tr key={row.standard}>
                        <AdminTd>{row.standard}</AdminTd>
                        <AdminTd>{row.entries}</AdminTd>
                        <AdminTd>{row.reviewed}</AdminTd>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              ) : (
                <p className="text-[13px] text-[#938C80]">No result entries yet.</p>
              )}
            </>
          ) : (
            <>
              <AdminH3>Result drive</AdminH3>
              <p className="text-[13px] text-[#938C80]">No result drive created yet.</p>
            </>
          )}
        </div>

        <div>
          <AdminH3>Ad performance (top)</AdminH3>
          {adPerformance.length > 0 ? (
            <AdminTable>
              <thead>
                <tr>
                  <AdminTh>Ad</AdminTh>
                  <AdminTh>Views</AdminTh>
                  <AdminTh>Clicks</AdminTh>
                </tr>
              </thead>
              <tbody>
                {adPerformance.map((row) => (
                  <tr key={row.id}>
                    <AdminTd>{row.name}</AdminTd>
                    <AdminTd>{row.views}</AdminTd>
                    <AdminTd>{row.clicks}</AdminTd>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          ) : (
            <p className="text-[13px] text-[#938C80]">No ads yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
