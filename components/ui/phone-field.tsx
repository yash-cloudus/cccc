"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  COUNTRIES,
  countryOrDefault,
  digitsOf,
  flagUrl,
  formatNational,
  placeholderFor,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

export type PhoneValue = {
  /** ISO-3166 alpha-2, lowercase. */
  iso: string;
  /** Digits only — exactly what is stored. */
  digits: string;
};

/**
 * A phone number as a country and a national number, side by side.
 *
 * The two halves stay separate all the way to the database: a dial code glued
 * onto the front of a number cannot be taken apart again reliably (+1 is the US,
 * Canada and a dozen Caribbean states), so the country would be lost the moment
 * anyone reformatted it.
 *
 * The number is masked live from the selected country's own sample, which also
 * caps how many digits fit — a US field cannot hold eleven digits, and switching
 * country re-groups whatever is already typed instead of clearing it.
 */
export function PhoneField({
  value,
  onChange,
  variant = "member",
  placeholder,
  disabled,
  autoComplete,
  className,
  t = (_gu, en) => en,
}: {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  variant?: "member" | "admin";
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  t?: (gu: string, en: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const country = countryOrDefault(value.iso);
  const isAdmin = variant === "admin";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    // Dial code too: someone who knows "+44" should not have to recall "United
    // Kingdom", and someone typing "uk" should still land on it.
    const digits = q.replace(/\D/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso === q ||
        (digits && c.dial.includes(digits)),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function pick(iso: string) {
    // Keep the digits — changing country re-groups them rather than wiping what
    // was typed. The mask trims any that no longer fit.
    onChange({ iso, digits: digitsOf(value.digits) });
    setOpen(false);
    setQuery("");
  }

  const fieldClass = isAdmin
    ? "h-[42px] rounded-[11px] border border-[var(--line-admin)] bg-white text-[13px]"
    : "min-h-[44px] rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white text-[15px]";

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className={cn("flex items-stretch overflow-hidden", fieldClass)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-label={t("દેશ પસંદ કરો", "Select country")}
          className={cn(
            "flex flex-none items-center gap-1.5 border-r border-[var(--line-input)] px-2.5",
            disabled ? "opacity-60" : "cursor-pointer hover:bg-[var(--surface)]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagUrl(country.iso)}
            alt=""
            width={22}
            height={16}
            className="h-4 w-[22px] flex-none rounded-[3px] object-cover"
          />
          <span className="text-[13px] font-bold text-[var(--ink)]">{country.dial}</span>
          <ChevronDown className="size-3.5 text-[var(--faint)]" />
        </button>

        <input
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          autoComplete={autoComplete}
          value={formatNational(value.digits, country.iso)}
          onChange={(e) => onChange({ iso: country.iso, digits: digitsOf(e.target.value) })}
          placeholder={placeholder ?? placeholderFor(country.iso)}
          className="min-w-0 flex-1 bg-transparent px-3 font-semibold text-[var(--ink)] outline-none disabled:opacity-60"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[13px] border border-[var(--line-input)] bg-white shadow-[0_12px_28px_-8px_rgba(30,25,40,.28)]">
          <div className="flex items-center gap-2 border-b border-[var(--line-input)] px-3 py-2">
            <Search className="size-4 flex-none text-[var(--faint)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("દેશ કે કોડ શોધો…", "Search country or code…")}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto [scrollbar-width:thin]">
            {results.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-[var(--faint)]">
                {t("કોઈ દેશ મળ્યો નથી", "No country found")}
              </p>
            ) : (
              results.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => pick(c.iso)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface)]",
                    c.iso === country.iso && "bg-[var(--brand-tint)]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagUrl(c.iso)}
                    alt=""
                    width={22}
                    height={16}
                    className="h-4 w-[22px] flex-none rounded-[3px] object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">
                    {c.name}
                  </span>
                  <span className="flex-none text-[12.5px] font-bold text-[var(--faint)]">
                    {c.dial}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
