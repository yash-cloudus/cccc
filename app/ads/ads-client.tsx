"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, MapPin, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { MAX_BANNERS_PER_MEMBER } from "@/lib/constants";
import { AD_DURATIONS, AD_DURATION_MONTHS, adDurationLabel, type AdDuration } from "@/lib/admin-settings";
import { cn } from "@/lib/utils";
import { trackAdClick } from "@/lib/track-ad";
import { pickText } from "@/lib/format";

export type AdRow = {
  id: string;
  name: string;
  pitch: string | null;
  imageUrl: string | null;
  category: string | null;
  categoryGu: string | null;
  city: string | null;
};

export type MyBanner = {
  id: string;
  name: string;
  imageUrl: string | null;
  status: string;
  rejectReason: string | null;
  views: number;
  clicks: number;
  endDate: string;
};

const AD_GRADIENTS = [
  "linear-gradient(135deg,#7A2E5C,#B0417E)",
  "linear-gradient(135deg,#1F4C6B,#3D7BA0)",
  "linear-gradient(135deg,#B15A16,#E09A3A)",
  "linear-gradient(135deg,#2D6A4F,#52B788)",
  "linear-gradient(135deg,#8E2230,#B24C3B)",
  "linear-gradient(135deg,#4A3580,#8E6FC0)",
];

