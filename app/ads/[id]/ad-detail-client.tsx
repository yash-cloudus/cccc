"use client";

import Link from "next/link";
import { MapPin, Phone, ShieldCheck, Store } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { pickText, telLink, waLink } from "@/lib/format";

export type AdDetail = {
  id: string;
  pitch: string | null;
  imageUrl: string | null;
  isPremium: boolean;
  businessId: string | null;
  nameEn: string;
  nameGu: string | null;
  verified: boolean;
  categoryEn: string | null;
  categoryGu: string | null;
  description: string | null;
  descriptionGu: string | null;
  address: string | null;
  addressGu: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  mapUrl: string | null;
};

/** Same palette the home carousel uses, so an ad keeps its colour across screens. */
const AD_GRADIENTS = [
  "linear-gradient(120deg,#7A2E5C,#B0417E)",
  "linear-gradient(120deg,#1F4C6B,#3D7BA0)",
  "linear-gradient(120deg,#B15A16,#E09A3A)",
  "linear-gradient(120deg,var(--leaf),#6BA85E)",
  "linear-gradient(120deg,#8E2230,#B24C3B)",
];

function hashIndex(key: string, mod: number) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
}

const WaIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
  </svg>
);

/** Section heading inside a card — small, brand-coloured, letter-spaced. */
function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
      {children}
    </div>
  );
}

/** One `label · value` line in the contact card. */
function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[13px] text-[var(--ink-soft)]">
      <b className="w-[72px] flex-none font-bold text-[var(--faint)]">{label}</b>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function AdDetailClient({ ad }: { ad: AdDetail }) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const name = pickText(ad.nameGu, ad.nameEn, lang);
  const category = pickText(ad.categoryGu, ad.categoryEn, lang);
  const description = pickText(ad.descriptionGu, ad.description, lang);
  const address = [pickText(ad.addressGu, ad.address, lang), ad.city].filter(Boolean).join(", ");
  const gradient = AD_GRADIENTS[hashIndex(ad.id, AD_GRADIENTS.length)];
  const mapHref =
    ad.mapUrl ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null);

  return (
    <AppScreen showNav={false}>
      <BackHeader title={T("જાહેરાત વિગત", "Advertisement detail")} />

      <div className="px-4 py-4 pb-8">
        {/* Large banner — the artwork the member paid for, shown at full width. */}
        <div
          className="relative mb-3.5 flex h-[180px] flex-col justify-end overflow-hidden rounded-[20px] p-[18px] text-white shadow-[0_16px_30px_-14px_rgba(60,30,20,.4)]"
          style={
            ad.imageUrl
              ? { backgroundImage: `url(${ad.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: gradient }
          }
        >
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_100%_0%,rgba(255,255,255,.16),transparent_55%)]" />
          {ad.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />}
          {ad.isPremium && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/28 px-[11px] py-[5px] text-[11px] font-extrabold backdrop-blur-sm">
              ★ {T("પ્રીમિયમ", "Premium")}
            </span>
          )}
          <div className="relative z-2">
            <div className="text-2xl font-extrabold leading-tight tracking-tight">{ad.nameEn}</div>
            {ad.pitch && <div className="mt-1.5 text-[13px] font-medium opacity-90">{ad.pitch}</div>}
          </div>
        </div>

        {/* Identity */}
        <div className="samaj-card mb-3 flex items-center gap-3.5 p-[15px]">
          <div
            className="flex size-[58px] flex-none items-center justify-center rounded-2xl text-[22px] font-extrabold text-white"
            style={{ background: gradient }}
          >
            {ad.nameEn.trim().charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
              <span className="text-[17px] font-extrabold text-[var(--ink)]">{name}</span>
              {ad.verified && (
                <span className="inline-flex items-center gap-[3px] rounded-full bg-[var(--info-tint)] px-2 py-[3px] text-[10.5px] font-extrabold text-[var(--info)]">
                  <ShieldCheck className="size-3" strokeWidth={2.4} />
                  {T("વેરિફાઈડ", "Verified")}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {category && (
                <span className="rounded-lg bg-[var(--brand-tint)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--brand)]">
                  {category}
                </span>
              )}
              {ad.isPremium && (
                <span className="rounded-lg bg-[var(--gold-tint)] px-[9px] py-[3px] text-[10.5px] font-extrabold text-[var(--warn)]">
                  ★ {T("પ્રીમિયમ જાહેરાત", "Premium ad")}
                </span>
              )}
            </div>
          </div>
        </div>

        {description && (
          <div className="samaj-card mb-3 p-[15px]">
            <CardLabel>{T("વર્ણન", "DESCRIPTION")}</CardLabel>
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              {description}
            </p>
          </div>
        )}

        {address && (
          <div className="samaj-card mb-3 p-[15px]">
            <CardLabel>{T("સરનામું", "ADDRESS")}</CardLabel>
            <p className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">{address}</p>
          </div>
        )}

        {(ad.website || ad.phone || ad.whatsapp) && (
          <div className="samaj-card mb-3 p-[15px]">
            <CardLabel>{T("સંપર્ક અને લિંક", "CONTACT & LINKS")}</CardLabel>
            {ad.website && (
              <ContactRow label={T("વેબસાઈટ", "Website")}>
                <a
                  href={ad.website.startsWith("http") ? ad.website : `https://${ad.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3D7BC4]"
                >
                  {ad.website}
                </a>
              </ContactRow>
            )}
            {ad.phone && <ContactRow label={T("મોબાઈલ 1", "Mobile 1")}>{ad.phone}</ContactRow>}
            {ad.whatsapp && ad.whatsapp !== ad.phone && (
              <ContactRow label={T("મોબાઈલ 2", "Mobile 2")}>{ad.whatsapp}</ContactRow>
            )}
          </div>
        )}

        {(ad.phone || mapHref) && (
          <div className="mb-3 flex gap-2.5">
            {ad.phone && (
              <>
                <a
                  href={telLink(ad.phone)}
                  className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[15px] bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] text-sm font-extrabold text-white"
                >
                  <Phone className="size-[18px]" strokeWidth={1.9} />
                  {T("કૉલ કરો", "Call")}
                </a>
                <a
                  href={waLink(ad.whatsapp || ad.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[15px] bg-gradient-to-br from-[var(--wa)] to-[var(--wa-dark)] text-sm font-extrabold text-white"
                >
                  <WaIcon />
                  WhatsApp
                </a>
              </>
            )}
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                aria-label={T("નકશા પર જુઓ", "View on map")}
                title={T("નકશા પર જુઓ", "View on map")}
                className="flex size-[50px] flex-none items-center justify-center rounded-[15px] bg-[var(--leaf-tint)] text-[var(--leaf)]"
              >
                <MapPin className="size-5" strokeWidth={1.9} />
              </a>
            )}
          </div>
        )}

        {ad.businessId && (
          <Link
            href={`/business/${ad.businessId}`}
            className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[var(--line-soft)] bg-white text-sm font-extrabold text-[var(--ink-mid)]"
          >
            <Store className="size-[18px] text-[var(--brand)]" strokeWidth={1.9} />
            {T("ધંધાની સંપૂર્ણ માહિતી જુઓ", "Show business information")}
          </Link>
        )}
      </div>
    </AppScreen>
  );
}
