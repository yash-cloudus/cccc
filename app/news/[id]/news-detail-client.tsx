"use client";

import Link from "next/link";
import { ChevronRight, ExternalLink, FileText, ImageIcon } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { formatDateDMY, pickText } from "@/lib/format";

export type NewsDetail = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  contentEn: string;
  contentGu: string | null;
  dateISO: string;
  isPinned: boolean;
  accent: string | null;
  imageUrl: string | null;
  documentUrl: string | null;
  documentName: string | null;
  linkUrl: string | null;
  authorEn: string | null;
  authorGu: string | null;
};

const DEFAULT_BG = "linear-gradient(150deg,#8E2230,#B24C3B)";

export function NewsDetailClient({ item }: { item: NewsDetail }) {
  const { t, lang } = useLang();

  return (
    <AppScreen>
      <BackHeader title={t("news")} subtitle={formatDateDMY(item.dateISO)} />
      <div className="px-4 py-4 pb-8">
        {item.isPinned && (
          <span className="mb-3 inline-flex items-center gap-1 rounded-lg bg-[var(--gold-tint)] px-2 py-1 text-[10.5px] font-extrabold text-[var(--warn)]">
            📌 {t("pinned")}
          </span>
        )}
        <h1 className="font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold leading-snug text-[var(--ink)]">
          {pickText(item.titleGu, item.titleEn, lang)}
        </h1>
        <div className="mt-1.5 text-[12px] font-semibold text-[var(--faint)]">
          {[formatDateDMY(item.dateISO), pickText(item.authorGu, item.authorEn, lang)]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div
          className="mt-5 flex h-[180px] items-center justify-center overflow-hidden rounded-[20px] text-white"
          style={{ background: item.accent || DEFAULT_BG }}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileText className="h-12 w-12" strokeWidth={1.6} />
          )}
        </div>
        <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-soft)]">
          {pickText(item.contentGu, item.contentEn, lang)}
        </p>

        {item.documentUrl && (
          <a
            href={item.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="samaj-card mt-5 flex items-center gap-3 p-3.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--info-tint)] text-[var(--info)]">
              <FileText className="h-5 w-5" strokeWidth={1.85} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-[var(--ink)]">
                {item.documentName || (lang === "gu" ? "દસ્તાવેજ" : "Document")}
              </div>
              <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">
                {lang === "gu" ? "દસ્તાવેજ ખોલો" : "Open document"}
              </div>
            </div>
            <ExternalLink className="h-[18px] w-[18px] text-[var(--line-strong)]" />
          </a>
        )}

        <Link href="/gallery" className="samaj-card mt-4 flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--violet-tint)] text-[var(--violet)]">
            <ImageIcon className="h-5 w-5" strokeWidth={1.85} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[var(--ink)]">
              {lang === "gu" ? "ફોટા જુઓ" : "See photos"}
            </div>
            <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">
              {lang === "gu" ? "→ ગેલેરી આલ્બમ" : "→ Gallery album"}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 flex-none text-[var(--line-strong)]" strokeWidth={2.2} />
        </Link>

        {item.linkUrl && (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="samaj-btn-primary mt-4 flex h-12 items-center justify-center gap-2 text-sm"
          >
            {lang === "gu" ? "વધુ જુઓ" : "Read more"} <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </AppScreen>
  );
}
