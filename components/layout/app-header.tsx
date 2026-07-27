"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";

export function AppHeader({
  title,
  subtitle,
  showBell = true,
}: {
  title?: string;
  subtitle?: string;
  showBell?: boolean;
}) {
  const { t, lang } = useLang();
  const community = useCommunity();
  const communityName = lang === "gu" ? community.nameGu || community.nameEn : community.nameEn;

  return (
    <header className="samaj-header sticky top-0 z-30 flex-none overflow-hidden px-5 pb-5 pt-12 text-white">
      <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
      <div className="absolute -bottom-[60px] -left-5 h-[140px] w-[140px] rounded-full bg-gold/[0.14]" />
      <div className="relative z-2 flex items-center gap-3">
        <div
          className="relative flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-[15px] shadow-[0_6px_14px_-6px_rgba(0,0,0,.45)]"
          style={{
            background: community.logoUrl
              ? "#fff"
              : "linear-gradient(150deg,var(--gold-light),var(--gold))",
          }}
          aria-label="logo"
        >
          {community.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-[3px] rounded-xl border-[1.5px] border-brand-deep/35" />
              <span className="font-[family-name:var(--font-noto-serif-gujarati)] text-lg font-bold text-[var(--brand-hover)]">
                {community.shortLogo || t("shortBrand")}
              </span>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wide text-white/70">
            {subtitle || t("hello")}
          </div>
          <div className="truncate font-[family-name:var(--font-noto-serif-gujarati)] text-[17px] font-bold leading-tight">
            {title || communityName}
          </div>
        </div>
        {showBell && (
          <Link
            href="/notifications"
            className="relative flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-white/12"
            aria-label="notifications"
          >
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.9} />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--brand)] bg-[var(--gold)]" />
          </Link>
        )}
      </div>
    </header>
  );
}
