"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
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

export function DirectoryClient({ rows }: { rows: SurnameRow[] }) {
  const { t, lang } = useLang();
  const [q, setQ] = useState("");

  const section = lang === "gu" ? "અટક જૂથ પસંદ કરો" : "CHOOSE A SURNAME GROUP";
  const searchPh = lang === "gu" ? "અટક જૂથ શોધો…" : "Search surname group…";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (s) => s.nameEn.toLowerCase().includes(term) || s.nameGu.includes(term),
    );
  }, [q, rows]);

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
        <div className="mb-3 px-1 text-[13px] font-extrabold tracking-wide text-[#8B8375]">{section}</div>
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[#938C80]">
            {lang === "gu" ? "કોઈ અટક જૂથ મળ્યું નથી." : "No surname groups found."}
          </p>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-3">
            {filtered.map((s, i) => (
              <Link
                key={s.id}
                href={`/directory/${s.id}`}
                className="samaj-card mb-2.5 flex items-center gap-3.5 p-[13px] transition hover:border-[#EED8A8] hover:shadow-[0_10px_20px_-12px_rgba(166,42,56,.35)] md:mb-0"
              >
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-gradient-to-br from-[#FBEDEE] to-[#F6D9DC] text-base font-extrabold text-[#A62A38]">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-[#2A2320]">{pickText(s.nameGu, s.nameEn, lang)}</div>
                  <div className="mt-0.5 text-xs font-medium text-[#938C80]">
                    {s.count} {t("families")}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-none text-[#C9C2B5]" strokeWidth={2.2} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
