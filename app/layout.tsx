import type { Metadata } from "next";
import { Manrope, Noto_Sans_Gujarati, Noto_Serif_Gujarati } from "next/font/google";
import { LangProvider } from "@/providers/lang-provider";
import { CommunityProvider } from "@/providers/community-provider";
import { Toaster } from "@/components/ui/sonner";
import { getActiveCommunity } from "@/lib/tenant";
import { toCommunityBrand } from "@/lib/community-brand";
import { communityThemeVars } from "@/lib/color";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const notoSansGu = Noto_Sans_Gujarati({
  variable: "--font-noto-sans-gujarati",
  subsets: ["gujarati", "latin"],
  weight: ["500", "600", "700", "800"],
});

const notoSerifGu = Noto_Serif_Gujarati({
  variable: "--font-noto-serif-gujarati",
  subsets: ["gujarati", "latin"],
  weight: ["600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  let name = "Community Platform";
  try {
    const community = await getActiveCommunity();
    if (community?.nameEn) name = community.nameEn;
  } catch {
    /* DB down — keep platform title */
  }
  return {
    title: name,
    description: `${name} — member directory, news, businesses and results`,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let community = null;
  try {
    community = await getActiveCommunity();
  } catch {
    /* DB unreachable — render with default brand so Main Admin can still load */
  }
  const brand = toCommunityBrand(community);
  const themeVars = communityThemeVars(brand.primaryColor, brand.secondaryColor);

  return (
    <html lang="gu">
      <body
        style={themeVars as React.CSSProperties}
        className={`${manrope.variable} ${notoSansGu.variable} ${notoSerifGu.variable} antialiased`}
      >
        <CommunityProvider brand={brand}>
          <LangProvider>
            {children}
            <Toaster />
          </LangProvider>
        </CommunityProvider>
      </body>
    </html>
  );
}
