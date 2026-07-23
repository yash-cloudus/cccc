import type { Community } from "@prisma/client";

/** Serializable community branding passed from the server layout to client components. */
export type CommunityBrand = {
  id: string;
  slug: string;
  nameEn: string;
  nameGu: string | null;
  logoText: string | null;
  logoUrl: string | null;
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

/** Derive a compact 1-3 char logo badge from branding fields. */
export function shortLogoOf(c: {
  logoText?: string | null;
  nameGu?: string | null;
  nameEn: string;
}): string {
  if (c.logoText && c.logoText.trim()) return c.logoText.trim();
  const g = c.nameGu?.trim();
  if (g) return Array.from(g).slice(0, 3).join("");
  return c.nameEn.trim().slice(0, 2).toUpperCase() || "C";
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