function hashIdx(key: string, mod: number) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function AdsClient({
  rows,
  myBanners,
  signedIn,
  tiers,
  cities = [],
  categories = [],
  browseMode = false,
}: {
  rows: AdRow[];
  myBanners: MyBanner[];
  signedIn: boolean;
  tiers: Record<AdDuration, number>;
  cities?: string[];
  categories?: { en: string; gu: string | null }[];
  /** true when opened from Services tile — shows only the public ad listing */
  browseMode?: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const pageTitle = browseMode
    ? T("ચાલુ જાહેરાત", "Advertisements")
    : T("જાહેરાત બેનર", "Ad banner");

  const [q, setQ] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const liveCount = myBanners.filter((b) => b.status === "PENDING" || b.status === "ACTIVE").length;
  const canAdd = signedIn && liveCount < MAX_BANNERS_PER_MEMBER;
  const priceText = AD_DURATIONS.map(
    (d) => `₹${tiers[d].toLocaleString("en-IN")} / ${adDurationLabel(AD_DURATION_MONTHS[d], T)}`,
  ).join(" · ");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((ad) => {
      if (cityFilter !== "all" && ad.city !== cityFilter) return false;
      if (catFilter !== "all" && ad.category !== catFilter) return false;
      if (!term) return true;
      return (
        ad.name.toLowerCase().includes(term) ||
        (ad.pitch ?? "").toLowerCase().includes(term) ||
        (ad.category ?? "").toLowerCase().includes(term) ||
        (ad.city ?? "").toLowerCase().includes(term)
      );
    });
  }, [q, cityFilter, catFilter, rows]);

  const hasActiveFilter = cityFilter !== "all" || catFilter !== "all" || q.trim() !== "";

  const clearFilters = () => {
    setQ("");
    setCityFilter("all");
    setCatFilter("all");
  };

  return (
    <AppScreen showNav={false}>
      {/* ─── Header ─── */}
      <BackHeader
        title={pageTitle}
        right={
          <div className="flex size-[42px] flex-none items-center justify-center rounded-[13px] bg-white/12">
            <Megaphone className="size-[21px]" strokeWidth={1.7} />
          </div>
        }
      />

      <div className="px-4 py-4 pb-8">
        {/* ─── Search bar ─── */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-[14px] border border-[var(--line-soft)] bg-white px-3.5 shadow-sm">
            <Search className="size-[18px] flex-none text-[var(--brand)]" strokeWidth={2.1} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={T("બિઝનેસ, શહેર, કેટેગરી…", "Business, city, category…")}
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] font-medium text-[var(--ink)] outline-none placeholder:text-[var(--faint-soft)]"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="flex-none text-[var(--faint)]">
                <X className="size-[16px]" strokeWidth={2.2} />
              </button>
            )}
          </div>
          {/* Filter toggle button */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] border transition",
              showFilters || hasActiveFilter
                ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]"
                : "border-[var(--line-soft)] bg-white text-[var(--ink-mid)]",
            )}
          >
            <SlidersHorizontal className="size-[19px]" strokeWidth={2} />
          </button>
        </div>

        {/* ─── Filter chips ─── */}
        {showFilters && (categories.length > 0 || cities.length > 0) && (
          <div className="mb-3 space-y-2.5">
            {/* Category filter */}
            {categories.length > 0 && (
              <div>
                <div className="mb-1.5 px-0.5 text-[11px] font-extrabold tracking-wide text-[var(--muted)]">
                  {T("કેટેગરી", "CATEGORY")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[{ en: "all", gu: null }, ...categories].map((c) => {
                    const isAll = c.en === "all";
                    const label = isAll ? T("બધા", "All") : pickText(c.gu, c.en, lang);
                    const active = catFilter === c.en;
                    return (
                      <button
                        key={c.en}
                        type="button"
                        onClick={() => setCatFilter(c.en)}
                        className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition"
                        style={{
                          background: active ? "var(--brand)" : "#fff",
                          color: active ? "#fff" : "#6B6357",
                          border: active ? "none" : "1px solid #EDE4D4",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* City filter */}
            {cities.length > 0 && (
              <div>
                <div className="mb-1.5 px-0.5 text-[11px] font-extrabold tracking-wide text-[var(--muted)]">
                  {T("શહેર", "CITY")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["all", ...cities].map((city) => {
                    const isAll = city === "all";
                    const active = cityFilter === city;
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => setCityFilter(city)}
                        className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition"
                        style={{
                          background: active ? "var(--brand)" : "#fff",
                          color: active ? "#fff" : "#6B6357",
                          border: active ? "none" : "1px solid #EDE4D4",
                        }}
                      >
                        {!isAll && <MapPin className="size-[11px]" strokeWidth={2.2} />}
                        {isAll ? T("બધા", "All") : city}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active filter summary pill */}
        {hasActiveFilter && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[12px] text-[var(--faint)]">
              {filtered.length} {T("જાહેરાત મળ્યા", "ads found")}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-full bg-[var(--danger-tint)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--danger)]"
            >
              <X className="size-[11px]" strokeWidth={2.5} />
              {T("ફિલ્ટર સાફ", "Clear")}
            </button>
          </div>
        )}

        {/* ─── Price / limits info card — hidden in browse mode ─── */}
        {!browseMode && <dl className="mb-4 rounded-[16px] border border-[var(--line-soft)] bg-white p-3.5 text-[13px]">
          {(
            [
              [T("ભાવ", "Price"), priceText],
              [
                T("મર્યાદા", "Limit"),
                T(`ઓછામાં ઓછું 1, વધુમાં વધુ ${MAX_BANNERS_PER_MEMBER}`, `Minimum 1, maximum ${MAX_BANNERS_PER_MEMBER}`),
              ],
              [T("ક્યાં દેખાય", "Shown at"), T("હોમ સ્ક્રીન ટોપ auto-slide", "Home screen top auto-slide")],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex gap-3 py-1">
              <dt className="w-[74px] flex-none font-bold text-[var(--faint)]">{k}</dt>
              <dd className="min-w-0 text-[var(--ink-mid)]">{v}</dd>
            </div>
          ))}
        </dl>}

        {/* ─── My Banners — hidden in browse mode ─── */}
        {!browseMode && signedIn && (
          <>
            <div className="mb-2 px-1 text-[12px] font-extrabold tracking-wide text-[var(--muted)]">
              {T("તમારા બેનર", "YOUR BANNERS")} ({liveCount}/{MAX_BANNERS_PER_MEMBER})
            </div>

            {myBanners.length === 0 ? (
              <p className="mb-3 rounded-[15px] border border-dashed border-[var(--line-soft)] px-4 py-6 text-center text-[12.5px] text-[var(--faint)]">
                {T("હજુ કોઈ બેનર નથી.", "No banners yet.")}
              </p>
            ) : (
              myBanners.map((b) => <BannerRow key={b.id} banner={b} />)
            )}

            <button
              type="button"
              disabled={!canAdd}
              onClick={() => router.push("/ads/new")}
              className={cn(
                "mb-3 flex w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-dashed py-4 text-[14px] font-extrabold",
                canAdd
                  ? "border-[var(--brand-line)] bg-[var(--brand-tint)] text-[var(--brand)]"
                  : "border-[var(--line-soft)] text-[var(--faint)]",
              )}
            >
              <Plus className="size-[18px]" strokeWidth={2.3} />
              {T("નવું બેનર ઉમેરો", "Add a new banner")}
            </button>

            <p className="mb-5 rounded-[13px] border border-[var(--line-soft)] bg-[var(--surface)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
              {T(
                `વધુમાં વધુ ${MAX_BANNERS_PER_MEMBER} બેનર એકસાથે active રાખી શકાય. ચૂકવણી + એડમિન મંજૂરી પછી જ બેનર દેખાય.`,
                `At most ${MAX_BANNERS_PER_MEMBER} banners can be active at once. A banner appears only after payment and admin approval.`,
              )}
            </p>
          </>
        )}

        {/* ─── Live Ads listing ─── */}
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="text-[12px] font-extrabold tracking-wide text-[var(--muted)]">
            {T("ચાલુ જાહેરાત", "LIVE ADS")}
          </div>
          {!hasActiveFilter && (
            <div className="text-[11.5px] text-[var(--faint)]">
              {rows.length} {T("જાહેરાત", "ads")}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-[#F4F1EA] text-[#C6B8A0]">
              <Megaphone className="size-[30px]" strokeWidth={1.5} />
            </div>
            <div className="mb-1 text-[14.5px] font-extrabold text-[var(--ink-mid)]">
              {T("કોઈ જાહેરાત મળ્યા નહીં", "No ads found")}
            </div>
            <div className="mb-4 text-[12.5px] text-[var(--faint)]">
              {T("ફિલ્ટર બદલો અથવા શોધ સાફ કરો", "Change filters or clear search")}
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center rounded-[13px] border-[1.5px] border-[var(--brand-line)] px-5 text-sm font-bold text-[var(--brand)]"
              >
                {T("ફિલ્ટર સાફ કરો", "Clear filters")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ad, i) => {
              const gradient = AD_GRADIENTS[hashIdx(ad.id, AD_GRADIENTS.length)];
              return (
                <Link
                  key={ad.id}
                  href={`/ads/${ad.id}`}
                  className="block"
                  onClick={() => trackAdClick(ad.id)}
                >
                  <div
                    className="relative flex h-[120px] overflow-hidden rounded-[20px] shadow-[0_8px_20px_-10px_rgba(40,20,30,.35)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_rgba(40,20,30,.4)]"
                    style={
                      ad.imageUrl
                        ? {
                            backgroundImage: `url(${ad.imageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : { background: gradient }
                    }
                  >
                    {/* Overlay */}
                    {ad.imageUrl && (
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                    )}
                    {!ad.imageUrl && (
                      <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(255,255,255,.15),transparent_60%)]" />
                    )}

                    {/* Content */}
                    <div className="relative flex flex-1 flex-col justify-between p-4 text-white">
                      <div>
                        <div className="text-[17px] font-extrabold leading-tight tracking-tight">
                          {ad.name}
                        </div>
                        {ad.pitch && (
                          <div className="mt-1 line-clamp-1 text-[12px] font-medium opacity-85">
                            {ad.pitch}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {ad.category && (
                          <span className="rounded-full bg-white/22 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-sm">
                            {pickText(ad.categoryGu, ad.category, lang)}
                          </span>
                        )}
                        {ad.city && (
                          <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold backdrop-blur-sm">
                            <MapPin className="size-[10px]" strokeWidth={2.2} />
                            {ad.city}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sponsored badge */}
                    <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[9.5px] font-bold tracking-wider text-white backdrop-blur-sm">
                      {T("સ્પૉન્સર્ડ", "Sponsored")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppScreen>
  );
}

function BannerRow({ banner }: { banner: MyBanner }) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const pill = {
    ACTIVE: { text: `✓ ${T("Live", "Live")}`, cls: "bg-[var(--success-tint)] text-[var(--success)]" },
    PENDING: { text: T("ચકાસણી બાકી", "Pending"), cls: "bg-[var(--gold-tint)] text-[var(--warn)]" },
    REJECTED: { text: `✕ ${T("નામંજૂર", "Rejected")}`, cls: "bg-[var(--danger-tint)] text-[var(--danger)]" },
    EXPIRED: { text: T("પૂરું થયું", "Expired"), cls: "bg-[#EEF1F6] text-[#4A5B72]" },
    DEACTIVATED: { text: T("બંધ", "Off"), cls: "bg-[#EEF1F6] text-[#4A5B72]" },
    DRAFT: { text: T("ડ્રાફ્ટ", "Draft"), cls: "bg-[#EEF1F6] text-[#4A5B72]" },
  }[banner.status] ?? { text: banner.status, cls: "bg-[#EEF1F6] text-[#4A5B72]" };

  return (
    <div className="samaj-card mb-2.5 flex items-center gap-3 p-3">
      <span className="size-11 flex-none overflow-hidden rounded-[11px] bg-[var(--platform-ink-deep)]">
        {banner.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.imageUrl} alt="" className="size-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold text-[var(--ink)]">{banner.name}</span>
        <span className="block text-[11.5px] text-[var(--faint)]">
          {banner.status === "REJECTED" && banner.rejectReason
            ? banner.rejectReason
            : `${banner.views} views · ${banner.clicks} clicks`}
        </span>
      </span>
      <span
        className={cn(
          "flex-none rounded-lg px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap",
          pill.cls,
        )}
      >
        {pill.text}
      </span>
    </div>
  );
}
