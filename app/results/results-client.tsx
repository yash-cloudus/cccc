"use client";

import { useRouter } from "next/navigation";
import { Award, ChevronLeft } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";
import { pickText } from "@/lib/format";

export type ResultRow = {
  id: string;
  studentName: string;
  standard: string;
  schoolName: string | null;
  percentage: number | null;
  isEligible: boolean;
};

export type ResultDriveInfo = {
  titleEn: string;
  titleGu: string | null;
  year: number;
};

export function ResultsClient({
  drive,
  rows,
}: {
  drive: ResultDriveInfo | null;
  rows: ResultRow[];
}) {
  const { t, lang } = useLang();
  const router = useRouter();

  return (
    <AppScreen showNav={false}>
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
          <div className="flex-1">
            <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
              {t("results")}
            </div>
            {drive && <div className="text-xs text-white/72">{drive.year}</div>}
          </div>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
            <Award className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {!drive || rows.length === 0 ? (
          <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
            {lang === "gu" ? "પરિણામ હજુ પ્રકાશિત નથી" : "Results not published yet"}
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-[20px] border border-[var(--gold-border)] bg-gradient-to-r from-[var(--gold-tint)] to-[var(--surface)] p-4">
              <div className="text-sm font-extrabold text-[#7A4E10]">
                {pickText(drive.titleGu, drive.titleEn, lang)}
              </div>
              <div className="mt-1 text-xs text-[#A98A50]">{drive.year}</div>
            </div>

            <div className="mb-2 px-1 text-[13px] font-extrabold text-[var(--muted)]">
              {lang === "gu" ? "પ્રકાશિત પરિણામ" : "PUBLISHED RESULTS"}
            </div>
            {rows.map((r) => (
              <div key={r.id} className="samaj-card mb-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold">{r.studentName}</div>
                    <div className="mt-1 text-sm text-[var(--faint)]">
                      {r.standard}
                      {r.schoolName ? ` · ${r.schoolName}` : ""}
                    </div>
                    {r.isEligible && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[var(--success-tint)] px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--success)]">
                        {lang === "gu" ? "પાત્ર" : "Eligible"}
                      </span>
                    )}
                  </div>
                  {r.percentage !== null && (
                    <span className="flex-none rounded-xl bg-[var(--gold-tint)] px-3 py-1.5 text-sm font-extrabold text-[var(--warn)]">
                      {r.percentage}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </AppScreen>
  );
}
