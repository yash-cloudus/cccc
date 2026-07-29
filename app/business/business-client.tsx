"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, MapPin } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { SearchHeader } from "@/components/layout/search-header";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";
import { pickText } from "@/lib/format";

export type BusinessRow = {
  id: string;
  nameEn: string;
  nameGu: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  ownerEn: string | null;
  ownerGu: string | null;
  categoryId: string | null;
  categoryNameEn: string | null;
  categoryNameGu: string | null;
};

export type CategoryRow = {
  id: string;
  nameEn: string;
  nameGu: string;
};

const PALETTE = [
  { bg: "var(--danger-tint)", fg: "var(--danger)" },
  { bg: "var(--info-tint)", fg: "var(--info)" },
  { bg: "var(--ochre-tint)", fg: "var(--ochre)" },
  { bg: "var(--leaf-tint)", fg: "var(--leaf)" },
  { bg: "var(--violet-tint)", fg: "var(--violet)" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export function BusinessClient({
  businesses,
  categories,
}: {
  businesses: BusinessRow[];
  categories: CategoryRow[];
}) {
  const { t, lang } = useLang();
  const brand = useCommunity();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const searchPh = lang === "gu" ? "ધંધો શોધો…" : "Search business…";
  const emptyTitle = lang === "gu" ? "કોઈ ધંધો મળ્યો નહીં" : "No businesses found";
  const emptySub = lang === "gu" ? "ફિલ્ટર બદલો અથવા શોધ સાફ કરો" : "Change filters or clear search";
  const clearLabel = lang === "gu" ? "ફિલ્ટર સાફ કરો" : "Clear filters";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return businesses.filter((b) => {
      if (cat !== "all" && b.categoryId !== cat) return false;
      if (!term) return true;
      return (
        b.nameEn.toLowerCase().includes(term) ||
        (b.nameGu ?? "").includes(term) ||
        (b.description ?? "").toLowerCase().includes(term) ||
        (b.categoryNameEn ?? "").toLowerCase().includes(term)
      );
    });
  }, [q, cat, businesses]);

  return (
    <AppScreen>
      <SearchHeader
        title={t("business")}
        placeholder={searchPh}
        value={q}
        onChange={setQ}
        icon={<Building2 className="h-[21px] w-[21px]" strokeWidth={1.75} />}
      />
      <div className="px-4 pb-4 pt-3.5 md:pb-[120px]">
        <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "all", label: t("all") }, ...categories.map((c) => ({ id: c.id, label: pickText(c.nameGu, c.nameEn, lang) }))].map(
            (c) => {
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold transition"
                  style={{
                    background: active ? "var(--brand)" : "#fff",
                    color: active ? "#fff" : "#6B6357",
                    border: active ? "none" : "1px solid #EDE4D4",
                  }}
                >
                  {c.label}
                </button>
              );
            },
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-[var(--muted)]">
            <div className="mx-auto mb-3.5 flex h-[76px] w-[76px] items-center justify-center rounded-3xl bg-[#F4F1EA] text-[#C6B8A0]">
              <Building2 className="h-[34px] w-[34px]" strokeWidth={1.6} />
            </div>
            <div className="mb-1 text-[15.5px] font-extrabold text-[var(--ink-mid)]">{emptyTitle}</div>
            <div className="mb-4 text-[13px]">{emptySub}</div>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setCat("all");
              }}
              className="inline-flex h-11 items-center rounded-[14px] border-[1.5px] border-[var(--brand-line)] px-5 text-sm font-bold text-[var(--brand)]"
            >
              {clearLabel}
            </button>
          </div>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-3">
            {filtered.map((b, i) => {
              const name = pickText(b.nameGu, b.nameEn, lang);
              const palette = PALETTE[i % PALETTE.length];
              const category =
                b.categoryNameEn || b.categoryNameGu
                  ? pickText(b.categoryNameGu, b.categoryNameEn, lang)
                  : "";
              const secondary = b.city || b.description || "";
              return (
                <Link
                  key={b.id}
                  href={`/business/${b.id}`}
                  className="samaj-card mb-3 flex items-center gap-3.5 p-[15px] transition hover:border-[var(--gold-border)] hover:shadow-[0_12px_24px_-12px_rgb(var(--brand-rgb) / .3)] md:mb-0"
                >
                  <div
                    className="relative flex h-[66px] w-[66px] flex-none flex-col items-center justify-center overflow-hidden rounded-[18px]"
                    style={{ background: palette.bg, color: palette.fg }}
                  >
                    <div className="absolute left-0 right-0 top-0 h-5 opacity-16" style={{ background: palette.fg }} />
                    <span className="z-1 text-[22px] font-extrabold tracking-wide">{initials(name)}</span>
                    <span className="z-1 mt-0.5 text-[6.5px] font-extrabold tracking-[1.5px] opacity-70">{brand.shortLogo}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-extrabold text-[var(--brand)]">{name}</div>
                    {(b.ownerEn || b.ownerGu) && (
                      <div className="mt-0.5 truncate text-[12.5px] font-semibold text-[var(--ink-mid)]">
                        {pickText(b.ownerGu, b.ownerEn, lang)}
                      </div>
                    )}
                    {secondary && (
                      <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[var(--ink)]">
                        <MapPin className="h-[15px] w-[15px] flex-none text-[var(--ochre)]" strokeWidth={1.8} />
                        <span className="truncate text-sm font-medium">{secondary}</span>
                      </div>
                    )}
                    {category && (
                      <span
                        className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
                        style={{ background: palette.bg, color: palette.fg }}
                      >
                        {category}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 flex-none text-[var(--line-strong)]" strokeWidth={2.2} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
