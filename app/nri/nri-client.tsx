"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Globe, Phone, Search, X } from "lucide-react";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { WaIcon } from "@/components/directory/contact-card";
import { useLang } from "@/providers/lang-provider";
import type { Lang } from "@/lib/i18n/dictionary";
import { pickText } from "@/lib/format";
import { COUNTRIES, flagUrl, formatFull, telHref, waHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type NriRow = {
  id: string;
  familyId: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  surnameEn: string;
  surnameGu: string | null;
  headNameEn: string;
  country: string;
  city: string;
  occupation: string | null;
  education: string | null;
  bloodGroup: string | null;
  mobile: string | null;
  mobileIso: string;
  whatsapp: string | null;
  whatsappIso: string;
};

const isoOf = (country: string) =>
  COUNTRIES.find((c) => c.name === country)?.iso ?? "in";

/**
 * Members living abroad, grouped by country.
 *
 * Country first, then the people: "who else is in Canada?" is the question this
 * screen exists to answer, and a flat list of every NRI in the community answers
 * it only after a lot of scrolling. Picking a country drills in; city, surname
 * and a name search narrow it from there.
 */
export function NriClient({ rows }: { rows: NriRow[] }) {
  const { lang } = useLang();
  const router = useRouter();
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState("all");
  const [surname, setSurname] = useState("all");
  const [q, setQ] = useState("");

  const T = (gu: string, en: string) => (lang === "gu" ? gu : en);

  /** Countries with at least one member, biggest first. */
  const countries = useMemo(() => {
    const byCountry = new Map<string, number>();
    for (const r of rows) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
    return [...byCountry.entries()]
      .map(([name, count]) => ({ name, count, iso: isoOf(name) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [rows]);

  const inCountry = useMemo(
    () => (country ? rows.filter((r) => r.country === country) : []),
    [rows, country],
  );

  const cities = useMemo(
    () => [...new Set(inCountry.map((r) => r.city).filter(Boolean))].sort(),
    [inCountry],
  );
  const surnames = useMemo(
    () => [...new Set(inCountry.map((r) => r.surnameEn).filter(Boolean))].sort(),
    [inCountry],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inCountry.filter((r) => {
      if (city !== "all" && r.city !== city) return false;
      if (surname !== "all" && r.surnameEn !== surname) return false;
      if (
        needle &&
        !`${r.fullNameEn} ${r.fullNameGu ?? ""} ${r.city} ${r.surnameEn}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [inCountry, city, surname, q]);

  function openCountry(name: string) {
    setCountry(name);
    setCity("all");
    setSurname("all");
    setQ("");
  }

  const title = T("વિદેશમાં વસતા સભ્યો", "Members abroad");

  return (
    <AppScreen>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-4 pt-12 text-white">
        <div className="relative z-2 mx-auto flex w-full max-w-[680px] items-center gap-3">
          <button
            type="button"
            onClick={() => (country ? setCountry(null) : router.push("/menu"))}
            aria-label={T("પાછા", "Back")}
            className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/14"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
              {country ?? title}
            </div>
            <div className="text-[12px] font-semibold text-white/70">
              {country
                ? `${visible.length} ${T("સભ્ય", "members")}`
                : `${rows.length} ${T("સભ્ય", "members")} · ${countries.length} ${T("દેશ", "countries")}`}
            </div>
          </div>
          <HeaderLangToggle />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 py-4 pb-8">
        {rows.length === 0 ? (
          <p className="samaj-card p-6 text-center text-[13px] text-[var(--faint)]">
            {T(
              "હજુ કોઈ સભ્ય વિદેશમાં નોંધાયેલ નથી.",
              "No members are recorded as living abroad yet.",
            )}
          </p>
        ) : !country ? (
          /* ── country grid ─────────────────────────────────────────────── */
          <div className="grid grid-cols-2 gap-3">
            {countries.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => openCountry(c.name)}
                className="samaj-card flex items-center gap-3 p-3.5 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flagUrl(c.iso, 80)}
                  alt=""
                  width={40}
                  height={28}
                  className="h-7 w-10 flex-none rounded-[5px] object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-[var(--ink)]">
                    {c.name}
                  </span>
                  <span className="block text-[11.5px] font-semibold text-[var(--faint)]">
                    {c.count} {T("સભ્ય", c.count === 1 ? "member" : "members")}
                  </span>
                </span>
                <ChevronRight className="size-4 flex-none text-[var(--faint)]" />
              </button>
            ))}
          </div>
        ) : (
          /* ── one country ──────────────────────────────────────────────── */
          <>
            <div className="mb-3 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-[var(--line-input)] bg-white px-3">
              <Search className="size-4 flex-none text-[var(--faint)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={T("નામ, શહેર કે અટક શોધો…", "Search name, city or surname…")}
                className="min-w-0 flex-1 bg-transparent py-3 text-[13.5px] outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label={T("સાફ કરો", "Clear")}>
                  <X className="size-4 text-[var(--faint)]" />
                </button>
              )}
            </div>

            {cities.length > 1 && (
              <FilterRow
                label={T("શહેર", "City")}
                all={T("બધા", "All")}
                value={city}
                options={cities}
                onChange={setCity}
              />
            )}
            {surnames.length > 1 && (
              <FilterRow
                label={T("અટક", "Surname")}
                all={T("બધી", "All")}
                value={surname}
                options={surnames}
                onChange={setSurname}
              />
            )}

            {visible.length === 0 ? (
              <p className="samaj-card mt-3 p-6 text-center text-[13px] text-[var(--faint)]">
                {T("કોઈ સભ્ય મળ્યો નથી", "No members found")}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {visible.map((m) => (
                  <MemberCard key={m.id} m={m} lang={lang} T={T} onOpen={() => router.push(`/directory/family/${m.familyId}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppScreen>
  );
}

function FilterRow({
  label,
  all,
  value,
  options,
  onChange,
}: {
  label: string;
  all: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11px] font-extrabold tracking-wide text-[var(--faint)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["all", ...options].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-bold",
              value === o
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
            )}
          >
            {o === "all" ? all : o}
          </button>
        ))}
      </div>
    </div>
  );
}

function MemberCard({
  m,
  lang,
  T,
  onOpen,
}: {
  m: NriRow;
  lang: Lang;
  T: (gu: string, en: string) => string;
  onOpen: () => void;
}) {
  const name = pickText(m.fullNameGu, m.fullNameEn, lang);
  const surname = pickText(m.surnameGu, m.surnameEn, lang);
  return (
    <div className="samaj-card p-3.5">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flagUrl(isoOf(m.country))}
          alt=""
          width={26}
          height={19}
          className="h-[19px] w-[26px] flex-none rounded-[4px] object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-[var(--ink)]">
            {name} {surname}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] font-semibold text-[var(--faint)]">
            <Globe className="size-3" />
            {m.city || m.country}
            {m.relation ? ` · ${m.relation}` : ""}
            {m.occupation ? ` · ${m.occupation}` : ""}
          </span>
        </span>
        <ChevronRight className="size-4 flex-none text-[var(--faint)]" />
      </button>

      {m.mobile && (
        <div className="mt-2.5 flex items-center gap-2">
          <a
            href={telHref(m.mobile, m.mobileIso)}
            className="samaj-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-[13px]"
          >
            <Phone className="size-3.5" /> {formatFull(m.mobile, m.mobileIso)}
          </a>
          {m.whatsapp && (
            <a
              href={waHref(m.whatsapp, m.whatsappIso)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={T("WhatsApp", "WhatsApp")}
              className="samaj-btn-wa flex h-[42px] w-[42px] flex-none items-center justify-center"
            >
              <WaIcon size={16} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
