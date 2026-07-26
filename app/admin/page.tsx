import { notFound } from "next/navigation";
import Link from "next/link";
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

type StatKey =
  | "families"
  | "members"
  | "pending"
  | "pendingUpdates"
  | "totalAds"
  | "premiumAds"
  | "generalAds"
  | "pendingAds"
  | "activeAds"
  | "expiredAds"
  | "draftAds"
  | "rejectedAds"
  | "newsPosts"
  | "albums";

/** Stat grid — same set and order as Admin.dc.html's dashboard. */
const CARDS: { key: StatKey; label: string; color?: string; highlight?: boolean }[] = [
  { key: "families", label: "Families" },
  { key: "members", label: "Members", color: "var(--success)" },
  { key: "pending", label: "Pending registrations", color: "var(--brand)", highlight: true },
  { key: "pendingUpdates", label: "Pending update requests", color: "var(--warn)", highlight: true },
  { key: "totalAds", label: "Total advertisements", color: "var(--warn)" },
  { key: "premiumAds", label: "Premium advertisements", color: "var(--violet)" },
  { key: "generalAds", label: "General advertisements", color: "var(--info)" },
  { key: "pendingAds", label: "Pending ad approvals", color: "var(--warn)", highlight: true },
  { key: "activeAds", label: "Active advertisements", color: "var(--success)" },
  { key: "expiredAds", label: "Expired advertisements", color: "var(--danger)" },
  { key: "draftAds", label: "Draft advertisements" },
  { key: "rejectedAds", label: "Rejected advertisements", color: "var(--danger)" },
  { key: "newsPosts", label: "News posts" },
  { key: "albums", label: "Gallery albums" },
];

const QUICK_ACTIONS = [
  { href: "/admin/families", label: "+ Add family" },
  { href: "/admin/queue", label: "✓ Review registrations" },
  { href: "/admin/news", label: "+ New post" },
  { href: "/admin/gallery", label: "+ Create album" },
  { href: "/admin/results", label: "Result drive" },
];

export default async function AdminDashboardPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();
  const { stats, drive, adPerformance } = await getAdminDashboard(community.id);

  return (
    <>
      <AdminH2>Dashboard</AdminH2>

      <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {CARDS.map((c) => {
          const value = stats[c.key];
          return (
            <AdminStat key={c.key} highlight={c.highlight && value > 0}>
              <div
                className="text-[28px] font-extrabold"
                style={{ color: c.color ?? "var(--ink)" }}
              >
                {value}
              </div>
              <AdminStatLabel>{c.label}</AdminStatLabel>
            </AdminStat>
          );
        })}
      </div>

      <div className="mb-[26px] flex flex-wrap gap-2.5">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-[18px] py-[11px] text-[13px] font-bold text-[var(--ink-mid)] hover:border-[var(--brand-border)] hover:text-[var(--brand)]"
          >
            {a.label}
          </Link>
        ))}
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
                <p className="text-[13px] text-[var(--faint)]">No result entries yet.</p>
              )}
            </>
          ) : (
            <>
              <AdminH3>Result drive</AdminH3>
              <p className="text-[13px] text-[var(--faint)]">No result drive created yet.</p>
            </>
          )}
        </div>

        <div>
          <AdminH3>Ad performance</AdminH3>
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
            <p className="text-[13px] text-[var(--faint)]">No ads yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
