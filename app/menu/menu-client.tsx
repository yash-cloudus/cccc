"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Award,
  Building2,
  ChevronRight,
  Globe,
  ImageIcon,
  Lock,
  LogOut,
  Megaphone,
  Plus,
} from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle, LangToggle } from "@/components/ui/lang-toggle";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { pickText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AD_DURATIONS, AD_DURATION_MONTHS, adDurationLabel, type AdDuration } from "@/lib/admin-settings";

/** Both plan prices joined for one language, e.g. "₹2,000/6 months · ₹4,000/1 year". */
function adPriceLine(tiers: Record<AdDuration, number>, lang: "gu" | "en") {
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  return AD_DURATIONS.map(
    (d) => `₹${tiers[d].toLocaleString("en-IN")}/${adDurationLabel(AD_DURATION_MONTHS[d], T)}`,
  ).join(" · ");
}

function buildServiceLinks(adTiers: Record<AdDuration, number>) {
  const priceGu = adPriceLine(adTiers, "gu");
  const priceEn = adPriceLine(adTiers, "en");
  return [
    { href: "/business/add", labelKey: "addBusiness" as const, subGu: "ડિરેક્ટરીમાં તમારો ધંધો ઉમેરો", subEn: "List your business in the directory", bg: "var(--brand-tint)", fg: "var(--brand)", Icon: Plus },
    { href: "/business", labelKey: "bizDir" as const, bg: "var(--ochre-tint)", fg: "var(--ochre)", Icon: Building2 },
    { href: "/ads", labelKey: "postAd" as const, subGu: `${priceGu} · હોમ સ્ક્રીન ટોપ પર`, subEn: `${priceEn} · top of home screen`, paid: true, bg: "var(--danger-tint)", fg: "var(--danger)", Icon: Megaphone },
    { href: "/gallery", labelKey: "gallery" as const, bg: "var(--leaf-tint)", fg: "var(--leaf)", Icon: ImageIcon },
    { href: "/results", labelKey: "uploadResults" as const, bg: "var(--warn-tint)", fg: "#B08A1E", Icon: Award },
    { href: "/about", labelKey: "aboutSamaj" as const, bg: "var(--violet-tint)", fg: "var(--violet)", Icon: Building2 },
  ];
}

type MeProfile = { fullNameEn: string; fullNameGu: string | null } | null;

