"use client";

import { Download, ImageIcon } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { downloadHref, formatDateRangeDMY, pickText } from "@/lib/format";

export type AlbumDetailImage = { id: string; imageUrl: string; caption: string | null };

export type AlbumDetail = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  description: string | null;
  accent: string | null;
  startDateISO: string | null;
  endDateISO: string | null;
  youtubeUrl: string | null;
  images: AlbumDetailImage[];
};

export function GalleryDetailClient({ album }: { album: AlbumDetail }) {
  const { lang } = useLang();

  const date = formatDateRangeDMY(album.startDateISO, album.endDateISO);
  const photos = `${album.images.length} ${
    lang === "gu" ? "ફોટો" : album.images.length === 1 ? "photo" : "photos"
  }`;
  const subtitle = [date, photos, album.description].filter(Boolean).join(" · ");

  return (
    <AppScreen showNav={false}>
      <BackHeader
        title={pickText(album.titleGu, album.titleEn, lang)}
        subtitle={subtitle}
        right={
          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/12">
            <ImageIcon className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        }
      />

      <div className="px-4 py-4 pb-8">
        {album.images.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "આ આલ્બમમાં હજુ કોઈ ફોટા નથી." : "No photos in this album yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {album.images.map((img, i) => (
              <div
                key={img.id}
                className="relative aspect-square overflow-hidden rounded-[14px] bg-[var(--surface-admin)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.imageUrl} alt={img.caption || ""} className="size-full object-cover" />
                <a
                  href={downloadHref(img.imageUrl, `photo-${i + 1}.jpg`)}
                  download
                  aria-label={lang === "gu" ? "ફોટો ડાઉનલોડ કરો" : "Download photo"}
                  title={lang === "gu" ? "ફોટો ડાઉનલોડ કરો" : "Download photo"}
                  className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                >
                  <Download className="size-3.5" strokeWidth={2.2} />
                </a>
              </div>
            ))}
          </div>
        )}

        {album.youtubeUrl && (
          <a
            href={album.youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="samaj-btn-primary mt-5 flex h-12 items-center justify-center gap-2 text-sm"
          >
            {lang === "gu" ? "વિડિયો જુઓ" : "Watch video"}
          </a>
        )}
      </div>
    </AppScreen>
  );
}
