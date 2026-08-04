"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  Globe,
  Info,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { WaIcon } from "@/components/directory/contact-card";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";
import { phoneText, pickText, telLink, waLink } from "@/lib/format";

export type CommitteeMemberRow = {
  id: string;
  nameEn: string | null;
  nameGu: string | null;
  designationEn: string | null;
  designationGu: string | null;
  phone: string | null;
  phoneIso: string | null;
  whatsapp: string | null;
  whatsappIso: string | null;
  email: string | null;
  photoUrl: string | null;
  showContact: boolean;
};

export type CommitteeGroup = {
  id: string;
  nameEn: string;
  nameGu: string | null;
  members: CommitteeMemberRow[];
};

export type InfoSectionRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  bodyEn: string | null;
  bodyGu: string | null;
};

/** Deterministic accent palette used when the data carries no colour of its own. */
const PALETTE = [
  { bg: "var(--danger-tint)", fg: "var(--danger)" },
  { bg: "var(--info-tint)", fg: "var(--info)" },
  { bg: "var(--ochre-tint)", fg: "var(--ochre)" },
  { bg: "var(--leaf-tint)", fg: "var(--leaf)" },
  { bg: "var(--violet-tint)", fg: "var(--violet)" },
  { bg: "var(--warn-tint)", fg: "#B08A1E" },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("");
  return `${Array.from(parts[0])[0] ?? ""}${Array.from(parts[1])[0] ?? ""}`;
}

