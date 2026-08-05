"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, ShieldCheck, Store, Tag } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { ContactActionsRow, ContactRow, DetailCardLabel } from "@/components/directory/contact-card";
import { useLang } from "@/providers/lang-provider";
import { formatDate, phoneText, pickText } from "@/lib/format";

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
  /** Owner/contact name carried on standalone (non-business) banners only. */
  contactName: string | null;
  phone: string | null;
  phoneIso: string | null;
  whatsapp: string | null;
  whatsappIso: string | null;
  mapUrl: string | null;
  endDateISO: string;
};

/** Same palette the home carousel uses, so an ad keeps its colour across screens. */
const AD_GRADIENTS = [
  "linear-gradient(135deg,#7A2E5C,#B0417E)",
  "linear-gradient(135deg,#1F4C6B,#3D7BA0)",
  "linear-gradient(135deg,#B15A16,#E09A3A)",
  "linear-gradient(135deg,#2D6A4F,#52B788)",
  "linear-gradient(135deg,#8E2230,#B24C3B)",
];

function hashIndex(key: string, mod: number) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
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
      <BackHeader title={T("જાહેરાત વિગત", "Advertisement")} />

      <div className="pb-8">
        {/* ─── Full-width hero banner ─── */}
        <div
          className="relative flex h-[220px] w-full flex-col justify-end overflow-hidden"
          style={
            ad.imageUrl
              ? { backgroundImage: `url(${ad.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: gradient }
          }
        >
          {/* Radial highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(255,255,255,.18),transparent_55%)]" />
          {/* Bottom-to-top dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Sponsored / Premium badge */}
          <div className="absolute right-4 top-4 flex gap-2">
            {ad.isPremium && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5C842]/90 px-3 py-1 text-[10.5px] font-extrabold text-[#5A3A00] backdrop-blur-sm">
                ★ {T("પ્રીમિયમ", "Premium")}
              </span>
            )}
            <span className="rounded-full bg-black/30 px-2.5 py-1 text-[9.5px] font-bold tracking-wider text-white backdrop-blur-sm">
              {T("સ્પૉન્સર્ડ", "Sponsored")}
            </span>
          </div>

          {/* Hero text */}
          <div className="relative z-10 p-5">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-white drop-shadow-sm">
              {name}
            </h1>
            {ad.pitch && (
              <p className="mt-1.5 text-[13.5px] font-medium text-white/88">
                {ad.pitch}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {category && (
                <span className="flex items-center gap-1 rounded-full bg-white/22 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  <Tag className="size-[10px]" strokeWidth={2.3} />
                  {category}
                </span>
              )}
              {ad.city && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                  <MapPin className="size-[10px]" strokeWidth={2.2} />
                  {ad.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Content below banner ─── */}
        <div className="px-4 pt-4">
          {/* Identity card */}
          <div className="samaj-card mb-3 flex items-center gap-3.5 p-[15px]">
            <div
              className="flex size-[58px] flex-none items-center justify-center rounded-2xl text-[22px] font-extrabold text-white shadow-sm"
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

          {/* Description */}
          {description && (
            <div className="samaj-card mb-3 p-[15px]">
              <DetailCardLabel>{T("વર્ણન", "DESCRIPTION")}</DetailCardLabel>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                {description}
              </p>
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="samaj-card mb-3 p-[15px]">
              <DetailCardLabel>{T("સરનામું", "ADDRESS")}</DetailCardLabel>
              <div className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                <MapPin className="mt-0.5 size-[15px] flex-none text-[var(--ochre)]" strokeWidth={1.9} />
                <p>{address}</p>
              </div>
            </div>
          )}

          {/* Contact & Links */}
          {(ad.website || ad.contactName || ad.phone || ad.whatsapp) && (
            <div className="samaj-card mb-3 p-[15px]">
              <DetailCardLabel>{T("સંપર્ક અને લિંક", "CONTACT & LINKS")}</DetailCardLabel>
              {ad.contactName && (
                <ContactRow label={T("સંપર્ક વ્યક્તિ", "Contact")}>{ad.contactName}</ContactRow>
              )}
              {ad.website && (
                <ContactRow label={T("વેબસાઈટ", "Website")}>
                  <a
                    href={ad.website.startsWith("http") ? ad.website : `https://${ad.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[#3D7BC4]"
                  >
                    {ad.website}
                    <ArrowUpRight className="size-[13px]" strokeWidth={2} />
                  </a>
                </ContactRow>
              )}
              {ad.phone && (
                <ContactRow label={T("મોબાઈલ 1", "Mobile 1")}>
                  {phoneText(ad.phone, ad.phoneIso)}
                </ContactRow>
              )}
              {ad.whatsapp && ad.whatsapp !== ad.phone && (
                <ContactRow label={T("મોબાઈલ 2", "Mobile 2")}>
                  {phoneText(ad.whatsapp, ad.whatsappIso)}
                </ContactRow>
              )}
            </div>
          )}

          {/* Action buttons */}
          <ContactActionsRow
            phone={ad.phone}
            phoneIso={ad.phoneIso}
            whatsappIso={ad.whatsappIso}
            whatsapp={ad.whatsapp}
            mapHref={mapHref}
            callLabel={T("કૉલ કરો", "Call")}
            waLabel="WhatsApp"
            mapLabel={T("નકશા પર જુઓ", "View on map")}
          />

          {/* Link to full business page */}
          {ad.businessId && (
            <Link
              href={`/business/${ad.businessId}`}
              className="mt-3 flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[var(--line-soft)] bg-white text-sm font-extrabold text-[var(--ink-mid)] transition hover:border-[var(--brand-line)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
            >
              <Store className="size-[18px] text-[var(--brand)]" strokeWidth={1.9} />
              {T("ધંધાની સંપૂર્ણ માહિતી જુઓ", "View full business profile")}
            </Link>
          )}

          {/* Validity footer */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--faint)]">
            <CalendarDays className="size-[13px]" strokeWidth={1.8} />
            {T(`${formatDate(ad.endDateISO, lang)} સુધી માન્ય`, `Valid until ${formatDate(ad.endDateISO, lang)}`)}
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
