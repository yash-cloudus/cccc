"use client";

import { useRouter } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { BANNER_PRICE_INR, MAX_BANNERS_PER_MEMBER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type AdRow = {
  id: string;
  name: string;
  pitch: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  category: string | null;
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
  "linear-gradient(120deg,#7A2E5C,#B0417E)",
  "linear-gradient(120deg,#1F4C6B,#3D7BA0)",
  "linear-gradient(120deg,#B15A16,#E09A3A)",
  "linear-gradient(120deg,var(--leaf),#6BA85E)",
  "linear-gradient(120deg,#8E2230,#B24C3B)",
  "linear-gradient(120deg,var(--violet),#8E6FC0)",
];

export function AdsClient({
  rows,
  myBanners,
  signedIn,
}: {
  rows: AdRow[];
  myBanners: MyBanner[];
  signedIn: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const liveCount = myBanners.filter((b) => b.status === "PENDING" || b.status === "ACTIVE").length;
  const canAdd = signedIn && liveCount < MAX_BANNERS_PER_MEMBER;

  return (
    <AppScreen showNav={false}>
      <BackHeader
        title={T("જાહેરાત બેનર", "Ad banner")}
        right={
          <div className="flex size-[42px] flex-none items-center justify-center rounded-[13px] bg-white/12">
            <Megaphone className="size-[21px]" strokeWidth={1.7} />
          </div>
        }
      />

      <div className="px-4 py-4 pb-8">
        {/* Price / limits card — the terms a member is agreeing to. */}
        <dl className="mb-4 rounded-[16px] border border-[var(--line-soft)] bg-white p-3.5 text-[13px]">
          {(
            [
              [T("ભાવ", "Price"), T(`₹${BANNER_PRICE_INR.toLocaleString("en-IN")} / બેનર (1 વર્ષ)`, `₹${BANNER_PRICE_INR.toLocaleString("en-IN")} / banner (1 year)`)],
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
        </dl>

        {signedIn && (
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
              {T(
                `નવું બેનર ઉમેરો (₹${BANNER_PRICE_INR.toLocaleString("en-IN")})`,
                `Add a new banner (₹${BANNER_PRICE_INR.toLocaleString("en-IN")})`,
              )}
            </button>

            <p className="mb-5 rounded-[13px] border border-[var(--line-soft)] bg-[var(--surface)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
              {T(
                `વધુમાં વધુ ${MAX_BANNERS_PER_MEMBER} બેનર એકસાથે active રાખી શકાય. ચૂકવણી + એડમિન મંજૂરી પછી જ બેનર દેખાય.`,
                `At most ${MAX_BANNERS_PER_MEMBER} banners can be active at once. A banner appears only after payment and admin approval.`,
              )}
            </p>
          </>
        )}

        <div className="mb-2 px-1 text-[12px] font-extrabold tracking-wide text-[var(--muted)]">
          {T("ચાલુ જાહેરાત", "LIVE ADS")}
        </div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--faint)]">
            {T("હાલમાં કોઈ જાહેરાત નથી.", "No ads right now.")}
          </p>
        ) : (
          rows.map((ad, i) => {
            const gradient = AD_GRADIENTS[i % AD_GRADIENTS.length];
            const inner = (
              <div
                className="relative mb-3 flex h-[100px] items-center overflow-hidden rounded-[20px] px-5 text-white"
                style={ad.imageUrl ? undefined : { background: gradient }}
              >
                {ad.imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ad.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-black/20" />
                  </>
                )}
                <div className="relative min-w-0">
                  <div className="text-lg font-extrabold">{ad.name}</div>
                  {ad.pitch && <div className="mt-1 truncate text-xs opacity-90">{ad.pitch}</div>}
                  {ad.category && (
                    <div className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                      {ad.category}
                    </div>
                  )}
                </div>
              </div>
            );

            return ad.linkUrl ? (
              <a key={ad.id} href={ad.linkUrl} target="_blank" rel="noreferrer" className="block">
                {inner}
              </a>
            ) : (
              <div key={ad.id}>{inner}</div>
            );
          })
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
