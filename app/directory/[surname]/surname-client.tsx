"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Users } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { SearchHeader } from "@/components/layout/search-header";
import { useLang } from "@/providers/lang-provider";
import { pickText } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FamilyMemberRow = { fullNameEn: string; fullNameGu: string | null; relation: string | null };

export type FamilyRow = {
  id: string;
  headNameEn: string;
  headNameGu: string | null;
  city: string | null;
  memberCount: number;
  /** Every member but the head — searched for a name match when the head's own name doesn't hit. */
  otherMembers: FamilyMemberRow[];
};

const nameHit = (en: string, gu: string | null | undefined, term: string) =>
  `${en}${gu || ""}`.toLowerCase().includes(term);

export function SurnameClient({
  groupNameEn,
  groupNameGu,
  rows,
}: {
  groupNameEn: string;
  groupNameGu: string;
  rows: FamilyRow[];
}) {
  const router = useRouter();
  const { t, lang } = useLang();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");

  const membersLabel = lang === "gu" ? "સભ્યો" : "members";
  const allAreas = lang === "gu" ? "બધા સ્થળ" : "All areas";
  const found = lang === "gu" ? "મળ્યું:" : "Found:";
  const familyMemberLabel = lang === "gu" ? "આ પરિવારના સભ્ય" : "family member";

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter((c): c is string => Boolean(c)))),
    [rows],
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter((r) => city === "all" || r.city === city)
      .map((r) => {
        const headName = pickText(r.headNameGu, r.headNameEn, lang);
        if (!term) return { row: r, headName, match: null as FamilyMemberRow | null };
        if (nameHit(r.headNameEn, r.headNameGu, term)) return { row: r, headName, match: null };
        const match = r.otherMembers.find((m) => nameHit(m.fullNameEn, m.fullNameGu, term));
        return match ? { row: r, headName, match } : null;
      })
      .filter((x): x is { row: FamilyRow; headName: string; match: FamilyMemberRow | null } => x !== null);
  }, [rows, q, city, lang]);

  return (
    <AppScreen showNav={false}>
      <SearchHeader
        title={pickText(groupNameGu, groupNameEn, lang)}
        subtitle={`${rows.length} ${t("families")}`}
        onBack={() => router.back()}
        placeholder={lang === "gu" ? "નામ થી શોધો…" : "Search by name…"}
        value={q}
        onChange={setQ}
      />
      <div className="px-4 py-4">
        {cities.length > 0 && (
          <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1">
            {[["all", allAreas], ...cities.map((c) => [c, c])].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCity(value)}
                className={cn(
                  "shrink-0 rounded-2xl px-3.5 py-2 text-[13px] font-bold whitespace-nowrap",
                  city === value
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {results.map(({ row: f, headName, match }) => {
          const sub = [f.city, `${f.memberCount} ${membersLabel}`].filter(Boolean).join(" · ");
          return (
            <div key={f.id} className="samaj-card mb-3 overflow-hidden">
              <Link href={`/directory/family/${f.id}`} className="flex items-center gap-3 p-[13px]">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[var(--danger-tint)] text-lg font-extrabold text-[var(--danger)]">
                  {headName.trim()[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-[var(--ink)]">{headName}</div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-[var(--faint)]">
                    <Users className="h-3.5 w-3.5 flex-none" strokeWidth={1.9} />
                    {sub}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-none text-[var(--line-strong)]" />
              </Link>
              {match && (
                <Link
                  href={`/directory/family/${f.id}`}
                  className="flex items-center gap-2 border-t border-[#F0CED2] bg-[var(--danger-tint)] px-3.5 py-2.5"
                >
                  <Search className="h-3.5 w-3.5 flex-none text-[var(--danger)]" strokeWidth={2.1} />
                  <span className="text-[12.5px] leading-snug font-semibold text-[#7E1F2B]">
                    {found} <b className="font-extrabold text-[var(--danger)]">{pickText(match.fullNameGu, match.fullNameEn, lang)}</b>{" "}
                    <span className="font-medium text-[#A98A8D]">
                      ({match.relation ? `${match.relation} · ` : ""}
                      {familyMemberLabel})
                    </span>
                  </span>
                </Link>
              )}
            </div>
          );
        })}
        {results.length === 0 && (
          <div className="py-10 text-center text-[var(--faint)]">{t("noResults")}</div>
        )}
      </div>
    </AppScreen>
  );
}
