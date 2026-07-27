import type { Metadata } from "next";
import { headers } from "next/headers";
import { Manrope, Noto_Sans_Gujarati, Noto_Serif_Gujarati } from "next/font/google";
import { LangProvider } from "@/providers/lang-provider";
import { CommunityProvider } from "@/providers/community-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/components/admin/confirm-dialog";
import { getActiveCommunity } from "@/lib/tenant";
import { brandIconDataUri, toCommunityBrand } from "@/lib/community-brand";
import { effectiveHost, parseHost } from "@/lib/host";
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

/**
 * Per-community tab icon + share card.
 *
 * Each community host gets its OWN favicon and Open Graph image, so a browser
 * tab (and any shared link) carries that gam/parivar's logo rather than one
 * shared default. `app/favicon.ico` was deliberately removed — the file
 * convention is static and would win over this.
 */
export async function generateMetadata(): Promise<Metadata> {
  const hdrs = await headers();
  const host = effectiveHost(hdrs) || "";
  const proto = hdrs.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${proto}://${host}`) : undefined;
  const isAdminHost = (hdrs.get("x-host-kind") || parseHost(host).kind) === "admin";

  let community = null;
  try {
    community = await getActiveCommunity();
  } catch {
    /* DB down — fall through to platform branding */
  }

  if (!community) {
    return {
      metadataBase,
      title: "Community Platform",
      description: "Create and run Gam / Parivar community apps.",
      icons: { icon: brandIconDataUri("CP", "#3d4ce0") },
    };
  }

  const brand = toCommunityBrand(community);
  const name = brand.nameGu || brand.nameEn;
  const title = isAdminHost ? `${name} — Admin` : name;
  const description = `${name} — member directory, news, businesses and results`;

  // og:image must be an absolute URL; a data-URI icon cannot serve as one, so
  // the share card only carries an image when a real logo has been uploaded.
  const ogImage =
    brand.logoUrl && metadataBase ? new URL(brand.logoUrl, metadataBase).toString() : undefined;

  return {
    metadataBase,
    title,
    description,
    icons: { icon: brand.logoUrl || brandIconDataUri(brand.shortLogo, brand.primaryColor) },
    openGraph: {
      title,
      description,
      siteName: name,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, alt: name }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
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
            <ConfirmDialogHost />
          </LangProvider>
        </CommunityProvider>
      </body>
    </html>
  );
}
