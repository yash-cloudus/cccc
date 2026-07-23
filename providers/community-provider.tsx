"use client";

import { createContext, useContext } from "react";
import { DEFAULT_BRAND, type CommunityBrand } from "@/lib/community-brand";

const CommunityContext = createContext<CommunityBrand>(DEFAULT_BRAND);

export function CommunityProvider({
  brand,
  children,
}: {
  brand: CommunityBrand;
  children: React.ReactNode;
}) {
  return <CommunityContext.Provider value={brand}>{children}</CommunityContext.Provider>;
}

/** Access the active community's branding from any client component. */
export function useCommunity(): CommunityBrand {
  return useContext(CommunityContext);
}

/** Pick a bilingual community field with sensible fallback (gu → en). */
export function useCommunityName(lang: "gu" | "en"): string {
  const c = useContext(CommunityContext);
  return lang === "gu" ? c.nameGu || c.nameEn : c.nameEn;
}
