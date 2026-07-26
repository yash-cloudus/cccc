"use client";

import { ExternalLink, Globe, Phone } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";
import { pickText, telLink, waLink } from "@/lib/format";

export type GalleryImage = {
  id: string;
  imageUrl: string;
  caption: string | null;
};

export type BusinessDetail = {
  id: string;
  nameEn: string;
  nameGu: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  categoryNameEn: string | null;
  categoryNameGu: string | null;
  gallery: GalleryImage[];
};

const PALETTE = [
  { bg: "var(--danger-tint)", fg: "var(--danger)" },
  { bg: "var(--info-tint)", fg: "var(--info)" },
  { bg: "var(--ochre-tint)", fg: "var(--ochre)" },
  { bg: "var(--leaf-tint)", fg: "var(--leaf)" },
  { bg: "var(--violet-tint)", fg: "var(--violet)" },
];

function hashIndex(key: string, mod: number) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const WaIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
  </svg>
);

export function BusinessDetailClient({ biz }: { biz: BusinessDetail }) {
  const { t, lang } = useLang();
  const brand = useCommunity();

  const name = pickText(biz.nameGu, biz.nameEn, lang);
  const category =
    biz.categoryNameEn || biz.categoryNameGu ? pickText(biz.categoryNameGu, biz.categoryNameEn, lang) : "";
  const palette = PALETTE[hashIndex(biz.id, PALETTE.length)];

  const aboutLabel = lang === "gu" ? "વિગત" : "About";
  const addressLabel = lang === "gu" ? "સરનામું" : "Address";
  const cityLabel = lang === "gu" ? "શહેર" : "City";
  const websiteLabel = lang === "gu" ? "વેબસાઇટ" : "Website";
  const hasContactInfo = Boolean(biz.address || biz.city);

  return (
    <AppScreen showNav={false}>
      <BackHeader title={name} subtitle={category || biz.city || undefined} />
      <div className="px-4 py-4 pb-8">
        <div className="samaj-card mb-4 flex items-center gap-4 p-5">
          <div
            className="flex h-20 w-20 flex-none flex-col items-center justify-center rounded-[22px]"
            style={{ background: palette.bg, color: palette.fg }}
          >
            <span className="text-3xl font-extrabold">{initials(name)}</span>
            <span className="text-[7px] font-extrabold tracking-widest opacity-70">{brand.shortLogo}</span>
          </div>
          <div className="min-w-0">
            <div className="text-xl font-extrabold text-[var(--brand)]">{name}</div>
            {category && (
              <span
                className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: palette.bg, color: palette.fg }}
              >
                {category}
              </span>
            )}
          </div>
        </div>

        {biz.description && (
          <div className="samaj-card mb-4 p-4">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">{aboutLabel}</div>
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-soft)]">{biz.description}</p>
          </div>
        )}

        {hasContactInfo && (
          <div className="samaj-card mb-4 p-4">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">{addressLabel}</div>
            {biz.address && (
              <div className="mt-1 flex gap-3 py-1 text-[13px]">
                <b className="min-w-[70px] font-bold text-[var(--faint)]">{addressLabel}</b>
                <span>{biz.address}</span>
              </div>
            )}
            {biz.city && (
              <div className="flex gap-3 py-1 text-[13px]">
                <b className="min-w-[70px] font-bold text-[var(--faint)]">{cityLabel}</b>
                <span>{biz.city}</span>
              </div>
            )}
          </div>
        )}

        {(biz.phone || biz.website) && (
          <div className="space-y-2">
            {biz.phone && (
              <div className="flex gap-2">
                <a
                  href={telLink(biz.phone)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-tint)] py-3.5 text-sm font-bold text-[var(--brand)]"
                >
                  <Phone className="h-4 w-4" /> {t("call")}
                </a>
                <a
                  href={waLink(biz.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--success-tint)] py-3.5 text-sm font-bold text-[var(--success)]"
                >
                  <WaIcon /> {t("whatsapp")}
                </a>
              </div>
            )}
            {biz.website && (
              <a
                href={biz.website}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[var(--brand-line)] text-sm font-bold text-[var(--brand)]"
              >
                <Globe className="h-4 w-4" /> {websiteLabel} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {biz.gallery.length > 0 && (
          <div className="mt-5">
            <div className="mb-2.5 px-1 text-[11.5px] font-extrabold tracking-wide text-[var(--muted)]">
              {t("gallery")}
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
              {biz.gallery.map((g) => (
                <figure key={g.id} className="overflow-hidden rounded-[16px] bg-[#F4F1EA]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.imageUrl} alt={g.caption ?? ""} className="h-[120px] w-full object-cover" />
                  {g.caption && (
                    <figcaption className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--ink-dim)]">
                      {g.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppScreen>
  );
}
