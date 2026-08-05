"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Users,
  User,
  Newspaper,
  Megaphone,
  Trophy,
  Image as ImageIcon,
  Clock,
  Ban,
  Calendar,
  FileText,
  ShieldCheck,
  UserPlus,
  ClipboardList,
  UserPen,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Activity,
} from "lucide-react";
import type { getAdminDashboard } from "@/lib/tenant-data";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

// ─── Stats Card ──────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  color,
  icon,
  trend,
  trendLabel,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#EAE4D8]/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-3 sm:p-4 transition-all hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-[#5A6A60]">{label}</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-semibold ${trend >= 0 ? 'text-[#2E7D32]' : 'text-red-500'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
              <span className="text-[10px] text-[#9A9288]">{trendLabel || 'vs last month'}</span>
            </div>
          )}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}15`, color: color }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action ────────────────────────────────────────────────────────────

function QuickAction({
  href,
  icon,
  label,
  sublabel,
  bg,
  iconColor,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  bg: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-[#EAE4D8]/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-3 sm:p-4 transition-all hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-[#D4C9B8]"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all group-hover:scale-105"
          style={{ background: bg, color: iconColor }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors">
            {label}
          </h3>
          <p className="text-[10px] text-[#9A9288] mt-0.5">{sublabel}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-[#C0B8AD] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

// ─── Summary Widget ──────────────────────────────────────────────────────────

function SummaryWidget({
  value,
  label,
  icon,
  iconBg,
  iconColor,
  href,
  viewLabel,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
  viewLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-transparent p-3 sm:p-4 transition-all hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-[#D4C9B8]"
      style={{ background: iconBg, border: '1px solid transparent' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm transition-all group-hover:scale-105"
          style={{ color: iconColor }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold leading-none" style={{ color: iconColor }}>
            {value}
          </p>
          <p className="text-[11px] font-medium text-[var(--ink-mid)] mt-1 truncate">{label}</p>
        </div>
        <div className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-[var(--brand)] whitespace-nowrap">
          {viewLabel} <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

// ─── Recent Registration Item ──────────────────────────────────────────────

function RecentRegistrationItem({
  family,
  lang,
  fmtDate,
  t,
}: {
  /** One row of `getAdminDashboard().recentFamilies` — typed from the source so
   *  a rename there is caught here rather than rendering "undefined". */
  family: Dashboard["recentFamilies"][number];
  lang: string;
  fmtDate: (iso: string) => string;
  t: (key: AdminKey) => string;
}) {
  const headName = lang === "en" ? family.headNameEn : family.headNameGu;
  
  return (
    <Link
      href={`/admin/families/${family.id}`}
      className="flex items-center gap-3 py-2.5 border-b border-[#F0EAE0] last:border-0 hover:bg-[#FAFAF8] rounded-lg px-2 -mx-2 transition-all group"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
        <Users className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-bold text-[var(--ink)] truncate">
          {headName} {family.surname || ""}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[#9A9288] whitespace-nowrap">{fmtDate(family.submittedAt)}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-[#EAE4D8] shrink-0"></span>
          <span className="text-[10px] text-[#9A9288] whitespace-nowrap">{family.memberCount} members</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button className="rounded-lg p-1 hover:bg-[#EAE4D8] transition-colors">
          <Eye className="h-3 w-3 text-[#5A6A60]" />
        </button>
        <button className="p-1 rounded-lg hover:bg-[#EAE4D8] transition-colors">
          <Edit className="h-3 w-3 text-[#5A6A60]" />
        </button>
      </div>
    </Link>
  );
}

// ─── Pending Task Item ──────────────────────────────────────────────────────

function PendingTaskItem({
  icon,
  label,
  count,
  href,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-2.5 border-b border-[#F0EAE0] last:border-0 hover:bg-[#FAFAF8] rounded-lg px-2 -mx-2 transition-all group"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <span className="flex-1 text-sm font-semibold text-[var(--ink)] truncate">{label}</span>
      <span className="shrink-0 text-sm font-bold" style={{ color: iconColor }}>{count}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#C0B8AD]" />
    </Link>
  );
}

// ─── Activity Item ──────────────────────────────────────────────────────────

function ActivityItem({
  type,
  labelKey,
  name,
  familySuffix,
  relativeTime,
  t,
}: {
  type: string;
  labelKey: AdminKey;
  name: string;
  familySuffix?: boolean;
  relativeTime: string;
  t: (key: AdminKey) => string;
}) {
  const map: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    family: { bg: "#E8F5E9", color: "#2E7D32", icon: <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} /> },
    news: { bg: "#E3F2FD", color: "#1565C0", icon: <Newspaper className="h-3.5 w-3.5" strokeWidth={2.5} /> },
    ad: { bg: "#FFF3E0", color: "#E65100", icon: <Megaphone className="h-3.5 w-3.5" strokeWidth={2.5} /> },
    result: { bg: "#F3E5F5", color: "#6A1B9A", icon: <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} /> },
  };
  const style = map[type] ?? { bg: "#F5F5F5", color: "#616161", icon: <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> };

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#F0EAE0] last:border-0 hover:bg-[#FAFAF8] rounded-lg px-2 -mx-2 transition-all group">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105"
        style={{ background: style.bg, color: style.color }}
      >
        {style.icon}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-bold text-[var(--ink)] truncate">{t(labelKey)}</p>
        <p className="text-[10px] font-medium text-[#9A9288] mt-0.5 truncate">
          {name}{familySuffix ? ` ${t("dash.familySuffix")}` : ""}
        </p>
      </div>
      <span className="text-[10px] font-semibold text-[#B0A898] bg-[#F7F4EF] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
        {relativeTime}
      </span>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export function AdminDashboardClient({
  stats,
  recentFamilies,
  recentActivity,
  communityNameGu,
  communityNameEn,
}: {
  stats: Dashboard["stats"];
  recentFamilies: Dashboard["recentFamilies"];
  recentActivity: Dashboard["recentActivity"];
  communityNameGu: string | null;
  communityNameEn: string;
}) {
  const { t, tf, lang, locale } = useAdminT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const communityName =
    (lang === "en" ? communityNameEn : communityNameGu) || communityNameGu || communityNameEn;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const relativeTime = (iso: string): string => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 2) return t("time.now");
    if (mins < 60) return tf("time.minsAgo", { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return tf("time.hrsAgo", { n: hrs });
    const days = Math.floor(hrs / 24);
    if (days === 1) return t("time.yesterday");
    if (days < 7) return tf("time.daysAgo", { n: days });
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full overflow-hidden">
      <div className="w-full max-w-full space-y-3 px-2.5 py-2.5 sm:px-4 sm:py-3 lg:px-6">

        {/* ─── Stats Grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <StatCard
            value={stats.families}
            label={t("dash.statFamilies")}
            color="#2E7D32"
            icon={<Users className="h-4 w-4" strokeWidth={2.5} />}
            trend={5}
          />
          <StatCard
            value={stats.members}
            label={t("dash.statMembers")}
            color="#1565C0"
            icon={<User className="h-4 w-4" strokeWidth={2.5} />}
            trend={8}
          />
          <StatCard
            value={stats.pending}
            label={t("dash.statPending")}
            color="#E65100"
            icon={<ClipboardList className="h-4 w-4" strokeWidth={2.5} />}
          />
          <StatCard
            value={stats.pendingUpdates}
            label={t("dash.statPendingUpdates")}
            color="#6A1B9A"
            icon={<UserPen className="h-4 w-4" strokeWidth={2.5} />}
          />
        </div>

        {/* ─── Quick Actions ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold text-[var(--ink)] mb-2.5">
            {t("dash.quickActions")}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <QuickAction
              href="/admin/families"
              icon={<Users className="h-4 w-4" strokeWidth={2.5} />}
              label={t("dash.qaFamily")}
              sublabel={t("dash.qaFamilySub")}
              bg="#E8F5E9"
              iconColor="#2E7D32"
            />
            <QuickAction
              href="/admin/news"
              icon={<Newspaper className="h-4 w-4" strokeWidth={2.5} />}
              label={t("dash.qaNews")}
              sublabel={t("dash.qaNewsSub")}
              bg="#E3F2FD"
              iconColor="#1565C0"
            />
            <QuickAction
              href="/admin/ads"
              icon={<Megaphone className="h-4 w-4" strokeWidth={2.5} />}
              label={t("dash.qaAd")}
              sublabel={t("dash.qaAdSub")}
              bg="#FFF3E0"
              iconColor="#E65100"
            />
            <QuickAction
              href="/admin/results"
              icon={<Trophy className="h-4 w-4" strokeWidth={2.5} />}
              label={t("dash.qaResults")}
              sublabel={t("dash.qaResultsSub")}
              bg="#F3E5F5"
              iconColor="#6A1B9A"
            />
            <QuickAction
              href="/admin/gallery"
              icon={<ImageIcon className="h-4 w-4" strokeWidth={2.5} />}
              label={t("dash.qaGallery")}
              sublabel={t("dash.qaGallerySub")}
              bg="#E0F7FA"
              iconColor="#00695C"
            />
          </div>
        </div>

        {/* ─── Summary Widgets ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold text-[var(--ink)] mb-2.5">{t("dash.summary")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <SummaryWidget
              value={stats.activeAds}
              label={t("dash.sumActiveAds")}
              icon={<Megaphone className="h-3.5 w-3.5" strokeWidth={2.5} />}
              iconBg="#E8F5E9"
              iconColor="#2E7D32"
              href="/admin/ads"
              viewLabel={t("common.view")}
            />
            <SummaryWidget
              value={stats.pendingAds}
              label={t("dash.sumPendingAds")}
              icon={<Clock className="h-3.5 w-3.5" strokeWidth={2.5} />}
              iconBg="#FFF3E0"
              iconColor="#E65100"
              href="/admin/ads"
              viewLabel={t("common.view")}
            />
            <SummaryWidget
              value={stats.rejectedAds}
              label={t("dash.sumExpiredAds")}
              icon={<Ban className="h-3.5 w-3.5" strokeWidth={2.5} />}
              iconBg="#FFEBEE"
              iconColor="#C62828"
              href="/admin/ads"
              viewLabel={t("common.view")}
            />
            <SummaryWidget
              value={0}
              label={t("dash.sumEvents")}
              icon={<Calendar className="h-3.5 w-3.5" strokeWidth={2.5} />}
              iconBg="#F3E5F5"
              iconColor="#6A1B9A"
              href="/admin/gallery"
              viewLabel={t("common.view")}
            />
            <SummaryWidget
              value={stats.newsPosts}
              label={t("dash.sumNews")}
              icon={<Newspaper className="h-3.5 w-3.5" strokeWidth={2.5} />}
              iconBg="#E3F2FD"
              iconColor="#1565C0"
              href="/admin/news"
              viewLabel={t("common.view")}
            />
            <SummaryWidget
              value={stats.albums}
              label={t("dash.sumAlbums")}
              icon={<ImageIcon className="h-3.5 w-3.5" strokeWidth={2.5} />}
              iconBg="#E0F7FA"
              iconColor="#00695C"
              href="/admin/gallery"
              viewLabel={t("common.view")}
            />
          </div>
        </div>

        {/* ─── Bottom 3-col Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">

          {/* Recent Registrations */}
          <div className="bg-white rounded-2xl border border-[#EAE4D8]/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 min-h-[300px] overflow-hidden">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-[#2E7D32]" />
                {t("dash.recentReg")}
              </h3>
              <Link
                href="/admin/families"
                className="text-[10px] font-bold text-[var(--brand)] flex items-center gap-0.5 hover:underline shrink-0"
              >
                {t("common.viewAll")} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {recentFamilies.length === 0 ? (
              <p className="py-4 text-center text-sm font-medium text-[#9A9288]">
                {t("dash.noReg")}
              </p>
            ) : (
              <div className="max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#EAE4D8] scrollbar-track-transparent overflow-x-hidden">
                {recentFamilies.slice(0, 5).map((f) => (
                  <RecentRegistrationItem
                    key={f.id}
                    family={f}
                    lang={lang}
                    fmtDate={fmtDate}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pending Tasks */}
          <div className="bg-white rounded-2xl border border-[#EAE4D8]/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 min-h-[300px] overflow-hidden">
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5 mb-2.5">
              <AlertCircle className="h-4 w-4 text-[#E65100]" />
              {t("dash.pendingWork")}
            </h3>
            <PendingTaskItem
              icon={<Clock className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label={t("dash.statPending")}
              count={stats.pending}
              href="/admin/queue"
              iconBg="#FFF3E0"
              iconColor="#E65100"
            />
            <PendingTaskItem
              icon={<FileText className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label={t("dash.statPendingUpdates")}
              count={stats.pendingUpdates}
              href="/admin/queue"
              iconBg="#F3E5F5"
              iconColor="#6A1B9A"
            />
            <PendingTaskItem
              icon={<Megaphone className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label={t("dash.draftAds")}
              count={stats.draftAds}
              href="/admin/ads"
              iconBg="#FFF3E0"
              iconColor="#E65100"
            />
            <PendingTaskItem
              icon={<Ban className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label={t("dash.sumExpiredAds")}
              count={stats.rejectedAds}
              href="/admin/ads"
              iconBg="#FFEBEE"
              iconColor="#C62828"
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-[#EAE4D8]/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 min-h-[300px] overflow-hidden">
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5 mb-2.5">
              <Activity className="h-4 w-4 text-[#1565C0]" />
              {t("dash.recentActivity")}
            </h3>
            {recentActivity.length === 0 ? (
              <p className="py-4 text-center text-sm font-medium text-[#9A9288]">
                {t("dash.noActivity")}
              </p>
            ) : (
              <div className="max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#EAE4D8] scrollbar-track-transparent overflow-x-hidden">
                {recentActivity.slice(0, 5).map((a, i) => {
                  const name = (lang === "en" ? a.sublabelEn : a.sublabelGu) || t("dash.actNewsFallback");
                  return (
                    <ActivityItem
                      key={i}
                      type={a.type}
                      labelKey={a.labelKey as AdminKey}
                      name={name}
                      familySuffix={a.familySuffix}
                      relativeTime={relativeTime(a.at)}
                      t={t}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}