export function AboutClient({
  committees,
  infoSections,
}: {
  committees: CommitteeGroup[];
  infoSections: InfoSectionRow[];
}) {
  const { t, lang } = useLang();
  const router = useRouter();
  const c = useCommunity();

  const name = lang === "gu" ? c.nameGu || c.nameEn : c.nameEn;
  const description = pickText(c.descGu, c.descEn, lang);
  const address = pickText(c.addressGu, c.addressEn, lang);
  const location = [c.village, c.district, c.state].filter(Boolean).join(", ");
  const primaryLocation = address || location;
  const hasContact = Boolean(
    primaryLocation || c.contactPhone || c.whatsapp || c.email || c.website,
  );

  return (
    <AppScreen>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
            {t("aboutSamaj")}
          </div>
          <div className="flex flex-none items-center gap-2">
            <HeaderLangToggle />
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
              <Building2 className="h-[21px] w-[21px]" strokeWidth={1.7} />
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        <div className="samaj-card mb-4 overflow-hidden p-0">
          <div className="h-[140px] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.bannerUrl || "/images/banners/common-banner.webp"}
              alt=""
              className="size-full object-cover"
            />
          </div>
          <div className="-mt-14 flex items-end gap-3 px-4 pb-4">
            <div className="flex h-28 w-28 flex-none items-center justify-center overflow-hidden rounded-[28px] border-[4px] border-white bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold)] text-4xl font-bold text-[var(--brand-hover)] shadow-[0_4px_10px_rgba(0,0,0,.2)]">
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                c.shortLogo
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate font-[family-name:var(--font-noto-serif-gujarati)] text-[19px] font-bold text-[var(--ink)]">
                {name}
              </h1>
              {c.estd && (
                <div className="mt-0.5 truncate text-[12.5px] font-semibold text-[#A98A50]">
                  {lang === "gu" ? "સ્થાપના " : "Established "}
                  {c.estd}
                  {c.village ? ` · ${c.village}` : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        {description && (
          <div className="samaj-card mb-4 p-4">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
              {lang === "gu" ? "સમિતિનો હેતુ" : "OUR PURPOSE"}
            </div>
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-mid)]">
              {description}
            </p>
          </div>
        )}

        {hasContact && (
          <div className="samaj-card p-4">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
              {lang === "gu" ? "સંપર્ક" : "CONTACT"}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {primaryLocation && (
                <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[var(--line-soft)] px-3 py-2.5 text-[13px]">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-[var(--brand)]" />
                  <span className="min-w-0 break-words text-[var(--ink-mid)]">{primaryLocation}</span>
                </div>
              )}
              {c.contactPhone && (
                <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--line-soft)] px-3 py-2.5 text-[13px]">
                  <Phone className="h-4 w-4 flex-none text-[var(--leaf)]" />
                  <a
                    href={telLink(c.contactPhone, c.contactPhoneIso)}
                    className="min-w-0 truncate text-[var(--ink)] hover:text-[var(--brand)]"
                  >
                    {phoneText(c.contactPhone, c.contactPhoneIso)}
                  </a>
                </div>
              )}
              {c.whatsapp && (
                <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--line-soft)] px-3 py-2.5 text-[13px]">
                  <span className="flex-none text-[var(--wa)]">
                    <WaIcon size={16} />
                  </span>
                  <a
                    href={waLink(c.whatsapp, c.whatsappIso)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-[var(--ink)] hover:text-[var(--wa)]"
                  >
                    {c.whatsapp}
                  </a>
                </div>
              )}
              {c.email && (
                <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--line-soft)] px-3 py-2.5 text-[13px]">
                  <Mail className="h-4 w-4 flex-none text-[var(--info)]" />
                  <a
                    href={`mailto:${c.email}`}
                    className="min-w-0 truncate text-[var(--ink)] hover:text-[var(--brand)]"
                  >
                    {c.email}
                  </a>
                </div>
              )}
              {c.website && (
                <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--line-soft)] px-3 py-2.5 text-[13px]">
                  <Globe className="h-4 w-4 flex-none text-[var(--info)]" />
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-[var(--ink)] hover:text-[var(--brand)]"
                  >
                    {c.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <section className="mt-4">
          <div className="mb-2 px-1 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
            {lang === "gu" ? "સમિતિ" : "COMMITTEES"}
          </div>
          {committees.length === 0 ? (
            <div className="samaj-card p-4 text-center text-[13px] text-[var(--faint)]">
              {lang === "gu" ? "હજુ કોઈ સમિતિ નથી." : "No committees yet."}
            </div>
          ) : (
            committees.map((g) => (
              <div key={g.id} className="samaj-card mb-3 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[var(--gold-tint)] text-[var(--warn)]">
                    <Users className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </div>
                  <div className="text-[15px] font-bold text-[var(--ink)]">
                    {pickText(g.nameGu, g.nameEn, lang)}
                  </div>
                </div>
                {g.members.length === 0 ? (
                  <div className="text-[12.5px] text-[var(--faint)]">
                    {lang === "gu" ? "કોઈ સભ્ય નથી." : "No members yet."}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {g.members.map((m, i) => {
                      const mName = pickText(m.nameGu, m.nameEn, lang);
                      const role = pickText(m.designationGu, m.designationEn, lang);
                      const pal = PALETTE[i % PALETTE.length];
                      return (
                        <div key={m.id} className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[13px] text-sm font-bold"
                            style={{ background: pal.bg, color: pal.fg }}
                          >
                            {m.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              initialsOf(mName)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-bold text-[var(--ink)]">
                              {mName || "—"}
                            </div>
                            {role && (
                              <div className="truncate text-[11.5px] font-medium text-[var(--faint)]">
                                {role}
                              </div>
                            )}
                          </div>
                          {m.showContact && (m.phone || m.whatsapp) && (
                            <div className="flex flex-none gap-1.5">
                              {m.phone && (
                                <a
                                  href={telLink(m.phone, m.phoneIso)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--leaf-tint)] text-[var(--leaf)]"
                                  aria-label={t("call")}
                                >
                                  <Phone className="h-[17px] w-[17px]" strokeWidth={2} />
                                </a>
                              )}
                              {m.whatsapp && (
                                <a
                                  href={waLink(m.whatsapp, m.whatsappIso)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--wa)]/15 text-[var(--wa)]"
                                  aria-label={t("whatsapp")}
                                >
                                  <WaIcon size={17} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <section className="mt-4">
          <div className="mb-2 px-1 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
            {lang === "gu" ? "માહિતી" : "INFORMATION"}
          </div>
          {infoSections.length === 0 ? (
            <div className="samaj-card p-4 text-center text-[13px] text-[var(--faint)]">
              {lang === "gu" ? "હજુ કોઈ માહિતી નથી." : "No information yet."}
            </div>
          ) : (
            infoSections.map((s, i) => {
              const pal = PALETTE[i % PALETTE.length];
              const body = pickText(s.bodyGu, s.bodyEn, lang);
              return (
                <div key={s.id} className="samaj-card mb-3 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                      style={{ background: pal.bg, color: pal.fg }}
                    >
                      <Info className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </div>
                    <div className="text-[15px] font-bold text-[var(--ink)]">
                      {pickText(s.titleGu, s.titleEn, lang)}
                    </div>
                  </div>
                  {body && (
                    <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-mid)]">
                      {body}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </AppScreen>
  );
}