export function MenuClient({
  resultEnabled = true,
  adTiers,
}: {
  resultEnabled?: boolean;
  /** Both premium banner plan prices, from Admin → Settings → Advertisements. */
  adTiers: Record<AdDuration, number>;
}) {
  const { t, lang } = useLang();
  const router = useRouter();
  const serviceLinks = useMemo(() => buildServiceLinks(adTiers), [adTiers]);
  const links = resultEnabled ? serviceLinks : serviceLinks.filter((l) => l.href !== "/results");
  const [newsNotif, setNewsNotif] = useState(true);
  const [feedNotif, setFeedNotif] = useState(false);
  const [me, setMe] = useState<MeProfile>(null);

  useEffect(() => {
    let active = true;
    api.get<{ profile: MeProfile }>("/api/profile").then((res) => {
      if (active && res.ok) setMe(res.data.profile);
    });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    const ok = await confirmDialog({
      title: lang === "gu" ? "શું તમે ખરેખર લોગ આઉટ કરવા માંગો છો?" : "Log out now?",
      description:
        lang === "gu"
          ? "આ સત્ર સમાપ્ત થઈ જશે અને તમે ફરીથી લોગિન કરવો પડશે."
          : "This will end your session and return you to the login screen.",
      confirmLabel: lang === "gu" ? "લોગ આઉટ" : "Log out",
      cancelLabel: lang === "gu" ? "રદ કરો" : "Cancel",
      tone: "primary",
    });
    if (!ok) return;
    try {
      await axios.post("/api/auth/logout");
    } catch {
      /* ignore */
    }
    toast.success(lang === "gu" ? "લોગ આઉટ" : "Logged out");
    router.push("/login");
  }

  const meName = me ? pickText(me.fullNameGu, me.fullNameEn, lang) : t("myProfile");
  const meInit = meName.trim()[0] || "?";

  return (
    <AppScreen>
      <header className="samaj-header relative flex-none overflow-hidden px-5 pb-5 pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 mb-4 flex items-center justify-between gap-3">
          <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold">
            {t("menu")}
          </div>
          <HeaderLangToggle />
        </div>
        <Link
          href="/profile"
          className="relative z-2 flex items-center gap-3.5 rounded-[18px] bg-white/12 p-[13px] text-white hover:text-white"
        >
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl bg-white text-xl font-extrabold text-[var(--brand)]">
            {meInit}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-white">{meName}</div>
            <div className="mt-0.5 text-[12.5px] text-white/75">{t("myProfile")}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-white" />
        </Link>
      </header>

      <div className="px-4 py-4 pb-[96px]">
        <div className="mb-2.5 px-1 text-xs font-extrabold tracking-wide text-[var(--muted)]">{t("servicesLabel")}</div>
        <div className="samaj-card overflow-hidden">
          {links.map((l, i) => {
            const Icon = l.Icon;
            const sub = "subGu" in l ? (lang === "gu" ? l.subGu : l.subEn) : "";
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn("flex items-center gap-3 px-3.5 py-3.5", i < links.length - 1 && "border-b border-[var(--cream)]")}
              >
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: l.bg, color: l.fg }}>
                  <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[var(--ink)]">{t(l.labelKey)}</div>
                  {sub && <div className="mt-0.5 text-[11.5px] font-medium text-[var(--faint)]">{sub}</div>}
                </div>
                {"paid" in l && l.paid && (
                  <span className="mr-1 rounded-lg bg-[var(--gold-tint)] px-2 py-0.5 text-[9.5px] font-extrabold text-[var(--warn)]">Paid</span>
                )}
                <ChevronRight className="h-[19px] w-[19px] text-[var(--line-strong)]" strokeWidth={2.2} />
              </Link>
            );
          })}
        </div>

        <div className="mb-2.5 mt-6 px-1 text-xs font-extrabold tracking-wide text-[var(--muted)]">{t("settings")}</div>
        <div className="samaj-card overflow-hidden">
          <div className="border-b border-[var(--cream)] p-3.5">
            <div className="mb-2.5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--violet-tint)] text-[var(--violet)]">
                <Globe className="h-[21px] w-[21px]" strokeWidth={1.8} />
              </div>
              <div className="text-sm font-bold">{t("language")}</div>
            </div>
            <LangToggle className="gap-2" />
          </div>
          <ToggleRow label={t("newsNotif")} on={newsNotif} onToggle={() => setNewsNotif(!newsNotif)} bg="#FEF3E0" fg="#B26A1E" />
          <ToggleRow label={t("feedNotif")} on={feedNotif} onToggle={() => setFeedNotif(!feedNotif)} bg="#EDEBE6" fg="#8B8375" disabled />
        </div>

        <div className="samaj-card mt-4 overflow-hidden">
          <button type="button" className="flex w-full items-center gap-3 border-b border-[var(--cream)] p-3.5 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--info-tint)] text-[var(--info)]">
              <Lock className="h-[19px] w-[19px]" strokeWidth={1.85} />
            </div>
            <div className="flex-1 text-sm font-bold">{t("privacy")}</div>
            <ChevronRight className="h-[19px] w-[19px] text-[var(--line-strong)]" />
          </button>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 p-3.5 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger-tint)] text-[var(--danger)]">
              <LogOut className="h-[19px] w-[19px]" strokeWidth={1.85} />
            </div>
            <div className="flex-1 text-sm font-bold text-[var(--danger)]">{t("logout")}</div>
          </button>
        </div>
      </div>
    </AppScreen>
  );
}

function ToggleRow({
  label,
  on,
  onToggle,
  bg,
  fg,
  disabled,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  bg: string;
  fg: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      className={cn("flex w-full items-center gap-3 border-b border-[var(--cream)] p-3.5 last:border-0", disabled && "opacity-55")}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg, color: fg }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85"><path d="M6.2 9.5a5.8 5.8 0 0 1 11.6 0c0 4.4 1.9 5.5 1.9 5.5H4.3s1.9-1.1 1.9-5.5Z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></svg>
      </div>
      <div className="flex-1 text-left text-sm font-bold">{label}</div>
      <span className={cn("relative h-[27px] w-[46px] rounded-2xl", on ? "bg-[var(--brand)]" : "bg-[var(--scroll-thumb)]")}>
        <span className={cn("absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-[3px]")} />
      </span>
    </button>
  );
}
