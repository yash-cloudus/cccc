"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ImageIcon } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";
import {
  accentGradient,
  accentVarStyle,
  ALBUM_HOVER_SHADOW,
  formatDateRangeDMY,
  pickText,
} from "@/lib/format";

export type AlbumRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  subtitle: string | null;
  photoCount: number;
  cover: string | null;
  accent: string | null;
  startDateISO: string | null;
  endDateISO: string | null;
};

export function GalleryClient({ rows }: { rows: AlbumRow[] }) {
  const { t, lang } = useLang();
  const router = useRouter();

  return (
    <AppScreen showNav={false}>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
            {t("gallery")}
          </div>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
            <ImageIcon className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "હજુ કોઈ આલ્બમ નથી." : "No albums yet."}
          </p>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-3">
            {rows.map((a) => {
              const photos = `${a.photoCount} ${
                lang === "gu" ? "ફોટો" : a.photoCount === 1 ? "photo" : "photos"
              }`;
              const date = formatDateRangeDMY(a.startDateISO, a.endDateISO);
              return (
                <Link
                  key={a.id}
                  href={`/gallery/${a.id}`}
                  style={accentVarStyle(a.accent)}
                  className={`samaj-card mb-3 block w-full overflow-hidden text-left md:mb-0 ${ALBUM_HOVER_SHADOW}`}
                >
                  <div
                    className="flex h-[130px] items-center justify-center overflow-hidden text-white/85"
                    style={{ background: accentGradient(a.accent) }}
                  >
                    {a.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-[34px] w-[34px]" strokeWidth={1.6} />
                    )}
                  </div>
                  <div className="p-[13px]">
                    <div className="text-[15px] font-bold text-[var(--ink)]">
                      {pickText(a.titleGu, a.titleEn, lang)}
                    </div>
                    {a.subtitle && (
                      <div className="mt-0.5 text-xs font-medium text-[var(--faint)]">{a.subtitle}</div>
                    )}
                    <div className="mt-0.5 text-xs font-medium text-[var(--faint)]">
                      {photos}
                      {date ? ` · ${date}` : ""}
                    </div>
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
