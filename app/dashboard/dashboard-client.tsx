"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Award,
  Building2,
  ChevronRight,
  Droplet,
  FileText,
  GraduationCap,
  Home,
  ImageIcon,
} from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { AppHeader } from "@/components/layout/app-header";
import { useLang } from "@/providers/lang-provider";
import { formatDate, pickText } from "@/lib/format";
import { driveDisplayName } from "@/lib/result-drive";
import { trackAdClick } from "@/lib/track-ad";

export type AdRow = {
  id: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  link: string;
};

export type FeaturedNews = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  dateISO: string;
  isPinned: boolean;
};

export type LiveResultDrive = {
  titleEn: string;
  titleGu: string | null;
  year: number;
};

const tileDefs = [
  { key: "blood", href: "/blood-group", labelKey: "bloodGroup" as const, bg: "var(--danger-tint)", fg: "var(--danger)", Icon: Droplet },
  { key: "edu", href: "/education", labelKey: "education" as const, bg: "var(--info-tint)", fg: "var(--info)", Icon: GraduationCap },
  { key: "biz", href: "/business", labelKey: "business" as const, bg: "var(--ochre-tint)", fg: "var(--ochre)", Icon: Building2 },
  { key: "gallery", href: "/gallery", labelKey: "gallery" as const, bg: "var(--leaf-tint)", fg: "var(--leaf)", Icon: ImageIcon },
  { key: "about", href: "/about", labelKey: "about" as const, bg: "var(--violet-tint)", fg: "var(--violet)", Icon: Home },
  { key: "results", href: "/results", labelKey: "results" as const, bg: "var(--warn-tint)", fg: "#B08A1E", Icon: Award },
];

/** Deterministic gradient palette — Advertisement carries no gradient of its own. */
const AD_GRADIENTS = [
  "linear-gradient(120deg,#7A2E5C,#B0417E)",
  "linear-gradient(120deg,#1F4C6B,#3D7BA0)",
  "linear-gradient(120deg,#B15A16,#E09A3A)",
  "linear-gradient(120deg,var(--leaf),#6BA85E)",
  "linear-gradient(120deg,#8E2230,#B24C3B)",
];

