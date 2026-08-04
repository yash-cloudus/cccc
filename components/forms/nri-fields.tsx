"use client";

import { useMemo } from "react";
import { COUNTRIES, flagUrl } from "@/lib/phone";
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
  const cityOptions = useMemo(
    () => cities.filter((c) => c.country === value.nriCountry).map((c) => c.city),
    [cities, value.nriCountry],
  );

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
          <label className="block">
            <span className={labelClass}>{t("દેશ", "Country")} *</span>
            <div className="relative">
              {value.nriCountry && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={flagUrl(
                    COUNTRIES.find((c) => c.name === value.nriCountry)?.iso || "in",
                  )}
                  alt=""
                  width={22}
                  height={16}
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-[22px] -translate-y-1/2 rounded-[3px] object-cover"
                />
              )}
              <select
                value={value.nriCountry}
                onChange={(e) =>
                  // City belongs to the old country — dropping it prevents
                  // "Toronto, Australia".
                  onChange({ nriCountry: e.target.value, nriCity: "" })
                }
                className={fieldClass}
                // Inline, not a utility class: `samaj-fld` sets its own
                // padding-left and wins the cascade, so the flag sat on top of
                // the country name.
                style={value.nriCountry ? { paddingLeft: 42 } : undefined}
              >
                <option value="">{t("દેશ પસંદ કરો", "Select country")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {error?.country && (
              <p className="mt-1 text-[11.5px] font-bold text-[var(--danger)]">{error.country}</p>
            )}
          </label>

          <label className="block">
            <span className={labelClass}>{t("શહેર", "City")} *</span>
            {/* A datalist, not a plain select: the admin's list covers the cities
                they know about, and anyone living somewhere else can still say so
                instead of being stuck. */}
            <input
              list="nri-city-options"
              value={value.nriCity}
              onChange={(e) => onChange({ nriCity: e.target.value })}
              disabled={!value.nriCountry}
              placeholder={
                value.nriCountry
                  ? t("શહેર લખો કે પસંદ કરો", "Type or pick a city")
                  : t("પહેલાં દેશ પસંદ કરો", "Pick a country first")
              }
              className={cn(fieldClass, "disabled:opacity-60")}
            />
            <datalist id="nri-city-options">
              {cityOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {error?.city && (
              <p className="mt-1 text-[11.5px] font-bold text-[var(--danger)]">{error.city}</p>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
