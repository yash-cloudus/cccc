import type { Community } from "@prisma/client";

/** Serializable community branding passed from the server layout to client components. */
export type CommunityBrand = {
  id: string;
  slug: string;
  nameEn: string;
  nameGu: string | null;
  logoText: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  shortLogo: string;
  type: string;
  groupingLabel: string | null;
  primaryColor: string;
  secondaryColor: string;
  contactPhone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  addressEn: string | null;
  addressGu: string | null;
  descEn: string | null;
  descGu: string | null;
  estd: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
};

/** Fallback used only when no community can be resolved (e.g. empty DB / platform host). */
export const DEFAULT_BRAND: CommunityBrand = {
  id: "",
  slug: "",
  nameEn: "Community",
  nameGu: null,
  logoText: null,
  logoUrl: null,
  bannerUrl: null,
  shortLogo: "C",
  type: "PARIVAR",
  groupingLabel: null,
  primaryColor: "#a62a38",
  secondaryColor: "#e0a64b",
  contactPhone: null,
  whatsapp: null,
  email: null,
  website: null,
  addressEn: null,
  addressGu: null,
  descEn: null,
  descGu: null,
  estd: null,
  village: null,
  district: null,
  state: null,
};

/**
 * First `n` user-perceived characters.
 *
 * Gujarati letters are multi-codepoint clusters — "શ્રી" is શ + ્ + ર + ી —
 * so slicing an array of code points cuts a letter in half ("શ્ર"). Segment by
 * grapheme so a cluster is kept whole.
 */
export function graphemesOf(text: string): string[] {
  const s = text.trim();
  if (!s) return [];
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  return Seg
    ? Array.from(new Seg("gu", { granularity: "grapheme" }).segment(s), (x) => x.segment)
    : Array.from(s);
}

export function firstGraphemes(text: string, n: number): string {
  return graphemesOf(text).slice(0, n).join("");
}

/** Derive a compact 1-3 char logo badge from branding fields. */
export function shortLogoOf(c: {
  logoText?: string | null;
  nameGu?: string | null;
  nameEn: string;
}): string {
  if (c.logoText && c.logoText.trim()) return c.logoText.trim();
  const g = c.nameGu?.trim();
  if (g) return firstGraphemes(g, 3);
  return c.nameEn.trim().slice(0, 2).toUpperCase() || "C";
}

/**
 * Inline SVG favicon: a brand-coloured tile carrying the community's short
 * logo text. Used when a community has not uploaded a logo image, so every
 * community still gets its own tab icon instead of a shared default.
 *
 * SVG (not a rendered PNG) on purpose — the browser draws it with system
 * fonts, so Gujarati glyphs render without shipping a font file.
 */
export function brandIconDataUri(text: string, color: string): string {
  // Size by rendered letters, not code points — "શ્રી" is one letter.
  const letters = graphemesOf(text.replace(/[<>&"']/g, "")).slice(0, 3);
  const safe = letters.join("") || "C";
  const fontSize = letters.length > 2 ? 22 : letters.length > 1 ? 28 : 38;
  const fill = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#a62a38";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${fill}"/>` +
    `<text x="32" y="33" fill="#fff" font-family="'Noto Serif Gujarati','Noto Sans Gujarati',serif" ` +
    `font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function toCommunityBrand(c: Community | null | undefined): CommunityBrand {
  if (!c) return DEFAULT_BRAND;
  return {
    id: c.id,
    slug: c.slug,
    nameEn: c.nameEn,
    nameGu: c.nameGu,
    logoText: c.logoText,
    logoUrl: c.logoUrl,
    bannerUrl: c.bannerUrl,
    shortLogo: shortLogoOf(c),
    type: c.type,
    groupingLabel: c.groupingLabel,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    contactPhone: c.contactPhone,
    whatsapp: c.whatsapp,
    email: c.email,
    website: c.website,
    addressEn: c.addressEn,
    addressGu: c.addressGu,
    descEn: c.descEn,
    descGu: c.descGu,
    estd: c.estd,
    village: c.village,
    district: c.district,
    state: c.state,
  };
}
