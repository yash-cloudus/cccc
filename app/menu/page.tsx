"use client";

import { useEffect, useState } from "react";
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
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { pickText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const serviceLinks = [
  { href: "/business/add", labelKey: "addBusiness" as const, subGu: "ડિરેક્ટરીમાં તમારો ધંધો ઉમેરો", subEn: "List your business in the directory", bg: "#FBEDEE", fg: "#A62A38", Icon: Plus },
  { href: "/business", labelKey: "bizDir" as const, bg: "#FEF3E0", fg: "#B26A1E", Icon: Building2 },
  { href: "/ads", labelKey: "postAd" as const, subGu: "₹2,000/બેનર · હોમ સ્ક્રીન ટોપ પર", subEn: "₹2,000/banner · top of home screen", paid: true, bg: "#FCE7E7", fg: "#B0303A", Icon: Megaphone },
  { href: "/gallery", labelKey: "gallery" as const, bg: "#EAF6EC", fg: "#4E7A45", Icon: ImageIcon },
  { href: "/results", labelKey: "uploadResults" as const, bg: "#FEF6E7", fg: "#B08A1E", Icon: Award },
  { href: "/about", labelKey: "aboutSamaj" as const, bg: "#F0ECFB", fg: "#6A4E9C", Icon: Building2 },
];

type MeProfile = { fullNameEn: string; fullNameGu: string | null } | null;

export default function MenuPage() {
  const { t, lang, setLang } = useLang();
  const router = useRouter();
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
        <div className="relative z-2 mb-4 font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold">
          {t("menu")}
        </div>
        <Link
          href="/profile"
          className="relative z-2 flex items-center gap-3.5 rounded-[18px] bg-white/12 p-[13px]"
        >
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl bg-white text-xl font-extrabold text-[#A62A38]">
            {meInit}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold">{meName}</div>
            <div className="mt-0.5 text-[12.5px] text-white/75">{t("myProfile")}</div>
          </div>
          <ChevronRight className="h-5 w-5" />
        </Link>
      </header>

      <div className="px-4 py-4 pb-[96px]">
        <div className="mb-2.5 px-1 text-xs font-extrabold tracking-wide text-[#8B8375]">{t("servicesLabel")}</div>
        <div className="samaj-card overflow-hidden">
          {serviceLinks.map((l, i) => {
            const Icon = l.Icon;
            const sub = "subGu" in l ? (lang === "gu" ? l.subGu : l.subEn) : "";
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn("flex items-center gap-3 px-3.5 py-3.5", i < serviceLinks.length - 1 && "border-b border-[#F4EEE3]")}
              >
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: l.bg, color: l.fg }}>
                  <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#2A2320]">{t(l.labelKey)}</div>
                  {sub && <div className="mt-0.5 text-[11.5px] font-medium text-[#938C80]">{sub}</div>}
                </div>
                {"paid" in l && l.paid && (
                  <span className="mr-1 rounded-lg bg-[#FCEFD6] px-2 py-0.5 text-[9.5px] font-extrabold text-[#B0801E]">Paid</span>
                )}
                <ChevronRight className="h-[19px] w-[19px] text-[#C9C2B5]" strokeWidth={2.2} />
              </Link>
            );
          })}
        </div>

        <div className="mb-2.5 mt-6 px-1 text-xs font-extrabold tracking-wide text-[#8B8375]">{t("settings")}</div>
        <div className="samaj-card overflow-hidden">
          <div className="border-b border-[#F4EEE3] p-3.5">
            <div className="mb-2.5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0ECFB] text-[#6A4E9C]">
                <Globe className="h-[21px] w-[21px]" strokeWidth={1.8} />
              </div>
              <div className="text-sm font-bold">{t("language")}</div>
            </div>
            <div className="flex gap-2 rounded-[13px] bg-[#F4EFE6] p-1">
              <button type="button" onClick={() => setLang("gu")} className={cn("flex-1 rounded-[10px] py-2 text-[13.5px] font-bold", lang === "gu" ? "bg-white text-[#A62A38] shadow-sm" : "text-[#8B8375]")}>ગુજરાતી</button>
              <button type="button" onClick={() => setLang("en")} className={cn("flex-1 rounded-[10px] py-2 text-[13.5px] font-bold", lang === "en" ? "bg-white text-[#A62A38] shadow-sm" : "text-[#8B8375]")}>English</button>
            </div>
          </div>
          <ToggleRow label={t("newsNotif")} on={newsNotif} onToggle={() => setNewsNotif(!newsNotif)} bg="#FEF3E0" fg="#B26A1E" />
          <ToggleRow label={t("feedNotif")} on={feedNotif} onToggle={() => setFeedNotif(!feedNotif)} bg="#EDEBE6" fg="#8B8375" disabled />
        </div>

        <div className="samaj-card mt-4 overflow-hidden">
          <button type="button" className="flex w-full items-center gap-3 border-b border-[#F4EEE3] p-3.5 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F0FB] text-[#3D6B8C]">
              <Lock className="h-[19px] w-[19px]" strokeWidth={1.85} />
            </div>
            <div className="flex-1 text-sm font-bold">{t("privacy")}</div>
            <ChevronRight className="h-[19px] w-[19px] text-[#C9C2B5]" />
          </button>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 p-3.5 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCE7E7] text-[#B0303A]">
              <LogOut className="h-[19px] w-[19px]" strokeWidth={1.85} />
            </div>
            <div className="flex-1 text-sm font-bold text-[#B0303A]">{t("logout")}</div>
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
      className={cn("flex w-full items-center gap-3 border-b border-[#F4EEE3] p-3.5 last:border-0", disabled && "opacity-55")}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg, color: fg }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85"><path d="M6.2 9.5a5.8 5.8 0 0 1 11.6 0c0 4.4 1.9 5.5 1.9 5.5H4.3s1.9-1.1 1.9-5.5Z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></svg>
      </div>
      <div className="flex-1 text-left text-sm font-bold">{label}</div>
      <span className={cn("relative h-[27px] w-[46px] rounded-2xl", on ? "bg-[#A62A38]" : "bg-[#D8D0C2]")}>
        <span className={cn("absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-[3px]")} />
      </span>
    </button>
  );
}
