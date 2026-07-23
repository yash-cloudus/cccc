"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Phone } from "lucide-react";
import type { BloodGroupType } from "@prisma/client";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";
import { formatDate, pickText, telLink, waLink } from "@/lib/format";

export type FamilyDetail = {
  id: string;
  headNameEn: string;
  headNameGu: string | null;
  surnameEn: string;
  surnameGu: string | null;
  addressEn: string;
  addressGu: string | null;
  city: string | null;
  businessGu: string | null;
  nativeElderNameEn: string | null;
  nativeElderNameGu: string | null;
  nativeElderPhone: string | null;
  villageEn: string | null;
  villageGu: string | null;
};

export type MemberRow = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  mobile: string | null;
  dobISO: string | null;
  blood: BloodGroupType | null;
  occupation: string | null;
  isHead: boolean;
  showPhone: boolean;
  hasWhatsApp: boolean;
  isDeceased: boolean;
};

const BLOOD_LABEL: Record<BloodGroupType, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  O_POS: "O+",
  O_NEG: "O-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
};

const MEMBER_PALETTE = [
  { bg: "#FCE7E7", fg: "#B0303A" },
  { bg: "#F0ECFB", fg: "#6A4E9C" },
  { bg: "#EAF6EC", fg: "#4E7A45" },
  { bg: "#FEF3E0", fg: "#B26A1E" },
  { bg: "#E7F0FB", fg: "#3D6B8C" },
];

const WaIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
  </svg>
);

