"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImageIcon, X } from "lucide-react";
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
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const date = formatDateRangeDMY(album.startDateISO, album.endDateISO);
  const photos = `${album.images.length} ${
    lang === "gu" ? "ફોટો" : album.images.length === 1 ? "photo" : "photos"
  }`;
  const subtitle = [date, photos, album.description].filter(Boolean).join(" · ");

  const step = useCallback(
    (dir: 1 | -1) =>
      setViewerIdx((i) =>
        i === null ? i : (i + dir + album.images.length) % album.images.length,
      ),
    [album.images.length],
  );

  useEffect(() => {
    if (viewerIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerIdx(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIdx, step]);

  const viewerImg = viewerIdx !== null ? album.images[viewerIdx] : null;

  return (
    <AppScreen>
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
          <div className="grid grid-cols-3 gap-2">
            {album.images.map((img, i) => (
              <div
                key={img.id}
                className="relative aspect-square overflow-hidden rounded-[14px] bg-[var(--surface-admin)]"
              >
                <button
                  type="button"
                  onClick={() => setViewerIdx(i)}
                  className="block size-full cursor-pointer"
                  aria-label={lang === "gu" ? "ફોટો જુઓ" : "View photo"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl} alt={img.caption || ""} className="size-full object-cover" />
                </button>
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

      {/* Fullscreen photo viewer — tap backdrop or ✕ to close, arrows to move. */}
      {viewerImg && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/92">
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(16px,env(safe-area-inset-top))] text-white">
            <span className="text-[13px] font-bold">
              {viewerIdx! + 1} / {album.images.length}
            </span>
            <button
              type="button"
              onClick={() => setViewerIdx(null)}
              aria-label={lang === "gu" ? "બંધ કરો" : "Close"}
              className="flex size-9 items-center justify-center rounded-full bg-white/15"
            >
              <X className="size-5" strokeWidth={2.2} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setViewerIdx(null)}
            className="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center px-2"
            aria-label={lang === "gu" ? "બંધ કરો" : "Close"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewerImg.imageUrl}
              alt={viewerImg.caption || ""}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
          <div className="flex items-center justify-between px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={lang === "gu" ? "પાછળ" : "Previous"}
              className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <ChevronLeft className="size-5" strokeWidth={2.2} />
            </button>
            {viewerImg.caption && (
              <span className="mx-3 min-w-0 flex-1 truncate text-center text-[12.5px] text-white/80">
                {viewerImg.caption}
              </span>
            )}
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={lang === "gu" ? "આગળ" : "Next"}
              className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <ChevronRight className="size-5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </AppScreen>
  );
}
