"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, GraduationCap, Phone } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";
import { pickText, telLink, waLink } from "@/lib/format";

export type EducationRow = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  education: string | null;
  occupation: string | null;
  currentlyAt: string | null;
  mobile: string | null;
  showPhone: boolean;
};

export function EducationClient({ rows }: { rows: EducationRow[] }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const note =
    lang === "gu"
      ? "વિદ્યાર્થી સભ્યોની અભ્યાસની માહિતી — સમાજના સભ્યો માટે."
      : "Education details of student members — for registered members.";

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
            {t("education")}
          </div>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
            <GraduationCap className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        <div className="mb-3 rounded-[14px] border border-[#EFE3CB] bg-[#FDF9F0] p-3.5 text-xs leading-relaxed text-[#8B7A55]">
          {note}
        </div>
        {rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "હજુ કોઈ માહિતી નથી." : "No education details yet."}
          </p>
        ) : (
          rows.map((m) => {
            const name = pickText(m.fullNameGu, m.fullNameEn, lang);
            const showContact = m.showPhone && !!m.mobile;
            return (
              <div key={m.id} className="samaj-card mb-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[var(--info-tint)] text-lg font-extrabold text-[var(--info)]">
                    {name.trim()[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-[var(--ink)]">{name}</div>
                    {m.education && (
                      <div className="mt-0.5 text-sm font-semibold text-[var(--brand)]">{m.education}</div>
                    )}
                  </div>
                  {showContact && (
                    <>
                      <a
                        href={telLink(m.mobile)}
                        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <a
                        href={waLink(m.mobile)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
                        </svg>
                      </a>
                    </>
                  )}
                </div>
                {(m.occupation || m.currentlyAt) && (
                  <div className="mt-3 border-t border-[var(--cream)] pt-3 text-[13px] text-[var(--ink-mid)]">
                    {m.occupation && (
                      <div>
                        <span className="font-bold text-[var(--faint)]">
                          {lang === "gu" ? "વ્યવસાય" : "Occupation"}:{" "}
                        </span>
                        {m.occupation}
                      </div>
                    )}
                    {m.currentlyAt && (
                      <div className={m.occupation ? "mt-1" : ""}>
                        <span className="font-bold text-[var(--faint)]">
                          {lang === "gu" ? "હાલમાં" : "Currently at"}:{" "}
                        </span>
                        {m.currentlyAt}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppScreen>
  );
}