export function FamilyClient({
  family,
  members,
}: {
  family: FamilyDetail;
  members: MemberRow[];
}) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const headName = pickText(family.headNameGu, family.headNameEn, lang);
  const surname = pickText(family.surnameGu, family.surnameEn, lang);
  const headSub = [surname, family.city].filter(Boolean).join(" · ");
  const address = pickText(family.addressGu, family.addressEn, lang);
  const village = pickText(family.villageGu, family.villageEn, lang);
  const elderName = pickText(family.nativeElderNameGu, family.nativeElderNameEn, lang);

  const addressLabel = lang === "gu" ? "સરનામું" : "Address";
  const membersLabel = lang === "gu" ? "સભ્યો" : "Members";
  const businessLabel = lang === "gu" ? "ધંધો" : "Business";
  const nativeLabel = lang === "gu" ? "વતન" : "Native place";
  const elderLabel = lang === "gu" ? "વડીલ" : "Elder";
  const phoneLabel = lang === "gu" ? "ફોન" : "Phone";
  const villageLabel = lang === "gu" ? "ગામ" : "Village";
  const deceasedLabel = lang === "gu" ? "સ્વર્ગસ્થ" : "Late";

  const head = members.find((m) => m.isHead);
  const headContact = head && head.showPhone && head.mobile ? head : null;
  const hasNativeInfo = Boolean(elderName || family.nativeElderPhone || village);

  return (
    <AppScreen showNav={false}>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[22px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14"
            aria-label="back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="text-[15px] font-bold text-white/85">{lang === "gu" ? "પરિવાર" : "Family"}</div>
        </div>
        <div className="relative z-2 flex items-center gap-3.5">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[19px] bg-white text-2xl font-extrabold text-[#A62A38]">
            {headName.trim()[0]}
          </div>
          <div>
            <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[19px] font-bold">{headName}</div>
            <div className="mt-0.5 text-[12.5px] text-white/72">{headSub}</div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        <div className="samaj-card mb-3 p-4">
          <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[#A62A38]">{addressLabel}</div>
          <p className="text-[13.5px] leading-relaxed text-[#3C382F]">{address}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {headContact && (
              <>
                <a
                  href={telLink(headContact.mobile)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBEDEE] text-[#A62A38]"
                  aria-label={t("call")}
                >
                  <Phone className="h-4 w-4" />
                </a>
                {headContact.hasWhatsApp && (
                  <a
                    href={waLink(headContact.mobile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E4F5E9] text-[#1E9E52]"
                    aria-label={t("whatsapp")}
                  >
                    <WaIcon />
                  </a>
                )}
              </>
            )}
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2E8] text-[#1E7A3E]">
              <MapPin className="h-4 w-4" />
            </span>
          </div>
        </div>

        {family.businessGu && (
          <div className="samaj-card mb-3 p-4">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[#A62A38]">{businessLabel}</div>
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[#3C382F]">{family.businessGu}</p>
          </div>
        )}

        {hasNativeInfo && (
          <div className="samaj-card mb-3 p-4">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[#A62A38]">{nativeLabel}</div>
            {village && (
              <div className="flex gap-3 py-1 text-[13px]">
                <b className="min-w-[70px] font-bold text-[#938C80]">{villageLabel}</b>
                <span>{village}</span>
              </div>
            )}
            {elderName && (
              <div className="flex gap-3 py-1 text-[13px]">
                <b className="min-w-[70px] font-bold text-[#938C80]">{elderLabel}</b>
                <span>{elderName}</span>
              </div>
            )}
            {family.nativeElderPhone && (
              <div className="flex items-center gap-3 py-1 text-[13px]">
                <b className="min-w-[70px] font-bold text-[#938C80]">{phoneLabel}</b>
                <a href={telLink(family.nativeElderPhone)} className="font-bold text-[#A62A38]">
                  {family.nativeElderPhone}
                </a>
              </div>
            )}
          </div>
        )}

        <div className="samaj-card p-4">
          <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[#A62A38]">
            {membersLabel} ({members.length})
          </div>
          {members.map((m, i) => {
            const name = pickText(m.fullNameGu, m.fullNameEn, lang);
            const palette = MEMBER_PALETTE[i % MEMBER_PALETTE.length];
            const bloodLabel = m.blood ? BLOOD_LABEL[m.blood] : "";
            const sub = [m.relation, bloodLabel, m.occupation].filter(Boolean).join(" · ");
            const canContact = m.showPhone && Boolean(m.mobile);
            const isOpen = expanded === m.id;
            return (
              <div key={m.id} className="border-t border-[#F4EEE3] first:border-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <div
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[15px] font-extrabold"
                    style={{ background: palette.bg, color: palette.fg }}
                  >
                    {name.trim()[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-[#2A2320]">{name}</div>
                    {sub && <div className="text-[11.5px] font-medium text-[#938C80]">{sub}</div>}
                  </div>
                  {m.isDeceased ? (
                    <span className="rounded-lg bg-[#EFEAE2] px-2 py-0.5 text-[10.5px] font-extrabold text-[#8B8375]">
                      {deceasedLabel}
                    </span>
                  ) : (
                    m.isHead && (
                      <span className="rounded-lg bg-[#F4EFE6] px-2 py-0.5 text-[10.5px] font-extrabold text-[#6B6357]">
                        {lang === "gu" ? "વડા" : "Head"}
                      </span>
                    )
                  )}
                </button>
                {isOpen && (
                  <div className="pb-3">
                    {m.dobISO && (
                      <div className="mb-2 text-[11.5px] font-medium text-[#938C80]">
                        {lang === "gu" ? "જન્મ તારીખ" : "Date of birth"}: {formatDate(m.dobISO, lang)}
                      </div>
                    )}
                    {canContact ? (
                      <div className="flex gap-2">
                        <a
                          href={telLink(m.mobile)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FBEDEE] py-2.5 text-[13px] font-bold text-[#A62A38]"
                        >
                          <Phone className="h-4 w-4" /> {t("call")}
                        </a>
                        {m.hasWhatsApp && (
                          <a
                            href={waLink(m.mobile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E4F5E9] py-2.5 text-[13px] font-bold text-[#1E9E52]"
                          >
                            <WaIcon /> {t("whatsapp")}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11.5px] font-medium text-[#B8B0A2]">
                        {lang === "gu" ? "સંપર્ક ઉપલબ્ધ નથી" : "Contact not available"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppScreen>
  );
}
