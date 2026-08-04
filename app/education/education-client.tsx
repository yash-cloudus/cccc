"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GraduationCap, Phone } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { useLang } from "@/providers/lang-provider";
import { pickText, telLink, waLink } from "@/lib/format";

export type EducationRow = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  /** Master-list label, resolved server-side — the grouping key. */
  degreeEn: string;
  degreeGu: string | null;
  degreeOrder: number;
  course: string | null;
  occupation: string | null;
  currentlyAt: string | null;
  mobile: string | null;
  mobileIso: string | null;
  showPhone: boolean;
};

/** Icon tones cycled across degree cards, in the app's warm palette. */
const TONES = [
  ["#B26A1E", "#FEF3E0"],
  ["#3D6B8C", "#E7F0FB"],
  ["#6A4E9C", "#F0ECFB"],
  ["#4E7A45", "#EAF6EC"],
  ["#B0303A", "#FCE7E7"],
  ["#0E7C7B", "#E1F4F3"],
  ["#8A5A2B", "#F5EADD"],
] as const;

export function EducationClient({ rows }: { rows: EducationRow[] }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const note =
    lang === "gu"
      ? "વિદ્યાર્થી સભ્યોની અભ્યાસની માહિતી — સમાજના સભ્યો માટે."
      : "Education details of student members — for registered members.";
  const pickLabel = lang === "gu" ? "ડિગ્રી પસંદ કરો" : "CHOOSE A DEGREE";
  const membersWord = lang === "gu" ? "સભ્યો" : "members";

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { en: string; gu: string | null; order: number; members: EducationRow[] }
    >();
    for (const r of rows) {
      const g = map.get(r.degreeEn);
      if (g) g.members.push(r);
      else
        map.set(r.degreeEn, {
          en: r.degreeEn,
          gu: r.degreeGu,
          order: r.degreeOrder,
          members: [r],
        });
    }
    return [...map.values()].sort(
      (a, b) => a.order - b.order || a.en.localeCompare(b.en),
    );
  }, [rows]);

  const group = selected ? groups.find((g) => g.en === selected) : undefined;
  const groupLabel = group ? pickText(group.gu, group.en, lang) : "";

  return (
    <AppScreen>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (selected ? setSelected(null) : router.back())}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
            {t("education")}
          </div>
          <div className="flex flex-none items-center gap-2">
            <HeaderLangToggle />
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
              <GraduationCap className="h-[21px] w-[21px]" strokeWidth={1.7} />
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {groups.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "હજુ કોઈ માહિતી નથી." : "No education details yet."}
          </p>
        ) : !group ? (
          <>
            <div className="mb-3 px-1 text-[13px] font-extrabold tracking-wide text-[var(--muted)]">
              {pickLabel}
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {groups.map((g, i) => {
                const [fg, bg] = TONES[i % TONES.length];
                return (
                  <button
                    key={g.en}
                    type="button"
                    onClick={() => setSelected(g.en)}
                    className="samaj-card flex items-center gap-3 p-[13px] text-left transition hover:border-[var(--gold-border)]"
                  >
                    <div
                      className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px]"
                      style={{ background: bg, color: fg }}
                    >
                      <GraduationCap className="h-[23px] w-[23px]" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-[var(--ink)]">
                        {pickText(g.gu, g.en, lang)}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-[var(--faint)]">
                        {g.members.length} {membersWord}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-none text-[var(--faint)]" />
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-[14px] border border-[#EFE3CB] bg-[#FDF9F0] p-3.5 text-xs leading-relaxed text-[#8B7A55]">
              {note}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[13px] font-bold text-[var(--brand)]"
              >
                ‹ {lang === "gu" ? "બધી ડિગ્રી" : "All degrees"}
              </button>
              <div className="flex-1 truncate text-right text-[15px] font-extrabold text-[var(--ink)]">
                {groupLabel} · {group.members.length}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {group.members.map((m) => {
                const name = pickText(m.fullNameGu, m.fullNameEn, lang);
                const sub = [m.course, m.occupation, m.currentlyAt]
                  .filter(Boolean)
                  .join(" · ");
                const showContact = m.showPhone && !!m.mobile;
                return (
                  <div key={m.id} className="samaj-card flex items-center gap-3 p-[13px]">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[var(--info-tint)] text-lg font-extrabold text-[var(--info)]">
                      {name.trim()[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-[var(--ink)]">{name}</div>
                      {sub && (
                        <div className="truncate text-xs font-medium text-[var(--faint)]">
                          {sub}
                        </div>
                      )}
                    </div>
                    {showContact && (
                      <>
                        <a
                          href={telLink(m.mobile, m.mobileIso)}
                          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a
                          href={waLink(m.mobile, m.mobileIso)}
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
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppScreen>
  );
}
