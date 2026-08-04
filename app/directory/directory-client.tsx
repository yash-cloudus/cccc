"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { SearchHeader } from "@/components/layout/search-header";
import { useLang } from "@/providers/lang-provider";
import { pickText } from "@/lib/format";

export type SurnameRow = {
  id: string;
  nameEn: string;
  nameGu: string;
  count: number;
};

export type DirectoryFamilyMemberRow = {
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
};

export type DirectoryFamilyRow = {
  id: string;
  headNameEn: string;
  headNameGu: string | null;
  city: string | null;
  surnameEn: string | null;
  surnameGu: string | null;
  surnameGroupId: string | null;
  memberCount: number;
  otherMembers: DirectoryFamilyMemberRow[];
};

const nameHit = (en: string, gu: string | null | undefined, term: string) =>
  `${en}${gu || ""}`.toLowerCase().includes(term);

export function DirectoryClient({
  rows,
  families,
}: {
  rows: SurnameRow[];
  families: DirectoryFamilyRow[];
}) {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");

  const section = lang === "gu" ? "અટક જૂથ પસંદ કરો" : "CHOOSE A SURNAME GROUP";
  const searchPh = lang === "gu" ? "નામ, અટક, શહેર શોધો…" : "Search name, surname, city…";
  const found = lang === "gu" ? "મળ્યું:" : "Found:";
  const familyMemberLabel = lang === "gu" ? "આ પરિવારના સભ્ય" : "family member";
  const membersLabel = lang === "gu" ? "સભ્યો" : "members";

  const term = q.trim().toLowerCase();

  // When there is a search term — search across ALL families (name + surname + city + members)
  const familyResults = useMemo(() => {
    if (!term) return [];
    return families
      .map((f) => {
        // Check city
        const cityHit = f.city ? f.city.toLowerCase().includes(term) : false;
        // Check surname
        const surnameHit = nameHit(f.surnameEn ?? "", f.surnameGu, term);
        // Check head name
        const headHit = nameHit(f.headNameEn, f.headNameGu, term);
        if (cityHit || surnameHit || headHit) {
          return { family: f, match: null as DirectoryFamilyMemberRow | null };
        }
        // Check other members
        const memberMatch = f.otherMembers.find((m) =>
          nameHit(m.fullNameEn, m.fullNameGu, term),
        );
        if (memberMatch) {
          return { family: f, match: memberMatch };
        }
        return null;
      })
      .filter(
        (x): x is { family: DirectoryFamilyRow; match: DirectoryFamilyMemberRow | null } =>
          x !== null,
      );
  }, [term, families]);

  // When no search — filter surname groups as before
  const filteredGroups = useMemo(() => {
    if (term) return [];
    return rows.filter(
      (s) => s.nameEn.toLowerCase().includes(term) || s.nameGu.includes(term),
    );
  }, [term, rows]);

  const isSearching = term.length > 0;

  return (
    <AppScreen>
      <SearchHeader
        title={t("directory")}
        placeholder={searchPh}
        value={q}
        onChange={setQ}
        icon={<Users className="h-[21px] w-[21px]" strokeWidth={1.9} />}
      />
      <div className="px-4 pb-4 pt-4 md:px-[30px] md:pb-[120px]">
        {!isSearching && (
          <div className="mb-3 px-1 text-[13px] font-extrabold tracking-wide text-[var(--muted)]">
            {section}
          </div>
        )}

        {/* ── Surname group list (no search query) ── */}
        {!isSearching && (
          <>
            {filteredGroups.length === 0 ? (
              <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
                {lang === "gu" ? "કોઈ અટક જૂથ મળ્યું નથી." : "No surname groups found."}
              </p>
            ) : (
              <div className="md:grid md:grid-cols-2 md:gap-3">
                {filteredGroups.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/directory/${s.id}`}
                    className="samaj-card mb-2.5 flex items-center gap-3.5 p-[13px] transition hover:border-[var(--gold-border)] hover:shadow-[0_10px_20px_-12px_rgb(var(--brand-rgb) / .35)] md:mb-0"
                  >
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--brand-tint)] to-[var(--brand-border)] text-base font-extrabold text-[var(--brand)]">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold text-[var(--ink)]">
                        {pickText(s.nameGu, s.nameEn, lang)}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-[var(--faint)]">
                        {s.count} {t("families")}
                      </div>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 flex-none text-[var(--line-strong)]"
                      strokeWidth={2.2}
                    />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Global family search results ── */}
        {isSearching && (
          <>
            {familyResults.length === 0 ? (
              <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
                {lang === "gu" ? "કોઈ પરિણામ મળ્યું નથી." : "No results found."}
              </p>
            ) : (
              <div className="md:grid md:grid-cols-2 md:gap-3">
                {familyResults.map(({ family: f, match }) => {
                  const headName = pickText(f.headNameGu, f.headNameEn, lang);
                  const sub = [f.city, `${f.memberCount} ${membersLabel}`]
                    .filter(Boolean)
                    .join(" · ");
                  const href = f.surnameGroupId
                    ? `/directory/family/${f.id}`
                    : `/directory/family/${f.id}`;
                  return (
                    <div key={f.id} className="samaj-card mb-2.5 overflow-hidden md:mb-0">
                      <Link href={href} className="flex items-center gap-3 p-[13px]">
                        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-[var(--danger-tint)] text-base font-extrabold text-[var(--danger)]">
                          {headName.trim()[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-bold text-[var(--ink)]">
                            {headName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-[var(--faint)]">
                            <Users className="h-3.5 w-3.5 flex-none" strokeWidth={1.9} />
                            {sub}
                          </div>
                        </div>
                        <ChevronRight
                          className="h-5 w-5 flex-none text-[var(--line-strong)]"
                          strokeWidth={2.2}
                        />
                      </Link>
                      {match && (
                        <Link
                          href={href}
                          className="flex items-center gap-2 border-t border-[#F0CED2] bg-[var(--danger-tint)] px-3.5 py-2.5"
                        >
                          <Search
                            className="h-3.5 w-3.5 flex-none text-[var(--danger)]"
                            strokeWidth={2.1}
                          />
                          <span className="text-[12.5px] leading-snug font-semibold text-[#7E1F2B]">
                            {found}{" "}
                            <b className="font-extrabold text-[var(--danger)]">
                              {pickText(match.fullNameGu, match.fullNameEn, lang)}
                            </b>{" "}
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
              </div>
            )}
          </>
        )}
      </div>
    </AppScreen>
  );
}
