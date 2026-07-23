"use client";

import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { pickText } from "@/lib/format";

export type FamilyRow = {
  id: string;
  headNameEn: string;
  headNameGu: string | null;
  city: string | null;
  memberCount: number;
};

export function SurnameClient({
  groupNameEn,
  groupNameGu,
  rows,
}: {
  groupNameEn: string;
  groupNameGu: string;
  rows: FamilyRow[];
}) {
  const { t, lang } = useLang();
  const membersLabel = lang === "gu" ? "સભ્યો" : "members";

  return (
    <AppScreen showNav={false}>
      <BackHeader
        title={pickText(groupNameGu, groupNameEn, lang)}
        subtitle={`${rows.length} ${t("families")}`}
      />
      <div className="px-4 py-4">
        {rows.map((f) => {
          const headName = pickText(f.headNameGu, f.headNameEn, lang);
          const sub = [f.city, `${f.memberCount} ${membersLabel}`].filter(Boolean).join(" · ");
          return (
            <div key={f.id} className="samaj-card mb-3 p-[13px]">
              <Link href={`/directory/family/${f.id}`} className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#FCE7E7] text-lg font-extrabold text-[#B0303A]">
                  {headName.trim()[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-[#2A2320]">{headName}</div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-[#938C80]">
                    <Users className="h-3.5 w-3.5 flex-none" strokeWidth={1.9} />
                    {sub}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#C9C2B5]" />
              </Link>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="py-10 text-center text-[#938C80]">{t("noResults")}</div>
        )}
      </div>
    </AppScreen>
  );
}
