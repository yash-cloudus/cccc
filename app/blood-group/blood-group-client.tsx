"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Droplet, Phone } from "lucide-react";
import type { BloodGroupType } from "@prisma/client";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { useLang } from "@/providers/lang-provider";
import { pickText, telLink, waLink } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BloodDonorRow = {
  fullNameEn: string;
  fullNameGu: string | null;
  mobile: string | null;
  bloodGroup: BloodGroupType;
  currentlyAt: string | null;
};

const BLOOD_LABELS: Record<BloodGroupType, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  O_POS: "O+",
  O_NEG: "O-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
};

const BLOOD_ORDER = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export function BloodGroupClient({ rows }: { rows: BloodDonorRow[] }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [loc, setLoc] = useState("all");

  const pickLabel = lang === "gu" ? "બ્લડ ગ્રુપ પસંદ કરો" : "CHOOSE BLOOD GROUP";
  const note =
    lang === "gu"
      ? "યાદી ડિરેક્ટરીમાંથી આપોઆપ બને છે — અલગ ડેટા એન્ટ્રી નથી. ઇમરજન્સીમાં જ કૉલ કરો."
      : "The list is built automatically from the directory — no separate data entry. Call only in emergencies.";

  const grouped = useMemo(() => {
    const map: Record<string, BloodDonorRow[]> = {};
    for (const r of rows) {
      const label = BLOOD_LABELS[r.bloodGroup];
      (map[label] ??= []).push(r);
    }
    return map;
  }, [rows]);

  const groupMembers = selected ? grouped[selected] ?? [] : [];

  const locs = useMemo(() => {
    const set = new Set<string>();
    for (const m of groupMembers) {
      const v = m.currentlyAt?.trim();
      if (v) set.add(v);
    }
    return ["all", ...Array.from(set).sort()];
  }, [groupMembers]);

  const members = groupMembers.filter(
    (m) => loc === "all" || (m.currentlyAt?.trim() ?? "") === loc,
  );

  function openGroup(label: string) {
    setSelected(label);
    setLoc("all");
  }

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
            {t("bloodGroup")}
          </div>
          <div className="flex flex-none items-center gap-2">
            <HeaderLangToggle />
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
              <Droplet className="h-[21px] w-[21px]" strokeWidth={1.7} />
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "હજુ કોઈ રક્તદાતા નથી." : "No blood donors yet."}
          </p>
        ) : !selected ? (
          <>
            <div className="mb-3 px-1 text-[13px] font-extrabold tracking-wide text-[var(--muted)]">
              {pickLabel}
            </div>
            <div className="grid grid-cols-2 gap-[11px]">
              {BLOOD_ORDER.map((bg) => {
                const count = grouped[bg]?.length ?? 0;
                return (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => openGroup(bg)}
                    className="samaj-card px-2.5 py-5 text-center transition hover:border-[var(--gold-border)]"
                  >
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[var(--brand-tint)] to-[var(--brand-border)] text-[22px] font-extrabold text-[var(--brand)]">
                      {bg}
                    </div>
                    <div className="text-xs font-semibold text-[var(--faint)]">
                      {count} {lang === "gu" ? "સભ્યો" : "members"}
                    </div>
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
                ‹ {lang === "gu" ? "બધા ગ્રુપ" : "All groups"}
              </button>
              <div className="flex-1 text-right text-[15px] font-extrabold text-[var(--ink)]">
                {selected} · {members.length}
              </div>
            </div>
            {locs.length > 1 && (
              <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1">
                {locs.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLoc(l)}
                    className={cn(
                      "whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold",
                      loc === l
                        ? "bg-[var(--brand)] text-white"
                        : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                    )}
                  >
                    {l === "all" ? t("all") : l}
                  </button>
                ))}
              </div>
            )}
            {members.length === 0 ? (
              <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
                {lang === "gu" ? "આ ગ્રુપમાં કોઈ સભ્ય નથી." : "No members in this group."}
              </p>
            ) : (
              members.map((m, i) => {
                const name = pickText(m.fullNameGu, m.fullNameEn, lang);
                return (
                  <div
                    key={`${name}-${i}`}
                    className="samaj-card mb-2.5 flex items-center gap-3 p-[13px]"
                  >
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--danger-tint)] text-[15px] font-extrabold text-[var(--danger)]">
                      {name.trim()[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{name}</div>
                      {m.currentlyAt && (
                        <div className="text-xs font-medium text-[var(--faint)]">{m.currentlyAt}</div>
                      )}
                    </div>
                    <a
                      href={telLink(m.mobile)}
                      className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={waLink(m.mobile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
                      </svg>
                    </a>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </AppScreen>
  );
}
