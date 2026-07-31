import { notFound } from "next/navigation";
import Link from "next/link";
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
  UserPen
} from "lucide-react";
import { getActiveCommunity } from "@/lib/tenant";
import { getAdminDashboard } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

// ─── helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "હમણાં જ";
  if (mins < 60) return `${mins} મિનિટ પહેલા`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} કલાક પહેલા`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ગઈ કાલે";
  if (days < 7) return `${days} દિવસ પહેલા`;
  return new Date(iso).toLocaleDateString("gu-IN", { day: "numeric", month: "short" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("gu-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── sub-components (inline, no extra file) ──────────────────────────────────

function StatChip({
  value,
  label,
  color,
  icon,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div 
      className="flex flex-1 min-w-[140px] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-[#EAE4D8]/60 transition-transform hover:-translate-y-[2px]"
    >
      <div 
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white"
        style={{ color: color, border: `1.5px solid ${color}` }}
      >
        {icon}
      </div>
      <div className="flex flex-col items-start">
        <span className="text-[24px] font-extrabold leading-none text-[var(--ink)]">
          {value}
        </span>
        <span className="text-[12px] font-bold text-[#5A6A60] mt-1">
          {label}
        </span>
      </div>
    </div>
  );
}

function QuickCard({
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
      className="group flex flex-1 min-w-[130px] items-center gap-3 rounded-2xl border border-[#EAE4D8] bg-white px-4 py-3.5 transition-all hover:shadow-md hover:border-[#D4C9B8] hover:-translate-y-[1px]"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: bg, color: iconColor }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-extrabold text-[var(--ink)] leading-snug">{label}</div>
        <div className="text-[11px] text-[#9A9288] leading-snug mt-0.5">{sublabel}</div>
      </div>
      <span className="ml-auto shrink-0 text-[#C0B8AD] transition-transform group-hover:translate-x-0.5">
        ›
      </span>
    </Link>
  );
}

function SummaryCard({
  value,
  label,
  icon,
  iconBg,
  iconColor,
  href,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-4 items-start text-left"
      style={{ background: iconBg }}
    >
      <span
        className="flex size-8 items-center justify-center rounded-full bg-white shadow-sm"
        style={{ color: iconColor }}
      >
        {/* The icon passed is size-5, we scale it down slightly via css or just let it overflow nicely if it fits */}
        <span className="[&>svg]:size-4">{icon}</span>
      </span>
      <div className="mt-1">
        <div className="text-[28px] font-extrabold leading-none" style={{ color: iconColor }}>{value}</div>
        <div className="mt-1 text-[12px] font-bold text-[var(--ink-mid)]">{label}</div>
      </div>
      <Link
        href={href}
        className="mt-2 flex items-center gap-1 text-[11.5px] font-bold hover:underline"
        style={{ color: iconColor }}
      >
        જૂઓ <span>→</span>
      </Link>
    </div>
  );
}

function PendingRow({
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
    <div className="flex items-center gap-3 py-3 border-b border-[#F0EAE0] last:border-0">
      <span 
        className="flex size-8 shrink-0 items-center justify-center rounded-lg" 
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-semibold text-[var(--ink)]">{label}</span>
      <span className="text-[13px] font-bold" style={{ color: iconColor }}>{count}</span>
      <Link
        href={href}
        className="rounded-full border border-[#EAE4D8] bg-[#F7F4EF] px-3 py-1 text-[10.5px] font-bold text-[#6A6460] transition-colors hover:bg-[#EAE4D8]"
      >
        જૂઓ
      </Link>
    </div>
  );
}

// ─── Village SVG illustration ─────────────────────────────────────────────────

function VillageIllustration() {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[140px] w-auto drop-shadow-sm"
      aria-hidden
    >
      {/* Sky */}
      <rect width="200" height="160" rx="16" fill="transparent" />
      {/* Sun */}
      <circle cx="160" cy="35" r="18" fill="#FDD768" opacity="0.9" />
      <circle cx="160" cy="35" r="13" fill="#FEC94A" />
      {/* Birds */}
      <path d="M130 22 Q133 19 136 22" stroke="#6AAF80" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M140 17 Q143 14 146 17" stroke="#6AAF80" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Big Tree left */}
      <rect x="16" y="90" width="8" height="30" rx="3" fill="#8B6914" />
      <ellipse cx="20" cy="80" rx="20" ry="22" fill="#4CAF72" />
      <ellipse cx="20" cy="74" rx="14" ry="16" fill="#5DC882" />
      {/* Ground */}
      <rect x="0" y="120" width="200" height="40" rx="8" fill="#C8E6D0" />
      {/* Main house */}
      <rect x="65" y="72" width="70" height="52" rx="4" fill="#FFF8F0" />
      {/* Roof */}
      <polygon points="58,75 100,40 142,75" fill="#E07030" />
      <polygon points="62,75 100,44 138,75" fill="#F08040" />
      {/* Door */}
      <rect x="87" y="99" width="26" height="25" rx="4" fill="#C87830" />
      <circle cx="111" cy="112" r="2" fill="#FFF8F0" />
      {/* Windows */}
      <rect x="72" y="83" width="18" height="16" rx="3" fill="#A8D8F0" />
      <line x1="81" y1="83" x2="81" y2="99" stroke="#8AB8D0" strokeWidth="1" />
      <line x1="72" y1="91" x2="90" y2="91" stroke="#8AB8D0" strokeWidth="1" />
      <rect x="110" y="83" width="18" height="16" rx="3" fill="#A8D8F0" />
      <line x1="119" y1="83" x2="119" y2="99" stroke="#8AB8D0" strokeWidth="1" />
      <line x1="110" y1="91" x2="128" y2="91" stroke="#8AB8D0" strokeWidth="1" />
      {/* Small house right */}
      <rect x="148" y="90" width="40" height="34" rx="3" fill="#FFF0E0" />
      <polygon points="144,92 168,70 192,92" fill="#D06828" />
      <rect x="158" y="108" width="14" height="16" rx="2" fill="#B06020" />
      {/* Small tree right */}
      <rect x="184" y="100" width="5" height="22" rx="2" fill="#8B6914" />
      <ellipse cx="187" cy="94" rx="11" ry="13" fill="#4CAF72" />
      {/* Path */}
      <ellipse cx="100" cy="128" rx="22" ry="6" fill="#D4C090" opacity="0.6" />
    </svg>
  );
}

// ─── Activity type icon ───────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    family: { bg: "#E8F5E9", color: "#2E7D32", icon: <UserPlus className="size-4" strokeWidth={2.5} /> },
    news:   { bg: "#E3F2FD", color: "#1565C0", icon: <Newspaper className="size-4" strokeWidth={2.5} /> },
    ad:     { bg: "#FFF3E0", color: "#E65100", icon: <Megaphone className="size-4" strokeWidth={2.5} /> },
    result: { bg: "#F3E5F5", color: "#6A1B9A", icon: <Trophy className="size-4" strokeWidth={2.5} /> },
  };
  const t = map[type] ?? { bg: "#F5F5F5", color: "#616161", icon: <ShieldCheck className="size-4" strokeWidth={2.5} /> };
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{ background: t.bg, color: t.color }}
    >
      {t.icon}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();
  const { stats, recentFamilies, recentActivity } = await getAdminDashboard(community.id);

  const communityName = community.nameGu || community.nameEn;
  const todayGu = new Date().toLocaleDateString("gu-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 pb-6">

      {/* ── Welcome hero ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#E8F5EE] via-[#F4F9F6] to-[#EAF4FF] border border-[#D5EAE0] p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          
          <div className="flex flex-1 flex-col md:flex-row md:items-center md:gap-8 lg:gap-12">
            {/* Left: greeting + meta */}
            <div className="flex-1">
              <h1 className="mb-2 text-[28px] font-extrabold text-[var(--ink)]">
                સુપ્રભાત, Admin! 👋
              </h1>
              <p className="text-[14px] text-[#5A6A60] font-medium mb-6">
                તમારા સમુદાયનું સંચાલન અહીંથી સરળતાથી કરો.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-[#5A6A60]">
                <span className="flex items-center gap-2 rounded-full bg-white border border-[#EAE4D8] px-4 py-2 shadow-sm">
                  <Calendar className="size-4" /> {todayGu}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white border border-[#EAE4D8] px-4 py-2 shadow-sm">
                  <Users className="size-4" /> {communityName}
                </span>
              </div>
            </div>

            {/* Center: illustration */}
            <div className="flex justify-center md:justify-end">
              <VillageIllustration />
            </div>
          </div>

          {/* Right: top stats - now in a grid/flex row! */}
          <div className="flex flex-wrap justify-center gap-4 md:flex-nowrap md:justify-start lg:justify-end">
            <StatChip
              value={stats.families}
              label="કુલ પરિવારો"
              color="#2E7D32"
              icon={<Users className="size-5" strokeWidth={2.5} />}
            />
            <StatChip
              value={stats.members}
              label="કુલ સભ્યો"
              color="#1565C0"
              icon={<User className="size-5" strokeWidth={2.5} />}
            />
            <StatChip
              value={stats.pending}
              label="પેન્ડિંગ રજિસ્ટ્રેશન"
              color="#E65100"
              icon={<ClipboardList className="size-5" strokeWidth={2.5} />}
            />
            <StatChip
              value={stats.pendingUpdates}
              label="પેન્ડિંગ અપડેટ"
              color="#6A1B9A"
              icon={<UserPen className="size-5" strokeWidth={2.5} />}
            />
          </div>
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-[16px] font-extrabold text-[var(--ink)]">ઝડપી કામગીરી</h2>
        <div className="flex flex-wrap gap-4">
          <QuickCard
            href="/admin/families"
            icon={<Users className="size-5" strokeWidth={2.5} />}
            label="પરિવાર ઉમેરો"
            sublabel="નવું પરિવાર રજિસ્ટ કરો"
            bg="#E8F5E9"
            iconColor="#2E7D32"
          />
          <QuickCard
            href="/admin/news"
            icon={<Newspaper className="size-5" strokeWidth={2.5} />}
            label="સમાચાર ઉમેરો"
            sublabel="નવું સમાચાર પ્રકાશિત કરો"
            bg="#E3F2FD"
            iconColor="#1565C0"
          />
          <QuickCard
            href="/admin/ads"
            icon={<Megaphone className="size-5" strokeWidth={2.5} />}
            label="જાહેરાત બનાવો"
            sublabel="સમુદાય માટે જાહેરાત બનાવો"
            bg="#FFF3E0"
            iconColor="#E65100"
          />
          <QuickCard
            href="/admin/results"
            icon={<Trophy className="size-5" strokeWidth={2.5} />}
            label="રિઝલ્ટ ડ્રાઇવ"
            sublabel="પરિણામ અપલોડ કરો"
            bg="#F3E5F5"
            iconColor="#6A1B9A"
          />
          <QuickCard
            href="/admin/gallery"
            icon={<ImageIcon className="size-5" strokeWidth={2.5} />}
            label="ગેલેરી બનાવો"
            sublabel="ફોટો આલ્બમ બનાવો"
            bg="#E0F7FA"
            iconColor="#00695C"
          />
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-[16px] font-extrabold text-[var(--ink)]">સારાંશ</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard
            value={stats.activeAds}
            label="સક્રિય જાહેરાતો"
            icon={<Megaphone className="size-5" strokeWidth={2.5} />}
            iconBg="#E8F5E9"
            iconColor="#2E7D32"
            href="/admin/ads"
          />
          <SummaryCard
            value={stats.pendingAds}
            label="પેન્ડિંગ જાહેરાતો"
            icon={<Clock className="size-5" strokeWidth={2.5} />}
            iconBg="#FFF3E0"
            iconColor="#E65100"
            href="/admin/ads"
          />
          <SummaryCard
            value={stats.rejectedAds}
            label="સમાપ્ત જાહેરાતો"
            icon={<Ban className="size-5" strokeWidth={2.5} />}
            iconBg="#FFEBEE"
            iconColor="#C62828"
            href="/admin/ads"
          />
          <SummaryCard
            value={0}
            label="ઇવેન્ટ્સ"
            icon={<Calendar className="size-5" strokeWidth={2.5} />}
            iconBg="#F3E5F5"
            iconColor="#6A1B9A"
            href="/admin/gallery"
          />
          <SummaryCard
            value={stats.newsPosts}
            label="સમાચાર પોસ્ટ્સ"
            icon={<Newspaper className="size-5" strokeWidth={2.5} />}
            iconBg="#E3F2FD"
            iconColor="#1565C0"
            href="/admin/news"
          />
          <SummaryCard
            value={stats.albums}
            label="ગેલેરી આલ્બમ"
            icon={<ImageIcon className="size-5" strokeWidth={2.5} />}
            iconBg="#E0F7FA"
            iconColor="#00695C"
            href="/admin/gallery"
          />
        </div>
      </div>

      {/* ── Bottom 3-col ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Recent registrations */}
        <div className="rounded-2xl border border-[#EAE4D8] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-extrabold text-[var(--ink)]">
              તાજેતરના રજિસ્ટ્રેશન
            </h3>
            <Link
              href="/admin/families"
              className="text-[12px] font-bold text-[var(--brand)] hover:underline"
            >
              બધા જૂઓ
            </Link>
          </div>

          {recentFamilies.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] font-medium text-[#9A9288]">
              કોઈ રજિસ્ટ્રેશન નથી
            </p>
          ) : (
            <div className="space-y-0">
              {recentFamilies.map((f) => (
                <Link
                  key={f.id}
                  href={`/admin/families`}
                  className="group flex items-center gap-3 py-3 border-b border-[#F0EAE0] last:border-0 hover:bg-[#FAFAF8] rounded-xl px-2 -mx-2 transition-colors"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
                    <Users className="size-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors">
                      {f.headName} {f.surname ? `${f.surname} પરિવાર` : "પરિવાર"}
                    </div>
                    <div className="text-[11.5px] font-medium text-[#9A9288] mt-0.5">{fmtDate(f.submittedAt)}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#FAFAF8] border border-[#EAE4D8] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-mid)] group-hover:bg-white">
                    {f.memberCount} સભ્ય
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending work */}
        <div className="rounded-2xl border border-[#EAE4D8] bg-white p-5">
          <h3 className="mb-4 text-[14.5px] font-extrabold text-[var(--ink)]">પેન્ડિંગ કાર્ય</h3>
          <PendingRow
            icon={<Clock className="size-4" strokeWidth={2.5} />}
            label="પેન્ડિંગ રજિસ્ટ્રેશન"
            count={stats.pending}
            href="/admin/queue"
            iconBg="#FFF3E0"
            iconColor="#E65100"
          />
          <PendingRow
            icon={<FileText className="size-4" strokeWidth={2.5} />}
            label="પેન્ડિંગ અપડેટ"
            count={stats.pendingUpdates}
            href="/admin/queue"
            iconBg="#F3E5F5"
            iconColor="#6A1B9A"
          />
          <PendingRow
            icon={<Megaphone className="size-4" strokeWidth={2.5} />}
            label="ડ્રાફ્ટ જાહેરાતો"
            count={stats.draftAds}
            href="/admin/ads"
            iconBg="#FFF3E0"
            iconColor="#E65100"
          />
          <PendingRow
            icon={<Ban className="size-4" strokeWidth={2.5} />}
            label="સમાપ્ત જાહેરાતો"
            count={stats.rejectedAds}
            href="/admin/ads"
            iconBg="#FFEBEE"
            iconColor="#C62828"
          />
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-[#EAE4D8] bg-white p-5">
          <h3 className="mb-4 text-[14.5px] font-extrabold text-[var(--ink)]">
            તાજેતરની પ્રવૃત્તિ
          </h3>
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] font-medium text-[#9A9288]">
              કોઈ પ્રવૃત્તિ નથી
            </p>
          ) : (
            <div className="space-y-0">
              {recentActivity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-3 border-b border-[#F0EAE0] last:border-0"
                >
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[var(--ink)]">{a.label}</div>
                    <div className="truncate text-[11.5px] font-medium text-[#9A9288] mt-0.5">{a.sublabel}</div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-[#B0A898] whitespace-nowrap mt-0.5">
                    {relativeTime(a.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
