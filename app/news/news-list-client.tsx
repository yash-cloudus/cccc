"use client";

import Link from "next/link";
import { ChevronRight, Newspaper } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { useLang } from "@/providers/lang-provider";
import { formatDateDMY, pickText } from "@/lib/format";

export type NewsRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  dateISO: string;
  isPinned: boolean;
  accent: string | null;
  imageUrl: string | null;
  authorEn: string | null;
  authorGu: string | null;
};

const DEFAULT_BG = "linear-gradient(150deg,#8E2230,#B24C3B)";

export function NewsListClient({ rows }: { rows: NewsRow[] }) {
  const { t, lang } = useLang();
  const sub = lang === "gu" ? "સમાજના તાજા સમાચાર" : "Latest community updates";

  return (
    <AppScreen>
      <header className="samaj-header relative flex-none overflow-hidden px-5 pb-5 pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold">{t("news")}</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-white/72">{sub}</div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <HeaderLangToggle />
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
              <Newspaper className="h-[21px] w-[21px]" strokeWidth={1.85} />
            </div>
          </div>
        </div>
      </header>
      <div className="px-4 py-4 md:pb-[120px]">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "હજુ કોઈ સમાચાર નથી." : "No news yet."}
          </p>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-3">
            {rows.map((n) => (
              <Link
                key={n.id}
                href={`/news/${n.id}`}
                className="samaj-card mb-2.5 flex items-center gap-3.5 p-[13px] transition hover:border-[var(--gold-border)] hover:shadow-[0_12px_22px_-12px_rgb(var(--brand-rgb) / .32)] md:mb-0"
              >
                <div
                  className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-[15px] text-white"
                  style={{ background: n.accent || DEFAULT_BG }}
                >
                  {n.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Newspaper className="h-[26px] w-[26px]" strokeWidth={1.8} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {n.isPinned && (
                    <span className="mb-1 inline-flex items-center gap-1 rounded-lg bg-[var(--gold-tint)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--warn)]">
                      📌 {t("pinned")}
                    </span>
                  )}
                  <div className="text-[14.5px] font-bold leading-snug text-[var(--ink)]">
                    {pickText(n.titleGu, n.titleEn, lang)}
                  </div>
                  <div className="mt-0.5 text-[11.5px] font-medium text-[var(--faint)]">
                    {[formatDateDMY(n.dateISO), pickText(n.authorGu, n.authorEn, lang)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-none text-[var(--line-strong)]" strokeWidth={2.2} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