export function DashboardClient({
  ads,
  featured,
  resultEnabled = true,
  resultDrive = null,
}: {
  ads: AdRow[];
  featured: FeaturedNews | null;
  resultEnabled?: boolean;
  /** Present only when a drive is actually open — the banner below is a "come upload now" call to action, not a status readout. */
  resultDrive?: LiveResultDrive | null;
}) {
  const { t, lang } = useLang();
  const visibleTiles = resultEnabled ? tileDefs : tileDefs.filter((t) => t.key !== "results");
  const [adIdx, setAdIdx] = useState(0);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(() => setAdIdx((i) => (i + 1) % ads.length), 3500);
    return () => clearInterval(id);
  }, [ads.length]);

  const ad = ads.length > 0 ? ads[adIdx % ads.length] : null;

  return (
    <AppScreen>
      <AppHeader />
      <div className="px-4 pb-4 pt-4 md:px-[30px] md:pb-[120px]">
        {ad && (
          <Link href={ad.link} onClick={() => trackAdClick(ad.id)}>
            <motion.div
              key={ad.id}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              className="relative flex h-[150px] cursor-pointer items-center overflow-hidden rounded-[22px] px-6 text-white shadow-[0_16px_30px_-14px_rgba(34,30,40,.6)] md:h-[210px]"
              style={
                ad.imageUrl
                  ? {
                      backgroundImage: `url(${ad.imageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { background: AD_GRADIENTS[adIdx % AD_GRADIENTS.length] }
              }
            >
              <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_100%_0%,rgba(255,255,255,.16),transparent_55%)]" />
              {ad.imageUrl && (
                <div className="absolute inset-0 bg-gradient-to-r from-black/45 to-transparent" />
              )}
              <div className="relative z-2 max-w-[78%]">
                <div className="text-[22px] font-extrabold leading-tight tracking-tight">{ad.name}</div>
                {ad.subtitle && (
                  <div className="mt-1.5 text-[13px] font-medium opacity-90">{ad.subtitle}</div>
                )}
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/22 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
                  {t("viewOffer")} <span>→</span>
                </div>
              </div>
              <span className="absolute right-3.5 top-3 rounded-full bg-black/22 px-2 py-1 text-[9.5px] font-bold tracking-wider backdrop-blur-sm">
                {t("sponsored")}
              </span>
              {ads.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {ads.map((_, i) => (
                    <span
                      key={i}
                      className="inline-block h-[7px] rounded-full transition-all"
                      style={{
                        width: i === adIdx ? 18 : 7,
                        borderRadius: i === adIdx ? 4 : 9999,
                        background: i === adIdx ? "#fff" : "rgba(255,255,255,.4)",
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </Link>
        )}

        <div className="mt-4 md:grid md:grid-cols-[1.35fr_1fr] md:items-start md:gap-6">
          <div>
            {resultEnabled && resultDrive && (
            <Link
              href="/results?focus=upload"
              className="flex items-center gap-3.5 rounded-[20px] border border-[var(--gold-border)] bg-gradient-to-r from-[var(--gold-tint)] to-[var(--surface)] p-[15px]"
            >
              <div
                className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl text-white shadow-[0_8px_16px_-8px_rgba(217,138,30,.7)]"
                style={{ background: "linear-gradient(150deg,var(--gold),var(--gold-dark))" }}
              >
                <Award className="h-[27px] w-[27px]" strokeWidth={1.9} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-extrabold text-[#7A4E10]">
                  {driveDisplayName(resultDrive, lang)}
                  {" — "}
                  {lang === "gu" ? "અપલોડ ચાલુ છે" : "upload is open"}
                </div>
                <div className="mt-0.5 text-xs font-medium text-[#A98A50]">{t("resSub")}</div>
              </div>
              <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] bg-[var(--gold)] text-white">
                <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </div>
            </Link>
            )}

            {featured && (
              <>
                <div className="mb-3 mt-[26px] flex items-center justify-between px-1">
                  <div className="text-base font-extrabold text-[var(--ink)]">{t("news")}</div>
                  <Link href="/news" className="text-[13px] font-bold text-[var(--brand)]">
                    {t("seeAll")} →
                  </Link>
                </div>

                <Link href={`/news/${featured.id}`} className="samaj-card flex items-center gap-3.5 p-[13px]">
                  <div
                    className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-[15px] text-white"
                    style={{ background: "linear-gradient(150deg,#8E2230,#B24C3B)" }}
                  >
                    <FileText className="h-[26px] w-[26px]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {featured.isPinned && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-lg bg-[var(--gold-tint)] px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--warn)]">
                        📌 {t("pinned")}
                      </span>
                    )}
                    <div className="text-sm font-bold leading-snug text-[var(--ink)]">
                      {pickText(featured.titleGu, featured.titleEn, lang)}
                    </div>
                    <div className="mt-0.5 text-[11.5px] font-medium text-[var(--faint)]">
                      {formatDate(featured.dateISO, lang)}
                    </div>
                  </div>
                </Link>
              </>
            )}
          </div>

          <div>
            <div className="mb-3 mt-[26px] flex items-center justify-between px-1 md:mt-0">
              <div className="text-base font-extrabold text-[var(--ink)]">{t("services")}</div>
            </div>
            <div className="grid grid-cols-3 gap-[11px]">
              {visibleTiles.map(({ key, href, labelKey, bg, fg, Icon }) => (
                <Link key={key} href={href} className="samaj-card px-2 py-[15px] text-center transition hover:-translate-y-0.5 hover:border-[var(--gold-border)] hover:shadow-[0_12px_22px_-12px_rgb(var(--brand-rgb) / .4)]">
                  <div
                    className="mx-auto mb-2 flex h-[52px] w-[52px] items-center justify-center rounded-2xl"
                    style={{ background: bg, color: fg }}
                  >
                    <Icon className="h-[26px] w-[26px]" strokeWidth={1.85} />
                  </div>
                  <div className="text-xs font-bold leading-tight text-[var(--ink-soft)]">{t(labelKey)}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
