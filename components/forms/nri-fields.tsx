"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRIES, countryByName } from "@/lib/phone";
import { SearchPicker } from "@/components/ui/search-picker";
import { cn } from "@/lib/utils";

export type NriValue = {
  isNri: boolean;
  /** Country name, matching lib/phone/countries.ts exactly. */
  nriCountry: string;
  nriCity: string;
};

export type NriCityOption = {
  /** Country name this city belongs to. */
  country: string;
  city: string;
};

/**
 * "Lives abroad", and if so, where.
 *
 * Sits directly above the village/city question and replaces it when ticked: a
 * member in Toronto has no Indian village to record as their current place, and
 * asking for both invites two half-answers.
 *
 * The country comes from the same fixed list the phone picker uses, so the two
 * always agree and the flag is free. The *cities* are the community admin's —
 * which cities matter is local knowledge no fixed list can hold.
 */
export function NriFields({
  value,
  onChange,
  cities,
  variant = "member",
  error,
  t,
}: {
  value: NriValue;
  onChange: (patch: Partial<NriValue>) => void;
  /** Admin-managed cities, from the NRI dropdown master. */
  cities: NriCityOption[];
  variant?: "member" | "admin";
  error?: { country?: string; city?: string };
  t: (gu: string, en: string) => string;
}) {
  const isAdmin = variant === "admin";
  const countryItems = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.name, label: c.name, iso: c.iso, note: c.dial })),
    [],
  );
  // Cities come from two places: the ones this community's admin curated, and
  // the world list behind /api/public/nri-cities. The admin's come first —
  // they are the places this samaj actually lives — and the world list fills in
  // everywhere else without the browser downloading 47,000 names.
  const [worldCities, setWorldCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [cityLoading, setCityLoading] = useState(false);
  const countryIso = countryByName(value.nriCountry)?.iso ?? "";

  useEffect(() => {
    if (!value.isNri || !countryIso) {
      setWorldCities([]);
      return;
    }
    let cancelled = false;
    setCityLoading(true);
    // Debounced: one request per pause in typing, not per keystroke.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/nri-cities?iso=${countryIso}&q=${encodeURIComponent(citySearch)}`,
        );
        const json = await res.json();
        if (!cancelled) setWorldCities(json?.data?.cities ?? []);
      } catch {
        // Suggestions are a convenience — typing the city still works.
        if (!cancelled) setWorldCities([]);
      } finally {
        if (!cancelled) setCityLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value.isNri, countryIso, citySearch]);

  const cityItems = useMemo(() => {
    const local = cities.filter((c) => c.country === value.nriCountry).map((c) => c.city);
    const seen = new Set(local.map((c) => c.toLowerCase()));
    return [
      ...local.map((c) => ({ value: c, label: c })),
      ...worldCities
        .filter((c) => !seen.has(c.toLowerCase()))
        .map((c) => ({ value: c, label: c })),
    ];
  }, [cities, value.nriCountry, worldCities]);

  const fieldClass = isAdmin
    ? "h-[42px] w-full rounded-[11px] border border-[var(--line-admin)] bg-white px-3 text-[13px] outline-none"
    : "samaj-fld w-full";
  const labelClass = isAdmin
    ? "mb-1 block text-[11.5px] font-bold text-[var(--muted)]"
    : "mb-1 block text-xs font-bold text-[var(--muted)]";

  return (
    <div className="mb-3.5">
      <button
        type="button"
        onClick={() =>
          // Clearing on untick keeps a stale country from travelling with a
          // member who moved home.
          onChange(
            value.isNri
              ? { isNri: false, nriCountry: "", nriCity: "" }
              : { isNri: true },
          )
        }
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[12px] border-[1.5px] px-3.5 py-3 text-left",
          value.isNri
            ? "border-[var(--brand)] bg-[var(--brand-tint)]"
            : "border-[var(--line-input)] bg-white",
        )}
      >
        <span
          className={cn(
            "flex size-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-[12px] font-extrabold",
            value.isNri
              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
              : "border-[var(--line-input)] bg-white",
          )}
        >
          {value.isNri ? "✓" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-[var(--ink)]">
            {t("NRI — વિદેશમાં રહે છે", "NRI — lives abroad")}
          </span>
          <span className="block text-[11.5px] leading-snug text-[var(--faint)]">
            {t(
              "ટિક કરો તો ગામ/શહેરની જગ્યાએ દેશ અને શહેર પુછાશે",
              "Ticking this asks for a country and city instead of a village",
            )}
          </span>
        </span>
      </button>

      {value.isNri && (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
          <div className="block">
            <span className={labelClass}>{t("દેશ", "Country")} *</span>
            {/* Searchable, not a native <select>: 193 entries in a phone's
                scroll wheel is a spin from Afghanistan to Zimbabwe. */}
            <SearchPicker
              variant={variant}
              value={value.nriCountry}
              onChange={(name) =>
                // City belongs to the old country — dropping it prevents
                // "Toronto, Australia".
                onChange({ nriCountry: name, nriCity: "" })
              }
              items={countryItems}
              placeholder={t("દેશ પસંદ કરો", "Select country")}
              searchPlaceholder={t("દેશ શોધો…", "Search country…")}
              emptyText={t("કોઈ દેશ મળ્યો નથી", "No country found")}
              invalid={Boolean(error?.country)}
            />
            {error?.country && (
              <p className="mt-1 text-[11.5px] font-bold text-[var(--danger)]">{error.country}</p>
            )}
          </div>

          <div className="block">
            <span className={labelClass}>{t("શહેર", "City")} *</span>
            {/* The admin's list covers the cities they know about; anyone living
                somewhere else types their own rather than being stuck with the
                closest wrong answer. */}
            <SearchPicker
              variant={variant}
              value={value.nriCity}
              onChange={(city) => onChange({ nriCity: city })}
              items={cityItems}
              disabled={!value.nriCountry}
              allowCustom
              addLabel={(typed) => t(`“${typed}” ઉમેરો`, `Add “${typed}”`)}
              placeholder={
                value.nriCountry
                  ? t("શહેર લખો કે પસંદ કરો", "Type or pick a city")
                  : t("પહેલાં દેશ પસંદ કરો", "Pick a country first")
              }
              searchPlaceholder={t("શહેર શોધો કે લખો…", "Search or type a city…")}
              emptyText={t("શહેર લખો", "Type a city name")}
              onQueryChange={setCitySearch}
              loading={cityLoading}
              invalid={Boolean(error?.city)}
            />
            {error?.city && (
              <p className="mt-1 text-[11.5px] font-bold text-[var(--danger)]">{error.city}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
