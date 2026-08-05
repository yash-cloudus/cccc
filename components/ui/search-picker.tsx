"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { flagUrl } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type PickerItem = {
  value: string;
  label: string;
  /** ISO-3166 alpha-2 — renders the flag beside the label. */
  iso?: string;
  /** Small right-aligned note, e.g. a dial code or a city count. */
  note?: string;
};

/**
 * A select you can type into.
 *
 * The native `<select>` this replaces was unusable at 193 entries: no search,
 * no flags, and on a phone it opens a scroll wheel you have to spin from
 * Afghanistan to Zimbabwe. Same behaviour as the phone field's country picker —
 * deliberately, so the two never feel like different controls.
 *
 * `allowCustom` is what makes it work for cities: the admin's list covers the
 * places they know about, and someone living somewhere else can still type it
 * rather than being stuck with the closest wrong answer.
 */
export function SearchPicker({
  value,
  onChange,
  items,
  placeholder,
  searchPlaceholder,
  emptyText,
  allowCustom = false,
  addLabel,
  disabled,
  variant = "member",
  className,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  items: PickerItem[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Lets the typed text be used as the value — for lists that cannot be complete. */
  allowCustom?: boolean;
  /** Label of the "use what I typed" row; receives the text. */
  addLabel?: (typed: string) => string;
  disabled?: boolean;
  variant?: "member" | "admin";
  className?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = variant === "admin";

  const selected = items.find((i) => i.value === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));
  }, [items, query]);

  const typed = query.trim();
  // Only offer "use what I typed" when it is not already an option — otherwise
  // the same city appears twice, once as a suggestion and once as an invention.
  const showCustom =
    allowCustom && typed.length > 0 && !items.some((i) => i.label.toLowerCase() === typed.toLowerCase());

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

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  const fieldClass = isAdmin
    ? "h-[42px] rounded-[11px] border border-[var(--line-admin)] bg-white text-[13px]"
    : "min-h-[44px] rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white text-[15px]";

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 text-left",
          fieldClass,
          invalid && "border-[var(--danger)]",
          disabled ? "opacity-60" : "cursor-pointer",
        )}
      >
        {selected?.iso && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flagUrl(selected.iso)}
            alt=""
            width={22}
            height={16}
            className="h-4 w-[22px] flex-none rounded-[3px] object-cover"
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-semibold",
            value ? "text-[var(--ink)]" : "text-[var(--faint)] font-medium",
          )}
        >
          {selected?.label || value || placeholder}
        </span>
        <ChevronDown className="size-4 flex-none text-[var(--faint)]" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[13px] border border-[var(--line-input)] bg-white shadow-[0_12px_28px_-8px_rgba(30,25,40,.28)]">
          <div className="flex items-center gap-2 border-b border-[var(--line-input)] px-3 py-2">
            <Search className="size-4 flex-none text-[var(--faint)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (results[0]) pick(results[0].value);
                else if (showCustom) pick(typed);
              }}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto [scrollbar-width:thin]">
            {showCustom && (
              <button
                type="button"
                onClick={() => pick(typed)}
                className="flex w-full cursor-pointer items-center gap-2 border-b border-[var(--line-input)] px-3 py-2 text-left hover:bg-[var(--surface)]"
              >
                <span className="text-[13px] font-bold text-[var(--brand)]">
                  {addLabel ? addLabel(typed) : `Use “${typed}”`}
                </span>
              </button>
            )}
            {results.length === 0 && !showCustom ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-[var(--faint)]">{emptyText}</p>
            ) : (
              results.map((i) => (
                <button
                  key={i.value}
                  type="button"
                  onClick={() => pick(i.value)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface)]",
                    i.value === value && "bg-[var(--brand-tint)]",
                  )}
                >
                  {i.iso && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={flagUrl(i.iso)}
                      alt=""
                      width={22}
                      height={16}
                      className="h-4 w-[22px] flex-none rounded-[3px] object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">
                    {i.label}
                  </span>
                  {i.note && (
                    <span className="flex-none text-[12.5px] font-bold text-[var(--faint)]">
                      {i.note}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
